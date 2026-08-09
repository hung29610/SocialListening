from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, Mock
import asyncio
import json

import pytest

from app.core import startup_state
from app.core import startup_orchestrator
from app.core import tenant_readiness_bootstrap as bootstrap
from app.services.tenant_reconciliation import ReconciliationSummary


@pytest.fixture(autouse=True)
def _restore_process_startup_state():
    original = startup_state.snapshot()
    yield
    with startup_state._lock:
        startup_state._state.clear()
        startup_state._state.update(original)


def _summary(**overrides):
    values = {
        "dry_run": True,
        "inspected": 4,
        "already_consistent": 4,
        "repairable": 0,
        "repaired": 0,
        "quarantined": 0,
        "reasons": {},
        "active_integrity_violations": 0,
        "ownership_conflicts": 0,
        "quarantined_legacy": 0,
    }
    values.update(overrides)
    return ReconciliationSummary(**values)


def _new_operation_db():
    db = MagicMock()
    db.execute.return_value.scalar_one_or_none.return_value = None
    db.get.return_value = None
    return db


def test_clean_bootstrap_runs_two_dry_runs_and_commits_ready(monkeypatch):
    db = _new_operation_db()
    calls = []
    monkeypatch.setattr(bootstrap, "_current_heads", lambda: (bootstrap.EXPECTED_REVISION,))
    monkeypatch.setattr(bootstrap, "SessionLocal", lambda: db)
    monkeypatch.setattr(bootstrap, "_claim_operation", lambda _db: True)
    monkeypatch.setattr(
        bootstrap,
        "reconcile_tenant_integrity",
        lambda *_args, **kwargs: calls.append(kwargs) or _summary(),
    )

    result = bootstrap.establish_tenant_readiness()

    assert result.ready is True
    assert result.reason_code == "READY"
    assert calls == [
        {"dry_run": True, "batch_size": 500},
        {"dry_run": True, "batch_size": 500},
    ]
    state = db.add.call_args.args[0]
    assert state.status == "ready"
    assert state.unresolved_count == 0
    assert state.details["passes_match"] is True
    db.commit.assert_called_once()


def test_quarantine_only_is_ready_without_mutation(monkeypatch):
    db = _new_operation_db()
    legacy = _summary(
        inspected=6046,
        already_consistent=0,
        quarantined=6046,
        reasons={"NO_PARENT_EVIDENCE": 6046},
        quarantined_legacy=6046,
    )
    monkeypatch.setattr(bootstrap, "_current_heads", lambda: (bootstrap.EXPECTED_REVISION,))
    monkeypatch.setattr(bootstrap, "SessionLocal", lambda: db)
    monkeypatch.setattr(bootstrap, "_claim_operation", lambda _db: True)
    monkeypatch.setattr(bootstrap, "reconcile_tenant_integrity", lambda *_a, **_k: legacy)

    result = bootstrap.establish_tenant_readiness()

    assert result.ready is True
    assert result.reason_code == "READY_WITH_QUARANTINE"
    assert result.quarantined_legacy == 6046
    assert result.active_integrity_violation == 0
    assert result.deterministic_repairable == 0
    assert result.ownership_conflict == 0


@pytest.mark.parametrize(
    ("summary", "reason"),
    [
        (_summary(repairable=1, already_consistent=3), "DETERMINISTIC_REPAIR_REQUIRED"),
        (
            _summary(
                quarantined=1,
                already_consistent=3,
                reasons={"SCOPE_CONFLICT": 1},
                ownership_conflicts=1,
            ),
            "OWNERSHIP_CONFLICT",
        ),
        (
            _summary(
                quarantined=1,
                already_consistent=3,
                reasons={"UNRECOGNIZED_REASON": 1},
                active_integrity_violations=1,
            ),
            "ACTIVE_INTEGRITY_VIOLATION",
        ),
    ],
)
def test_unsafe_tenant_states_are_persisted_blocked_without_apply(monkeypatch, summary, reason):
    db = _new_operation_db()
    monkeypatch.setattr(bootstrap, "_current_heads", lambda: (bootstrap.EXPECTED_REVISION,))
    monkeypatch.setattr(bootstrap, "SessionLocal", lambda: db)
    monkeypatch.setattr(bootstrap, "_claim_operation", lambda _db: True)
    monkeypatch.setattr(bootstrap, "reconcile_tenant_integrity", lambda *_a, **_k: summary)

    result = bootstrap.establish_tenant_readiness()

    assert result.ready is False
    assert result.status == "blocked"
    assert result.reason_code == reason
    db.commit.assert_called_once()


def test_differing_summaries_fail_closed_without_ready_ledger(monkeypatch):
    db = _new_operation_db()
    values = iter([_summary(), _summary(inspected=5, already_consistent=5)])
    monkeypatch.setattr(bootstrap, "_current_heads", lambda: (bootstrap.EXPECTED_REVISION,))
    monkeypatch.setattr(bootstrap, "SessionLocal", lambda: db)
    monkeypatch.setattr(bootstrap, "_claim_operation", lambda _db: True)
    monkeypatch.setattr(bootstrap, "reconcile_tenant_integrity", lambda *_a, **_k: next(values))

    result = bootstrap.establish_tenant_readiness()

    assert result == bootstrap.TenantReadinessResult("failed", "DRY_RUN_SUMMARIES_DIFFER")
    assert not any(
        getattr(call.args[0], "status", None) == "ready"
        for call in db.add.call_args_list
    )


def test_wrong_revision_never_opens_session(monkeypatch):
    session = Mock()
    monkeypatch.setattr(bootstrap, "_current_heads", lambda: ("7a8e2eb4683b",))
    monkeypatch.setattr(bootstrap, "SessionLocal", session)

    result = bootstrap.establish_tenant_readiness()

    assert result.reason_code == "MIGRATION_HEAD_MISMATCH"
    session.assert_not_called()


@pytest.mark.parametrize("status", ["succeeded", "blocked", "failed", "pending"])
def test_terminal_and_pending_operation_states_do_not_rerun(monkeypatch, status):
    db = MagicMock()
    db.execute.return_value.scalar_one_or_none.return_value = (
        '{"status":"%s","reason_code":"EXISTING"}' % status
    )
    db.get.return_value = SimpleNamespace(
        status="ready", unresolved_count=0, conflict_count=0
    )
    reconcile = Mock()
    monkeypatch.setattr(bootstrap, "_current_heads", lambda: (bootstrap.EXPECTED_REVISION,))
    monkeypatch.setattr(bootstrap, "SessionLocal", lambda: db)
    monkeypatch.setattr(bootstrap, "_claim_operation", lambda _db: False)
    monkeypatch.setattr(bootstrap, "reconcile_tenant_integrity", reconcile)

    result = bootstrap.establish_tenant_readiness()

    assert result.status == status
    reconcile.assert_not_called()


def test_orchestrator_blocks_tenant_workloads_without_killing_process(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setattr(startup_orchestrator, "_startup_singleton_lock", lambda: __import__("contextlib").nullcontext())
    monkeypatch.setattr(startup_orchestrator, "verify_exact_database_head", lambda _p: None)
    monkeypatch.setattr(startup_orchestrator, "run_verified_startup_migrations", lambda _p: "d72f8a913b21")
    monkeypatch.setattr(
        startup_orchestrator,
        "establish_tenant_readiness",
        lambda: bootstrap.TenantReadinessResult("blocked", "OWNERSHIP_CONFLICT"),
    )

    outcome = startup_orchestrator.run_startup_orchestrator(Path("backend"), "free_mvp_embedded")

    assert outcome.tenant_ready is False
    assert startup_state.snapshot()["status"] == "degraded"
    assert startup_state.tenant_workloads_allowed() is False


def test_exact_head_preflight_never_waits_on_superseded_generation_lock(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    migration_lock = Mock(side_effect=AssertionError("stale lock must not be entered"))
    migration_upgrade = Mock(side_effect=AssertionError("exact head must not be upgraded"))
    monkeypatch.setattr(startup_orchestrator, "_startup_singleton_lock", migration_lock)
    monkeypatch.setattr(
        startup_orchestrator,
        "verify_exact_database_head",
        lambda _p: "d72f8a913b21",
    )
    monkeypatch.setattr(
        startup_orchestrator,
        "run_verified_startup_migrations",
        migration_upgrade,
    )
    monkeypatch.setattr(
        startup_orchestrator,
        "establish_tenant_readiness",
        lambda: bootstrap.TenantReadinessResult("succeeded", "READY"),
    )

    outcome = startup_orchestrator.run_startup_orchestrator(
        Path("backend"), "free_mvp_embedded"
    )

    assert outcome == startup_orchestrator.StartupOutcome(
        "d72f8a913b21", True, "READY"
    )
    migration_lock.assert_not_called()
    migration_upgrade.assert_not_called()


def test_readiness_claim_is_single_atomic_insert():
    db = MagicMock()
    db.execute.return_value.scalar_one_or_none.return_value = bootstrap.OPERATION_KEY

    assert bootstrap._claim_operation(db) is True
    statement = str(db.execute.call_args.args[0])
    assert "ON CONFLICT (key) DO NOTHING" in statement
    assert "RETURNING key" in statement
    assert db.commit.call_count == 0


def test_migration_corruption_remains_startup_fatal(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setattr(startup_orchestrator, "_startup_singleton_lock", lambda: __import__("contextlib").nullcontext())
    monkeypatch.setattr(startup_orchestrator, "verify_exact_database_head", lambda _p: None)
    monkeypatch.setattr(
        startup_orchestrator,
        "run_verified_startup_migrations",
        Mock(side_effect=startup_orchestrator.StartupMigrationError("bounded")),
    )
    with pytest.raises(startup_orchestrator.StartupMigrationError):
        startup_orchestrator.run_startup_orchestrator(Path("backend"), "free_mvp_embedded")
    assert startup_state.snapshot()["reason_code"] == "MIGRATION_CONTRACT_FAILED"


def test_production_cannot_use_test_startup_bypass(monkeypatch):
    migration = Mock(return_value="d72f8a913b21")
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("RUN_MIGRATIONS_ON_STARTUP", "false")
    monkeypatch.setattr(startup_orchestrator, "_startup_singleton_lock", lambda: __import__("contextlib").nullcontext())
    monkeypatch.setattr(startup_orchestrator, "verify_exact_database_head", lambda _p: None)
    monkeypatch.setattr(startup_orchestrator, "run_verified_startup_migrations", migration)
    monkeypatch.setattr(
        startup_orchestrator,
        "establish_tenant_readiness",
        lambda: bootstrap.TenantReadinessResult("succeeded", "READY"),
    )
    outcome = startup_orchestrator.run_startup_orchestrator(Path("backend"), "free_mvp_embedded")
    assert outcome.migration_revision == "d72f8a913b21"
    migration.assert_called_once()


def test_public_state_contains_only_bounded_fields():
    startup_state.reset_for_startup("free_mvp_embedded")
    startup_state.set_migration_ready("d72f8a913b21")
    startup_state.set_tenant_readiness(False, "OWNERSHIP_CONFLICT")
    assert startup_state.public_snapshot()["release_contract"] == "startup-state-machine-v1"
    assert set(startup_state.public_snapshot()) == {
        "release_contract",
        "status",
        "database",
        "migration",
        "tenant_integrity",
        "runtime",
        "scheduler",
        "reason_code",
        "revision",
    }


def test_admin_readiness_evidence_is_bounded(monkeypatch):
    from app.api.system import get_startup_readiness

    db = MagicMock()
    db.get.return_value = SimpleNamespace(
        status="blocked",
        details={
            "reason_code": "DETERMINISTIC_REPAIR_REQUIRED",
            "dry_run_passes": 2,
            "passes_match": True,
            "classification": {
                "reason_code": "DETERMINISTIC_REPAIR_REQUIRED",
                "active_integrity_violation": 0,
                "deterministic_repairable": 3,
                "ownership_conflict": 0,
                "quarantined_legacy": 6046,
                "safe": 20,
                "operation_id": "must-not-leak",
            },
        },
    )
    result = get_startup_readiness(
        db=db,
        current_user=SimpleNamespace(is_superuser=True),
    )
    assert result["counts"] == {
        "active_integrity_violation": 0,
        "deterministic_repairable": 3,
        "ownership_conflict": 0,
        "quarantined_legacy": 6046,
        "safe": 20,
    }
    assert "operation_id" not in str(result)


def test_readiness_endpoint_is_503_while_tenant_bootstrap_is_blocked():
    from app.main import readiness_check

    startup_state.reset_for_startup("free_mvp_embedded")
    startup_state.set_migration_ready("d72f8a913b21")
    startup_state.set_tenant_readiness(False, "DETERMINISTIC_REPAIR_REQUIRED")
    response = readiness_check()
    payload = json.loads(response.body)
    assert response.status_code == 503
    assert payload["status"] == "not_ready"
    assert payload["reason_code"] == "DETERMINISTIC_REPAIR_REQUIRED"


def test_tenant_api_is_503_while_health_remains_exempt():
    from starlette.requests import Request
    from app.main import security_controls

    startup_state.reset_for_startup("free_mvp_embedded")
    startup_state.set_migration_ready("d72f8a913b21")
    startup_state.set_tenant_readiness(False, "OWNERSHIP_CONFLICT")
    called = Mock()

    async def next_response(_request):
        called()
        return SimpleNamespace(headers={})

    blocked = asyncio.run(
        security_controls(
            Request({"type": "http", "method": "GET", "path": "/api/mentions", "headers": [], "query_string": b"", "scheme": "http", "server": ("test", 80), "client": ("test", 1)}),
            next_response,
        )
    )
    assert blocked.status_code == 503
    called.assert_not_called()

    asyncio.run(
        security_controls(
            Request({"type": "http", "method": "GET", "path": "/health", "headers": [], "query_string": b"", "scheme": "http", "server": ("test", 80), "client": ("test", 1)}),
            next_response,
        )
    )
    called.assert_called_once()


def test_production_start_command_has_one_authoritative_path():
    render = (Path(__file__).parents[1] / "render.yaml").read_text(encoding="utf-8")
    assert "startCommand: uvicorn app.main:app" in render
    assert "bootstrap_production_migrations" not in render
    main = (Path(__file__).parents[1] / "app" / "main.py").read_text(encoding="utf-8")
    assert main.count("run_startup_orchestrator(") == 1
    assert "run_free_mvp_maintenance_if_enabled()" not in main


def test_no_reconciliation_apply_capability_in_bootstrap():
    source = (Path(__file__).parents[1] / "app" / "core" / "tenant_readiness_bootstrap.py").read_text(encoding="utf-8")
    assert "dry_run=True" in source
    assert "--apply" not in source
    assert "dry_run=False" not in source


def test_quarantine_isolation_contract_removes_null_tenant_fallbacks():
    root = Path(__file__).parents[1] / "app"
    assistant = (root / "services" / "ai_assistant_service.py").read_text(encoding="utf-8")
    pipeline = (root / "tasks" / "scan_pipeline.py").read_text(encoding="utf-8")
    scheduler = (root / "services" / "scheduler_service.py").read_text(encoding="utf-8")
    realtime = (root / "api" / "realtime.py").read_text(encoding="utf-8")
    assert "model.organization_id.is_(None)" not in assistant
    assert "model.user_id.is_(None)" not in assistant
    assert '"status": "tenant_scope_blocked"' in pipeline
    assert "source tenant scope is unavailable" in scheduler
    assert "Source.organization_id.is_not(None)" in scheduler
    assert "Source.user_id.is_not(None)" in scheduler
    assert "ScanSchedule.organization_id.is_not(None)" in scheduler
    assert "ScanSchedule.user_id.is_not(None)" in scheduler
    assert "startup_state.tenant_workloads_allowed()" in realtime
    assert "application_not_ready" in realtime
