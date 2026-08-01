"""Bounded startup signal for the most recent explicit tenant audit."""
import logging
import os

from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal

logger = logging.getLogger(__name__)


def check_tenant_integrity_readiness() -> bool:
    """Read at most one audit-state row; never scan production tables at startup."""
    from app.models.tenant_integrity import TenantIntegrityAuditState

    db = SessionLocal()
    try:
        state = db.get(TenantIntegrityAuditState, 1)
        ready = bool(state and state.status == "ready" and state.unresolved_count == 0 and state.conflict_count == 0)
        if not ready:
            logger.critical(
                "TENANT_INTEGRITY_NOT_READY status=%s unresolved=%s conflicts=%s",
                getattr(state, "status", "missing"),
                getattr(state, "unresolved_count", "unknown"),
                getattr(state, "conflict_count", "unknown"),
            )
        return ready
    except SQLAlchemyError as exc:
        db.rollback()
        logger.critical("TENANT_INTEGRITY_READINESS_UNAVAILABLE error_type=%s", type(exc).__name__)
        return False
    finally:
        db.close()


def enforce_tenant_integrity_readiness() -> None:
    ready = check_tenant_integrity_readiness()
    if not ready and os.getenv("TENANT_INTEGRITY_REQUIRE_READY", "false").lower() == "true":
        raise RuntimeError("Tenant integrity readiness check failed")
