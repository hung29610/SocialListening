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


def test_quarantine_safe_ambiguity_is_ready_but_unsafe_conflict_is_not():
    safe = _summary(
        inspected=2,
        already_consistent=1,
        quarantined=1,
        reasons={"MULTIPLE_ORGANIZATION_CANDIDATES": 1},
        quarantined_legacy=1,
    )
    unsafe = _summary(
        inspected=2,
        already_consistent=1,
        quarantined=1,
        reasons={"MULTIPLE_ORGANIZATION_CANDIDATES": 1},
        ownership_conflicts=1,
        blocking_reason_classes=["MULTIPLE_ORGANIZATION_CANDIDATES"],
        conflicting_owner_fields_present=True,
    )

    safe_result = bootstrap._classify(bootstrap._normalize(safe))
    unsafe_result = bootstrap._classify(bootstrap._normalize(unsafe))

    assert safe_result.ready is True
    assert safe_result.reason_code == "READY_WITH_QUARANTINE"
    assert safe_result.quarantine_eligible is True
    assert safe_result.conflicting_owner_fields_present is False
    assert unsafe_result.ready is False
    assert unsafe_result.reason_code == "OWNERSHIP_CONFLICT"
    assert unsafe_result.blocking_reason_classes == (
        "MULTIPLE_ORGANIZATION_CANDIDATES",
    )
    assert unsafe_result.quarantine_eligible is False
    assert unsafe_result.conflicting_owner_fields_present is True


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
    db.execute.return_value.scalar_one_or_none.return_value = json.dumps(
        {
            "status": status,
            "reason_code": "EXISTING",
            "readiness_policy_version": "v5",
            "blocking_reason_classes": [],
            "quarantine_eligible": False,
            "conflicting_owner_fields_present": False,
            "deterministic_repair_available": False,
        }
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


def test_readiness_v5_contract_does_not_reuse_retired_operations():
    assert bootstrap.OPERATION_VERSION == "v5"
    assert bootstrap.OPERATION_KEY.endswith(":v5")
    assert bootstrap.RETIRED_OPERATION_KEYS == (
        f"tenant-readiness-bootstrap:{bootstrap.EXPECTED_REVISION}:v1",
        f"tenant-readiness-bootstrap:{bootstrap.EXPECTED_REVISION}:v2",
        f"tenant-readiness-bootstrap:{bootstrap.EXPECTED_REVISION}:v3",
        f"tenant-readiness-bootstrap:{bootstrap.EXPECTED_REVISION}:v4",
    )
    assert bootstrap.OPERATION_KEY not in bootstrap.RETIRED_OPERATION_KEYS


def test_postgres_readiness_claim_has_bounded_lock_wait():
    db = MagicMock()
    db.get_bind.return_value.dialect.name = "postgresql"
    insert_result = MagicMock()
    insert_result.scalar_one_or_none.return_value = bootstrap.OPERATION_KEY
    db.execute.side_effect = [MagicMock(), insert_result]

    assert bootstrap._claim_operation(db) is True
    assert str(db.execute.call_args_list[0].args[0]) == "SET LOCAL lock_timeout = '10s'"
    assert "ON CONFLICT (key) DO NOTHING" in str(db.execute.call_args_list[1].args[0])


def test_claim_failure_cannot_overwrite_an_existing_terminal_operation(monkeypatch):
    db = MagicMock()
    monkeypatch.setattr(bootstrap, "_current_heads", lambda: (bootstrap.EXPECTED_REVISION,))
    monkeypatch.setattr(bootstrap, "SessionLocal", lambda: db)
    monkeypatch.setattr(
        bootstrap,
        "_claim_operation",
        Mock(side_effect=RuntimeError("bounded claim failure")),
    )
    store = Mock()
    monkeypatch.setattr(bootstrap, "_store_operation", store)

    result = bootstrap.establish_tenant_readiness()

    assert result.reason_code == "BOOTSTRAP_CLAIM_RUNTIMEERROR"
    store.assert_not_called()
    db.commit.assert_not_called()


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


def test_public_readiness_state_contains_only_bounded_fields():
    startup_state.reset_for_startup("free_mvp_embedded")
    startup_state.set_migration_ready("d72f8a913b21")
    startup_state.set_tenant_readiness(
        False,
        "OWNERSHIP_CONFLICT",
        readiness_policy_version="v5",
        blocking_reason_classes=(
            "SCOPE_CONFLICT",
            "must-not-leak@example.invalid",
        ),
        quarantine_eligible=False,
        conflicting_owner_fields_present=True,
        deterministic_repair_available=False,
    )
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
    snapshot = startup_state.public_readiness_snapshot()
    assert set(snapshot) == {
        *startup_state.public_snapshot().keys(),
        "readiness_policy_version",
        "blocking_reason_classes",
        "quarantine_eligible",
        "conflicting_owner_fields_present",
        "deterministic_repair_available",
    }
    assert snapshot["readiness_policy_version"] == "v5"
    assert snapshot["blocking_reason_classes"] == ["SCOPE_CONFLICT"]
    assert snapshot["quarantine_eligible"] is False
    assert snapshot["conflicting_owner_fields_present"] is True
    assert snapshot["deterministic_repair_available"] is False
    serialized = json.dumps(snapshot, sort_keys=True)
    assert "must-not-leak" not in serialized
    for forbidden in (
        "count",
        "tenant_id",
        "row_id",
        "email",
        "url",
        "content",
        "operation_id",
        "secret",
    ):
        assert forbidden not in serialized.lower()


def test_v5_operation_payload_round_trip_is_bounded():
    result = bootstrap._result_from_payload(
        {
            "status": "blocked",
            "reason_code": "OWNERSHIP_CONFLICT",
            "readiness_policy_version": "v5",
            "blocking_reason_classes": ["SCOPE_CONFLICT"],
            "quarantine_eligible": False,
            "conflicting_owner_fields_present": True,
            "deterministic_repair_available": False,
        }
    )
    assert result.status == "blocked"
    assert result.blocking_reason_classes == ("SCOPE_CONFLICT",)
    assert result.conflicting_owner_fields_present is True

    rejected = bootstrap._result_from_payload(
        {
            "status": "blocked",
            "reason_code": "OWNERSHIP_CONFLICT",
            "readiness_policy_version": "v5",
            "blocking_reason_classes": ["tenant-123"],
        }
    )
    assert rejected.reason_code == "INVALID_OPERATION_STATE"

    incomplete = bootstrap._result_from_payload(
        {
            "status": "blocked",
            "reason_code": "OWNERSHIP_CONFLICT",
            "readiness_policy_version": "v5",
        }
    )
    assert incomplete.reason_code == "INVALID_OPERATION_STATE"


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
    startup_state.set_tenant_readiness(
        False,
        "DETERMINISTIC_REPAIR_REQUIRED",
        readiness_policy_version="v5",
        blocking_reason_classes=(),
        quarantine_eligible=False,
        conflicting_owner_fields_present=False,
        deterministic_repair_available=True,
    )
    response = readiness_check()
    payload = json.loads(response.body)
    assert response.status_code == 503
    assert payload["status"] == "not_ready"
    assert payload["reason_code"] == "DETERMINISTIC_REPAIR_REQUIRED"
    assert payload["readiness_policy_version"] == "v5"
    assert payload["blocking_reason_classes"] == []
    assert payload["quarantine_eligible"] is False
    assert payload["conflicting_owner_fields_present"] is False
    assert payload["deterministic_repair_available"] is True
    assert set(payload) == {
        "release_contract",
        "status",
        "database",
        "migration",
        "tenant_integrity",
        "runtime",
        "scheduler",
        "reason_code",
        "revision",
        "readiness_policy_version",
        "blocking_reason_classes",
        "quarantine_eligible",
        "conflicting_owner_fields_present",
        "deterministic_repair_available",
    }


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
    tenant = (root / "core" / "tenant.py").read_text(encoding="utf-8")
    workers = (root / "workers" / "tasks.py").read_text(encoding="utf-8")
    reports = (root / "services" / "report_service.py").read_text(encoding="utf-8")
    alerts = (root / "api" / "alerts.py").read_text(encoding="utf-8")
    dashboard = (root / "api" / "dashboard.py").read_text(encoding="utf-8")
    report_api = (root / "api" / "reports.py").read_text(encoding="utf-8")
    exports = (root / "services" / "export_service.py").read_text(encoding="utf-8")
    monitor = (root / "api" / "monitor.py").read_text(encoding="utf-8")
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
    assert "direct_scope_predicates(model)" in tenant
    assert workers.count("has_complete_direct_scope") >= 4
    assert "Mention.organization_id == report.organization_id" in reports
    assert "Alert.organization_id == report.organization_id" in reports
    assert "Alert.organization_id == mention_scope.organization_id" in alerts
    assert "apply_tenant_filter" in dashboard
    assert "apply_tenant_filter" in report_api
    assert "apply_tenant_filter(select(Mention), Mention, current_user)" in exports
    assert "apply_tenant_filter(select(Alert), Alert, current_user)" in exports
    assert monitor.count("apply_tenant_filter(select(Mention), Mention, current_user)") >= 2
