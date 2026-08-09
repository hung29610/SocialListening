# Runtime release contract: startup-state-machine-v1.
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.core.security_operations import get_enabled_superuser
from app.core import startup_state
from app.models.tenant_integrity import TenantIntegrityAuditState
from app.models.user import User
from app.services.component_health import collect_component_health


router = APIRouter()


@router.get("/worker-status")
def get_worker_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Return independently evidenced web, broker, worker, Beat, and pipeline state."""
    return collect_component_health(db)


@router.get("/startup-readiness")
def get_startup_readiness(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_enabled_superuser),
):
    """Return bounded aggregate evidence to an authenticated super-admin."""
    state = db.get(TenantIntegrityAuditState, 1)
    details = dict(getattr(state, "details", None) or {})
    classification = dict(details.get("classification") or {})
    allowed_counts = {
        key: int(classification.get(key, 0) or 0)
        for key in (
            "active_integrity_violation",
            "deterministic_repairable",
            "ownership_conflict",
            "quarantined_legacy",
            "safe",
        )
    }
    process = startup_state.public_snapshot()
    return {
        "status": getattr(state, "status", "missing"),
        "reason_code": classification.get(
            "reason_code", details.get("reason_code", process["reason_code"])
        ),
        "migration": process["migration"],
        "tenant_integrity": process["tenant_integrity"],
        "counts": allowed_counts,
        "dry_run_passes": int(details.get("dry_run_passes", 0) or 0),
        "passes_match": bool(details.get("passes_match", False)),
    }
