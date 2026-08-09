"""Process-local, bounded liveness/readiness state.

This module deliberately contains no database or environment details.  It is
safe to expose through public health endpoints.
"""

from __future__ import annotations

from copy import deepcopy
from threading import RLock


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


def set_tenant_readiness(ready: bool, reason_code: str) -> None:
    with _lock:
        _state.update(
            status="ready" if ready else "degraded",
            tenant_integrity="ready" if ready else "blocked",
            scheduler="inactive",
            reason_code=reason_code,
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
        "status": state["status"],
        "database": state["database"],
        "migration": state["migration"],
        "tenant_integrity": state["tenant_integrity"],
        "runtime": state["runtime"],
        "scheduler": state["scheduler"],
        "reason_code": state["reason_code"],
        "revision": state["revision"],
    }
