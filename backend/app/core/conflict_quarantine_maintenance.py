"""One-shot, reversible quarantine for authorized legacy ownership conflicts.

There is no HTTP or arbitrary-command interface. The operation is disabled by
default and may only clear the fixed direct-owner columns of pre-Wave-1A rows
that cannot be assigned deterministically.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
import hashlib
import json
import logging
import os
import re

from alembic.migration import MigrationContext
from sqlalchemy import inspect, select, text

from app.core.database import SessionLocal, engine
from app.core.migration_startup import EXPECTED_REVISION
from app.core.ownership import (
    TenantReason,
    direct_owner_field_names,
    has_any_direct_owner_assignment,
    is_fully_ownerless_direct_scope,
)
from app.models.tenant_integrity import TenantIntegrityQuarantine
from app.services.tenant_reconciliation import (
    ReconciliationLookupCache,
    _already_consistent,
    _is_safely_ownerless_legacy,
    derive_scope_for_row,
    reconcile_tenant_integrity,
    tenant_scoped_models,
)


logger = logging.getLogger(__name__)
ENABLED_ENV = "FREE_MVP_CONFLICT_QUARANTINE_ENABLED"
OPERATION_ID_ENV = "FREE_MVP_CONFLICT_QUARANTINE_OPERATION_ID"
EXPECTED_COMMIT_ENV = "FREE_MVP_CONFLICT_QUARANTINE_EXPECTED_COMMIT"
RENDER_COMMIT_ENV = "RENDER_GIT_COMMIT"
_OPERATION_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$")
_COMMIT_RE = re.compile(r"^[0-9a-f]{40}$")
_KEY_PREFIX = "conflict_quarantine_maintenance:"
_READINESS_V6_KEY = f"tenant-readiness-bootstrap:{EXPECTED_REVISION}:v6"
_TENANT_GUARD_CUTOFF = datetime(2026, 8, 2, 1, 44, 45, tzinfo=timezone.utc)
_ADVISORY_LOCK_ID = 0x534F4349414C361
_ALLOWED_REASONS = {
    TenantReason.NO_PARENT_EVIDENCE,
    TenantReason.SCOPE_CONFLICT,
}


class ConflictQuarantineError(RuntimeError):
    """The fixed conflict-quarantine contract rejected the operation."""


@dataclass
class _Candidate:
    row: object
    reason: TenantReason
    owner_fields: tuple[str, ...]

    @property
    def key(self) -> tuple[str, int]:
        return self.row.__tablename__, int(self.row.id)


@dataclass
class _Preflight:
    candidates: list[_Candidate] = field(default_factory=list, repr=False)
    candidate_groups: dict[str, int] = field(default_factory=dict)
    inherited_groups: dict[str, int] = field(default_factory=dict)
    unsafe_groups: dict[str, int] = field(default_factory=dict)
    deterministic_repairable: int = 0

    def aggregate(self) -> dict:
        payload = {
            "candidate_groups": dict(sorted(self.candidate_groups.items())),
            "inherited_groups": dict(sorted(self.inherited_groups.items())),
            "unsafe_groups": dict(sorted(self.unsafe_groups.items())),
            "deterministic_repairable": int(self.deterministic_repairable),
        }
        normalized = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        return {
            **payload,
            "aggregate_plan_hash": hashlib.sha256(normalized.encode("utf-8")).hexdigest(),
        }

    def private_fingerprint(self) -> tuple:
        return tuple(
            sorted(
                (candidate.key, candidate.reason.value, candidate.owner_fields)
                for candidate in self.candidates
            )
        )


def is_enabled() -> bool:
    return os.getenv(ENABLED_ENV, "false").strip().lower() == "true"


def _operation_id() -> str:
    value = os.getenv(OPERATION_ID_ENV, "").strip()
    if not _OPERATION_ID_RE.fullmatch(value):
        raise ConflictQuarantineError("conflict quarantine operation ID is missing or invalid")
    return value


def _require_exact_commit() -> str:
    expected = os.getenv(EXPECTED_COMMIT_ENV, "").strip().lower()
    deployed = os.getenv(RENDER_COMMIT_ENV, "").strip().lower()
    if not _COMMIT_RE.fullmatch(expected) or not _COMMIT_RE.fullmatch(deployed):
        raise ConflictQuarantineError("deployment commit proof is missing or invalid")
    if deployed != expected:
        raise ConflictQuarantineError("deployed commit does not match the approved commit")
    return deployed


def _current_heads() -> tuple[str, ...]:
    with engine.connect() as connection:
        return tuple(sorted(MigrationContext.configure(connection).get_current_heads()))


def _legacy_before_guard(row) -> bool:
    created_at = getattr(row, "created_at", None)
    if not isinstance(created_at, datetime):
        return False
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    return created_at < _TENANT_GUARD_CUTOFF


def _increment(groups: dict[str, int], table: str, reason: str) -> None:
    key = f"{table}:{reason}"
    groups[key] = groups.get(key, 0) + 1


def _inherited_parent_key(db, row) -> tuple[str, int] | None:
    from app.models.keyword import Keyword, KeywordGroup
    from app.models.mention import AIAnalysis, Mention

    if isinstance(row, Keyword):
        parent = db.get(KeywordGroup, row.group_id)
    elif isinstance(row, AIAnalysis):
        parent = db.get(Mention, row.mention_id)
    else:
        return None
    if parent is None:
        return None
    return parent.__tablename__, int(parent.id)


def _build_preflight(db) -> _Preflight:
    preflight = _Preflight()
    cache = ReconciliationLookupCache()
    candidate_keys: set[tuple[str, int]] = set()

    for model in tenant_scoped_models():
        rows = db.execute(select(model).order_by(model.id)).scalars().all()
        for row in rows:
            decision = derive_scope_for_row(db, row, cache)
            if decision.recoverable:
                if not _already_consistent(row, decision.scope):
                    preflight.deterministic_repairable += 1
                continue
            if _is_safely_ownerless_legacy(db, row, decision):
                continue

            reason = decision.reason
            table = row.__tablename__
            owner_fields = direct_owner_field_names(row)
            if (
                reason in _ALLOWED_REASONS
                and len(owner_fields) >= 2
                and "organization_id" in owner_fields
                and has_any_direct_owner_assignment(row)
                and _legacy_before_guard(row)
            ):
                candidate = _Candidate(row, reason, owner_fields)
                preflight.candidates.append(candidate)
                candidate_keys.add(candidate.key)
                _increment(preflight.candidate_groups, table, reason.value)
                continue

            parent_key = _inherited_parent_key(db, row)
            if reason in _ALLOWED_REASONS and parent_key in candidate_keys:
                _increment(preflight.inherited_groups, table, reason.value)
                continue

            _increment(
                preflight.unsafe_groups,
                table,
                reason.value if reason is not None else "UNKNOWN",
            )

    return preflight


def _lock_exact_candidates(db, candidates: list[_Candidate]) -> None:
    """Lock only the authorized source rows, never the full tenant tables."""
    if db.get_bind().dialect.name != "postgresql":
        return
    for candidate in candidates:
        model = type(candidate.row)
        locked = db.execute(
            select(model).where(model.id == candidate.row.id).with_for_update()
        ).scalar_one_or_none()
        if locked is None:
            raise ConflictQuarantineError("preflight candidate disappeared before lock")


def _summary_payload(summary) -> dict:
    raw = asdict(summary)
    return {
        "dry_run": bool(raw["dry_run"]),
        "inspected": int(raw["inspected"]),
        "already_consistent": int(raw["already_consistent"]),
        "repairable": int(raw["repairable"]),
        "repaired": int(raw["repaired"]),
        "quarantined": int(raw["quarantined"]),
        "active_integrity_violations": int(raw["active_integrity_violations"]),
        "ownership_conflicts": int(raw["ownership_conflicts"]),
        "quarantined_legacy": int(raw["quarantined_legacy"]),
        "reasons": dict(sorted(raw["reasons"].items())),
    }


def _require_preflight(first: _Preflight, second: _Preflight) -> None:
    if first.aggregate() != second.aggregate() or first.private_fingerprint() != second.private_fingerprint():
        raise ConflictQuarantineError("conflict quarantine preflight passes differ")
    if second.deterministic_repairable:
        raise ConflictQuarantineError("deterministic tenant repairs remain")
    if second.unsafe_groups:
        raise ConflictQuarantineError("non-allowlisted tenant blockers remain")
    if not second.candidates:
        raise ConflictQuarantineError("no eligible legacy ownership conflicts were found")


def _claim_operation(operation_id: str) -> dict | None:
    db = SessionLocal()
    try:
        row = db.execute(
            text(
                "INSERT INTO system_settings "
                "(key, value, value_type, description, is_public) "
                "VALUES (:key, :value, 'json', 'Fixed legacy conflict quarantine', false) "
                "ON CONFLICT (key) DO NOTHING RETURNING key"
            ),
            {
                "key": f"{_KEY_PREFIX}{operation_id}",
                "value": json.dumps({"status": "running"}, sort_keys=True),
            },
        ).scalar_one_or_none()
        db.commit()
        if row is not None:
            return None
        raw = db.execute(
            text("SELECT value FROM system_settings WHERE key = :key"),
            {"key": f"{_KEY_PREFIX}{operation_id}"},
        ).scalar_one_or_none()
        try:
            payload = json.loads(raw or "{}")
        except (TypeError, json.JSONDecodeError) as exc:
            raise ConflictQuarantineError("conflict quarantine operation state is invalid") from exc
        if payload.get("status") == "completed" and isinstance(payload.get("evidence"), dict):
            return payload["evidence"]
        raise ConflictQuarantineError("conflict quarantine operation ID was already consumed")
    finally:
        db.close()


def _mark_failed(operation_id: str, error_type: str) -> None:
    db = SessionLocal()
    try:
        db.execute(
            text("UPDATE system_settings SET value = :value WHERE key = :key"),
            {
                "key": f"{_KEY_PREFIX}{operation_id}",
                "value": json.dumps(
                    {"status": "failed", "error_type": error_type}, sort_keys=True
                ),
            },
        )
        db.commit()
    finally:
        db.close()


def _record_before_image(db, candidate: _Candidate, operation_id: str) -> None:
    row = candidate.row
    existing = db.execute(
        select(TenantIntegrityQuarantine).where(
            TenantIntegrityQuarantine.table_name == row.__tablename__,
            TenantIntegrityQuarantine.row_identifier == str(row.id),
            TenantIntegrityQuarantine.reason_code == candidate.reason.value,
        )
    ).scalar_one_or_none()
    evidence = dict(getattr(existing, "evidence", None) or {})
    if "conflict_quarantine_apply" in evidence:
        raise ConflictQuarantineError("quarantine restore evidence already exists")
    evidence["conflict_quarantine_apply"] = {
        "operation_id": operation_id,
        "owner_before": {
            field_name: getattr(row, field_name) for field_name in candidate.owner_fields
        },
        "owner_after": {field_name: None for field_name in candidate.owner_fields},
    }
    if existing is None:
        existing = TenantIntegrityQuarantine(
            table_name=row.__tablename__,
            row_identifier=str(row.id),
            reason_code=candidate.reason.value,
            evidence=evidence,
            status="open",
        )
        db.add(existing)
    else:
        existing.evidence = evidence
        existing.status = "open"
        existing.last_seen_at = datetime.now(timezone.utc)


def _require_post_audit(first: dict, second: dict, candidates: list[_Candidate]) -> None:
    if first != second:
        raise ConflictQuarantineError("post-quarantine audit passes differ")
    if not first["dry_run"] or first["repaired"] != 0:
        raise ConflictQuarantineError("post-quarantine audit was not mutation-free")
    if first["repairable"] or first["ownership_conflicts"] or first["active_integrity_violations"]:
        raise ConflictQuarantineError("post-quarantine tenant blockers remain")
    if first["quarantined"] != first["quarantined_legacy"]:
        raise ConflictQuarantineError("post-quarantine rows are not fully isolated")
    for candidate in candidates:
        if not is_fully_ownerless_direct_scope(candidate.row):
            raise ConflictQuarantineError("candidate is not ownerless after quarantine")


def run_conflict_quarantine_if_enabled() -> dict | None:
    """Execute the authorized fixed operation once, or no-op when disabled."""
    if not is_enabled():
        return None
    _require_exact_commit()
    if _current_heads() != (EXPECTED_REVISION,):
        raise ConflictQuarantineError("database revision does not match the approved head")

    operation_id = _operation_id()
    existing = _claim_operation(operation_id)
    if existing is not None:
        return existing

    db = SessionLocal()
    try:
        if db.get_bind().dialect.name == "postgresql":
            db.execute(text("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ"))
            db.execute(text("SELECT pg_advisory_xact_lock(:lock_id)"), {"lock_id": _ADVISORY_LOCK_ID})

        first = _build_preflight(db)
        db.expire_all()
        second = _build_preflight(db)
        _require_preflight(first, second)
        _lock_exact_candidates(db, second.candidates)

        for candidate in second.candidates:
            _record_before_image(db, candidate, operation_id)
            for field_name in candidate.owner_fields:
                setattr(candidate.row, field_name, None)
            changed = {
                attribute.key
                for attribute in inspect(candidate.row).attrs
                if attribute.history.has_changes()
            }
            if not changed or not changed.issubset(set(candidate.owner_fields)):
                raise ConflictQuarantineError("candidate changed outside owner-field allowlist")

        db.flush()
        post_first = _summary_payload(
            reconcile_tenant_integrity(db, dry_run=True, batch_size=500)
        )
        db.expire_all()
        post_second = _summary_payload(
            reconcile_tenant_integrity(db, dry_run=True, batch_size=500)
        )
        _require_post_audit(post_first, post_second, second.candidates)

        evidence = {
            "revision": EXPECTED_REVISION,
            "preflight": second.aggregate(),
            "post_audit": post_second,
            "passes_match": True,
        }
        db.execute(
            text("DELETE FROM system_settings WHERE key = :key"),
            {"key": _READINESS_V6_KEY},
        )
        db.execute(
            text("UPDATE system_settings SET value = :value WHERE key = :key"),
            {
                "key": f"{_KEY_PREFIX}{operation_id}",
                "value": json.dumps(
                    {"status": "completed", "evidence": evidence}, sort_keys=True
                ),
            },
        )
        db.commit()
        logger.info(
            "CONFLICT_QUARANTINE_COMPLETED evidence=%s",
            json.dumps(evidence, sort_keys=True),
        )
        return evidence
    except Exception as exc:
        db.rollback()
        try:
            _mark_failed(operation_id, type(exc).__name__)
        except Exception:
            logger.critical("CONFLICT_QUARANTINE_FAILURE_LEDGER_UNAVAILABLE")
        logger.critical(
            "CONFLICT_QUARANTINE_FAILED error_type=%s", type(exc).__name__
        )
        if isinstance(exc, ConflictQuarantineError):
            raise
        raise ConflictQuarantineError("conflict quarantine execution failed") from exc
    finally:
        db.close()
