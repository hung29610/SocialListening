"""One-shot, fail-closed maintenance for the free Render web runtime.

There is intentionally no HTTP or arbitrary-command interface. The only
supported operation verifies the deployed database revision and performs two
read-only tenant reconciliation passes.
"""

from __future__ import annotations

from dataclasses import asdict
import json
import logging
import os
import re

from alembic.migration import MigrationContext
from sqlalchemy import text

from app.core.database import SessionLocal, engine
from app.services.tenant_reconciliation import reconcile_tenant_integrity


logger = logging.getLogger(__name__)
EXPECTED_REVISION = "d72f8a913b21"
ENABLED_ENV = "FREE_MVP_MAINTENANCE_ENABLED"
OPERATION_ID_ENV = "FREE_MVP_MAINTENANCE_OPERATION_ID"
_OPERATION_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$")
_KEY_PREFIX = "free_mvp_maintenance:"
_CONFLICT_REASONS = {
    "MULTIPLE_ORGANIZATION_CANDIDATES",
    "SCOPE_CONFLICT",
    "USER_ORGANIZATION_MISMATCH",
}


class FreeMvpMaintenanceError(RuntimeError):
    """A startup maintenance precondition or invariant failed."""


def _enabled() -> bool:
    return os.getenv(ENABLED_ENV, "false").strip().lower() == "true"


def _operation_id() -> str:
    value = os.getenv(OPERATION_ID_ENV, "").strip()
    if not _OPERATION_ID_RE.fullmatch(value):
        raise FreeMvpMaintenanceError("maintenance operation ID is missing or invalid")
    return value


def _current_revision() -> str | None:
    """Return the database revision reported by ``alembic current``."""
    with engine.connect() as connection:
        return MigrationContext.configure(connection).get_current_revision()


def _summary_payload(summary) -> dict:
    raw = asdict(summary)
    return {
        "dry_run": bool(raw["dry_run"]),
        "inspected": int(raw["inspected"]),
        "already_consistent": int(raw["already_consistent"]),
        "repairable": int(raw["repairable"]),
        "repaired": int(raw["repaired"]),
        "quarantined": int(raw["quarantined"]),
        "reasons": dict(sorted((raw.get("reasons") or {}).items())),
    }


def _claim_operation(db, operation_id: str) -> None:
    row = db.execute(
        text(
            "INSERT INTO system_settings "
            "(key, value, value_type, description, is_public) "
            "VALUES (:key, :value, 'json', 'Free MVP one-time maintenance state', false) "
            "ON CONFLICT (key) DO NOTHING RETURNING id"
        ),
        {
            "key": f"{_KEY_PREFIX}{operation_id}",
            "value": json.dumps({"status": "running"}, sort_keys=True),
        },
    ).first()
    db.commit()
    if row is None:
        raise FreeMvpMaintenanceError("maintenance operation ID was already consumed")


def _finish_operation(db, operation_id: str, status: str, evidence: dict) -> None:
    db.execute(
        text("UPDATE system_settings SET value = :value WHERE key = :key"),
        {
            "key": f"{_KEY_PREFIX}{operation_id}",
            "value": json.dumps({"status": status, "evidence": evidence}, sort_keys=True),
        },
    )
    db.commit()


def run_free_mvp_maintenance_if_enabled() -> dict | None:
    """Run the fixed one-time dry-run contract, or no-op when disabled."""
    if not _enabled():
        return None

    operation_id = _operation_id()
    db = SessionLocal()
    claimed = False
    try:
        _claim_operation(db, operation_id)
        claimed = True
        revision = _current_revision()
        if revision != EXPECTED_REVISION:
            raise FreeMvpMaintenanceError("database revision does not match the approved revision")

        first = _summary_payload(reconcile_tenant_integrity(db, dry_run=True, batch_size=500))
        db.rollback()
        second = _summary_payload(reconcile_tenant_integrity(db, dry_run=True, batch_size=500))
        db.rollback()
        if first != second:
            raise FreeMvpMaintenanceError("tenant dry-run aggregate summaries differ")
        if _CONFLICT_REASONS.intersection(first["reasons"]):
            raise FreeMvpMaintenanceError("tenant ownership conflicts were detected")

        evidence = {"revision": revision, "summary": first, "passes_match": True}
        _finish_operation(db, operation_id, "completed", evidence)
        logger.info(
            "FREE_MVP_MAINTENANCE_COMPLETED operation_id=%s evidence=%s",
            operation_id,
            json.dumps(evidence, sort_keys=True),
        )
        return evidence
    except Exception as exc:
        db.rollback()
        if claimed:
            try:
                _finish_operation(db, operation_id, "failed", {"error_type": type(exc).__name__})
            except Exception:
                db.rollback()
        logger.critical(
            "FREE_MVP_MAINTENANCE_FAILED operation_id=%s error_type=%s",
            operation_id,
            type(exc).__name__,
        )
        if isinstance(exc, FreeMvpMaintenanceError):
            raise
        raise FreeMvpMaintenanceError("maintenance execution failed") from exc
    finally:
        db.close()
