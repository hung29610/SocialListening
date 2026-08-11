"""Deterministic, dry-run-only bootstrap for tenant readiness."""

# Runtime release contract: startup-state-machine-v1.

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
import json
import logging

from alembic.migration import MigrationContext
from sqlalchemy import text

from app.core.database import SessionLocal, engine
from app.core.migration_startup import EXPECTED_REVISION
from app.core.ownership import TenantReason
from app.models.tenant_integrity import TenantIntegrityAuditState
from app.services.tenant_reconciliation import reconcile_tenant_integrity


logger = logging.getLogger(__name__)
OPERATION_VERSION = "v6"
OPERATION_KEY = f"tenant-readiness-bootstrap:{EXPECTED_REVISION}:{OPERATION_VERSION}"
RETIRED_OPERATION_KEYS = (
    f"tenant-readiness-bootstrap:{EXPECTED_REVISION}:v1",
    f"tenant-readiness-bootstrap:{EXPECTED_REVISION}:v2",
    f"tenant-readiness-bootstrap:{EXPECTED_REVISION}:v3",
    f"tenant-readiness-bootstrap:{EXPECTED_REVISION}:v4",
    f"tenant-readiness-bootstrap:{EXPECTED_REVISION}:v5",
)
_SAFE_BLOCKING_REASON_CLASSES = frozenset(reason.value for reason in TenantReason)


@dataclass(frozen=True)
class TenantReadinessResult:
    status: str
    reason_code: str
    active_integrity_violation: int = 0
    deterministic_repairable: int = 0
    ownership_conflict: int = 0
    quarantined_legacy: int = 0
    safe: int = 0
    readiness_policy_version: str = OPERATION_VERSION
    blocking_reason_classes: tuple[str, ...] = ()
    quarantine_eligible: bool = False
    conflicting_owner_fields_present: bool = False
    deterministic_repair_available: bool = False

    @property
    def ready(self) -> bool:
        return self.status == "succeeded"


def _current_heads() -> tuple[str, ...]:
    with engine.connect() as connection:
        return tuple(sorted(MigrationContext.configure(connection).get_current_heads()))


def _normalize(summary) -> dict:
    raw = asdict(summary)
    return {
        "dry_run": bool(raw["dry_run"]),
        "inspected": int(raw["inspected"]),
        "already_consistent": int(raw["already_consistent"]),
        "repairable": int(raw["repairable"]),
        "repaired": int(raw["repaired"]),
        "quarantined": int(raw["quarantined"]),
        "reasons": dict(sorted((raw.get("reasons") or {}).items())),
        "active_integrity_violations": int(raw.get("active_integrity_violations", 0)),
        "ownership_conflicts": int(raw.get("ownership_conflicts", 0)),
        "quarantined_legacy": int(raw.get("quarantined_legacy", 0)),
        "blocking_reason_classes": sorted(set(raw.get("blocking_reason_classes") or [])),
        "conflicting_owner_fields_present": bool(
            raw.get("conflicting_owner_fields_present", False)
        ),
    }


def _classify(summary: dict) -> TenantReadinessResult:
    conflicts = summary["ownership_conflicts"]
    quarantined = summary["quarantined_legacy"]
    classified_quarantine = (
        conflicts + quarantined + summary["active_integrity_violations"]
    )
    unknown = max(0, summary["quarantined"] - classified_quarantine)
    accounting_ok = (
        summary["inspected"]
        == summary["already_consistent"] + summary["repairable"] + summary["quarantined"]
    )
    active = summary["active_integrity_violations"] + unknown + (
        0 if summary["dry_run"] and summary["repaired"] == 0 and accounting_ok else 1
    )
    if conflicts:
        status, reason = "blocked", "OWNERSHIP_CONFLICT"
    elif summary["repairable"]:
        status, reason = "blocked", "DETERMINISTIC_REPAIR_REQUIRED"
    elif active:
        status, reason = "blocked", "ACTIVE_INTEGRITY_VIOLATION"
    else:
        status, reason = "succeeded", "READY_WITH_QUARANTINE" if quarantined else "READY"
    return TenantReadinessResult(
        status=status,
        reason_code=reason,
        active_integrity_violation=active,
        deterministic_repairable=summary["repairable"],
        ownership_conflict=conflicts,
        quarantined_legacy=quarantined,
        safe=summary["already_consistent"],
        blocking_reason_classes=tuple(summary["blocking_reason_classes"]),
        quarantine_eligible=bool(
            quarantined
            and not conflicts
            and not summary["repairable"]
            and not active
        ),
        conflicting_owner_fields_present=summary[
            "conflicting_owner_fields_present"
        ],
        deterministic_repair_available=bool(summary["repairable"]),
    )


def _load_operation(db) -> dict | None:
    value = db.execute(
        text("SELECT value FROM system_settings WHERE key = :key"),
        {"key": OPERATION_KEY},
    ).scalar_one_or_none()
    if not value:
        return None
    try:
        payload = json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return {"status": "failed", "reason_code": "INVALID_OPERATION_STATE"}
    return payload if isinstance(payload, dict) else {"status": "failed", "reason_code": "INVALID_OPERATION_STATE"}


def _claim_operation(db) -> bool:
    """Atomically elect one bootstrap runner without committing tenant work."""
    if db.get_bind().dialect.name == "postgresql":
        # A superseded Render generation can retain an uncommitted claim while
        # the platform keeps that process alive after a deploy timeout. Never
        # let a replacement generation wait for the full deployment window.
        db.execute(text("SET LOCAL lock_timeout = '10s'"))
    row = db.execute(
        text(
            "INSERT INTO system_settings "
            "(key, value, value_type, description, is_public) "
            "VALUES (:key, :value, 'json', 'Deterministic tenant readiness bootstrap', false) "
            "ON CONFLICT (key) DO NOTHING RETURNING key"
        ),
        {
            "key": OPERATION_KEY,
            "value": json.dumps(
                {
                    "status": "pending",
                    "reason_code": "DRY_RUNS_PENDING",
                    "readiness_policy_version": OPERATION_VERSION,
                    "blocking_reason_classes": [],
                    "quarantine_eligible": False,
                    "conflicting_owner_fields_present": False,
                    "deterministic_repair_available": False,
                },
                sort_keys=True,
            ),
        },
    ).scalar_one_or_none()
    return row == OPERATION_KEY


def _store_operation(db, result: TenantReadinessResult) -> None:
    value = json.dumps(
        {
            "status": result.status,
            "reason_code": result.reason_code,
            "readiness_policy_version": result.readiness_policy_version,
            "blocking_reason_classes": list(result.blocking_reason_classes),
            "quarantine_eligible": result.quarantine_eligible,
            "conflicting_owner_fields_present": result.conflicting_owner_fields_present,
            "deterministic_repair_available": result.deterministic_repair_available,
        },
        sort_keys=True,
    )
    db.execute(
        text(
            "INSERT INTO system_settings "
            "(key, value, value_type, description, is_public) "
            "VALUES (:key, :value, 'json', 'Deterministic tenant readiness bootstrap', false) "
            "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value"
        ),
        {"key": OPERATION_KEY, "value": value},
    )


def _result_from_payload(payload: dict) -> TenantReadinessResult:
    status = payload.get("status")
    reason = payload.get("reason_code", "INVALID_OPERATION_STATE")
    if status not in {"pending", "succeeded", "blocked", "failed"}:
        return TenantReadinessResult("failed", "INVALID_OPERATION_STATE")
    required_diagnostics = {
        "readiness_policy_version",
        "blocking_reason_classes",
        "quarantine_eligible",
        "conflicting_owner_fields_present",
        "deterministic_repair_available",
    }
    if not required_diagnostics.issubset(payload):
        return TenantReadinessResult("failed", "INVALID_OPERATION_STATE")
    raw_classes = payload.get("blocking_reason_classes", [])
    if not isinstance(raw_classes, list) or any(
        not isinstance(value, str) or value not in _SAFE_BLOCKING_REASON_CLASSES
        for value in raw_classes
    ):
        return TenantReadinessResult("failed", "INVALID_OPERATION_STATE")
    policy_version = payload["readiness_policy_version"]
    if policy_version != OPERATION_VERSION:
        return TenantReadinessResult("failed", "INVALID_OPERATION_STATE")
    boolean_fields = (
        "quarantine_eligible",
        "conflicting_owner_fields_present",
        "deterministic_repair_available",
    )
    if any(
        field in payload and not isinstance(payload[field], bool)
        for field in boolean_fields
    ):
        return TenantReadinessResult("failed", "INVALID_OPERATION_STATE")
    return TenantReadinessResult(
        status,
        str(reason),
        readiness_policy_version=policy_version,
        blocking_reason_classes=tuple(sorted(set(raw_classes))),
        quarantine_eligible=payload.get("quarantine_eligible", False),
        conflicting_owner_fields_present=payload.get(
            "conflicting_owner_fields_present", False
        ),
        deterministic_repair_available=payload.get(
            "deterministic_repair_available", False
        ),
    )


def establish_tenant_readiness() -> TenantReadinessResult:
    """Run at most one committed bootstrap; never mutate tenant-owned rows."""
    if _current_heads() != (EXPECTED_REVISION,):
        return TenantReadinessResult("failed", "MIGRATION_HEAD_MISMATCH")

    db = SessionLocal()
    stage = "claim"
    claimed = False
    try:
        logger.info(
            "STARTUP_STATE phase=tenant_readiness step=claim status=running contract=%s",
            OPERATION_VERSION,
        )
        claimed = _claim_operation(db)
        if not claimed:
            stage = "load_terminal_state"
            existing = _load_operation(db)
            if existing is None:
                return TenantReadinessResult("failed", "INVALID_OPERATION_STATE")
            result = _result_from_payload(existing)
            if result.status == "succeeded":
                state = db.get(TenantIntegrityAuditState, 1)
                if not (
                    state
                    and state.status == "ready"
                    and state.unresolved_count == 0
                    and state.conflict_count == 0
                ):
                    return TenantReadinessResult("failed", "READINESS_LEDGER_MISSING")
            logger.info(
                "STARTUP_STATE phase=tenant_readiness step=claim status=reused "
                "contract=%s result=%s reason=%s",
                OPERATION_VERSION,
                result.status,
                result.reason_code,
            )
            return result

        # The uncommitted INSERT above is the claim. Concurrent INSERT attempts
        # wait for this transaction and then observe its terminal state. A crash
        # rolls the claim back, making a later safe dry-run attempt possible.
        logger.info(
            "STARTUP_STATE phase=tenant_readiness step=claim status=acquired contract=%s",
            OPERATION_VERSION,
        )
        stage = "dry_run_1"
        first = _normalize(reconcile_tenant_integrity(db, dry_run=True, batch_size=500))
        logger.info(
            "STARTUP_STATE phase=tenant_readiness step=dry_run_1 status=completed"
        )
        db.expire_all()
        stage = "dry_run_2"
        second = _normalize(reconcile_tenant_integrity(db, dry_run=True, batch_size=500))
        logger.info(
            "STARTUP_STATE phase=tenant_readiness step=dry_run_2 status=completed"
        )
        stage = "compare"
        if first != second:
            result = TenantReadinessResult("failed", "DRY_RUN_SUMMARIES_DIFFER")
        else:
            result = _classify(first)

        if result.ready:
            state = db.get(TenantIntegrityAuditState, 1) or TenantIntegrityAuditState(id=1)
            state.status = "ready"
            state.unresolved_count = 0
            state.conflict_count = 0
            state.details = {
                "source": "deterministic_startup_bootstrap",
                "dry_run_passes": 2,
                "passes_match": True,
                "classification": asdict(result),
            }
            state.last_run_at = datetime.now(timezone.utc)
            db.add(state)
        else:
            state = db.get(TenantIntegrityAuditState, 1) or TenantIntegrityAuditState(id=1)
            state.status = result.status
            state.unresolved_count = result.active_integrity_violation + result.deterministic_repairable
            state.conflict_count = result.ownership_conflict
            state.details = {
                "source": "deterministic_startup_bootstrap",
                "dry_run_passes": 2,
                "passes_match": first == second,
                "reason_code": result.reason_code,
                "classification": asdict(result),
            }
            state.last_run_at = datetime.now(timezone.utc)
            db.add(state)
        _store_operation(db, result)
        stage = "commit_terminal_state"
        db.commit()
        logger.info(
            "STARTUP_STATE phase=tenant_readiness status=%s reason=%s",
            result.status,
            result.reason_code,
        )
        return result
    except Exception as exc:
        db.rollback()
        safe_stage = stage.upper()
        result = TenantReadinessResult(
            "failed", f"BOOTSTRAP_{safe_stage}_{type(exc).__name__.upper()}"
        )
        if claimed:
            try:
                _store_operation(db, result)
                db.commit()
            except Exception:
                db.rollback()
        logger.error(
            "STARTUP_STATE phase=tenant_readiness step=%s status=failed reason=%s",
            stage,
            result.reason_code,
        )
        return result
    finally:
        db.close()
