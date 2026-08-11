"""Process-local, bounded liveness/readiness state.

This module deliberately contains no database or environment details.  It is
safe to expose through public health endpoints.
"""

from __future__ import annotations

from copy import deepcopy
from threading import RLock

from app.core.ownership import TenantReason


RELEASE_CONTRACT = "startup-state-machine-v1"
_SAFE_BLOCKING_REASON_CLASSES = frozenset(reason.value for reason in TenantReason)
_lock = RLock()
_state = {
    "enforced": False,
    "status": "starting",
    "database": "unknown",
    "migration": "not_ready",
    "tenant_integrity": "blocked",
    "runtime": "disabled",
    "scheduler": "inactive",
    "reason_code": "STARTUP_NOT_RUN",
    "revision": None,
    "readiness_policy_version": "unknown",
    "blocking_reason_classes": [],
    "quarantine_eligible": False,
    "conflicting_owner_fields_present": False,
    "deterministic_repair_available": False,
}


def reset_for_startup(runtime: str) -> None:
    with _lock:
        _state.update(
            enforced=True,
            status="starting",
            database="unknown",
            migration="not_ready",
            tenant_integrity="blocked",
            runtime=runtime,
            scheduler="inactive",
            reason_code="STARTUP_IN_PROGRESS",
            revision=None,
            readiness_policy_version="unknown",
            blocking_reason_classes=[],
            quarantine_eligible=False,
            conflicting_owner_fields_present=False,
            deterministic_repair_available=False,
        )


def set_migration_ready(revision: str) -> None:
    with _lock:
        _state.update(
            database="connected",
            migration="ready",
            reason_code="TENANT_READINESS_PENDING",
            revision=revision,
        )


def set_migration_failed(reason_code: str) -> None:
    with _lock:
        _state.update(
            status="failed",
            database="unknown",
            migration="not_ready",
            tenant_integrity="blocked",
            scheduler="inactive",
            reason_code=reason_code,
        )


def set_tenant_readiness(
    ready: bool,
    reason_code: str,
    *,
    readiness_policy_version: str = "unknown",
    blocking_reason_classes=(),
    quarantine_eligible: bool = False,
    conflicting_owner_fields_present: bool = False,
    deterministic_repair_available: bool = False,
) -> None:
    safe_reason_classes = sorted(
        {
            value
            for value in blocking_reason_classes
            if isinstance(value, str) and value in _SAFE_BLOCKING_REASON_CLASSES
        }
    )
    with _lock:
        _state.update(
            status="ready" if ready else "degraded",
            tenant_integrity="ready" if ready else "blocked",
            scheduler="inactive",
            reason_code=reason_code,
            readiness_policy_version=(
                readiness_policy_version
                if readiness_policy_version in {"v6", "test"}
                else "unknown"
            ),
            blocking_reason_classes=safe_reason_classes,
            quarantine_eligible=bool(quarantine_eligible),
            conflicting_owner_fields_present=bool(
                conflicting_owner_fields_present
            ),
            deterministic_repair_available=bool(
                deterministic_repair_available
            ),
        )


def set_scheduler(active: bool, reason_code: str | None = None) -> None:
    with _lock:
        _state["scheduler"] = "active" if active else "inactive"
        if reason_code:
            _state["reason_code"] = reason_code


def mark_complete() -> None:
    with _lock:
        if _state["tenant_integrity"] == "ready":
            _state["status"] = "ready"
            _state["reason_code"] = "READY"


def snapshot() -> dict:
    with _lock:
        return deepcopy(_state)


def tenant_workloads_allowed() -> bool:
    with _lock:
        return not _state["enforced"] or (
            _state["migration"] == "ready"
            and _state["tenant_integrity"] == "ready"
        )


def public_snapshot() -> dict:
    state = snapshot()
    return {
        "release_contract": RELEASE_CONTRACT,
        "status": state["status"],
        "database": state["database"],
        "migration": state["migration"],
        "tenant_integrity": state["tenant_integrity"],
        "runtime": state["runtime"],
        "scheduler": state["scheduler"],
        "reason_code": state["reason_code"],
        "revision": state["revision"],
    }


def public_readiness_snapshot() -> dict:
    """Expose only the fixed, non-sensitive readiness diagnostic contract."""
    state = snapshot()
    return {
        "release_contract": RELEASE_CONTRACT,
        "status": state["status"],
        "database": state["database"],
        "migration": state["migration"],
        "tenant_integrity": state["tenant_integrity"],
        "runtime": state["runtime"],
        "scheduler": state["scheduler"],
        "reason_code": state["reason_code"],
        "revision": state["revision"],
        "readiness_policy_version": state["readiness_policy_version"],
        "blocking_reason_classes": state["blocking_reason_classes"],
        "quarantine_eligible": state["quarantine_eligible"],
        "conflicting_owner_fields_present": state[
            "conflicting_owner_fields_present"
        ],
        "deterministic_repair_available": state[
            "deterministic_repair_available"
        ],
    }
