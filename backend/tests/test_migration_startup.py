from pathlib import Path
from unittest.mock import ANY, Mock, call

import pytest

from app.core import free_mvp_maintenance, migration_startup
from app.scripts import bootstrap_production_migrations


def _revision(revision: str, down_revision):
    item = Mock()
    item.revision = revision
    item.down_revision = down_revision
    return item


def _script_with_valid_lineage() -> Mock:
    script = Mock()
    script.get_heads.return_value = [migration_startup.EXPECTED_REVISION]
    revisions = {
        migration_startup.STRANDED_REVISION: _revision(
            migration_startup.STRANDED_REVISION,
            migration_startup.BRANCHPOINT_REVISION,
        ),
        migration_startup.MISSING_SIBLING_REVISION: _revision(
            migration_startup.MISSING_SIBLING_REVISION,
            migration_startup.BRANCHPOINT_REVISION,
        ),
        migration_startup.MERGE_REVISION: _revision(
            migration_startup.MERGE_REVISION,
            (
                migration_startup.MISSING_SIBLING_REVISION,
                migration_startup.STRANDED_REVISION,
            ),
        ),
    }
    script.get_revision.side_effect = revisions.get
    script.iterate_revisions.return_value = [
        _revision(migration_startup.EXPECTED_REVISION, "parent"),
        revisions[migration_startup.MERGE_REVISION],
    ]
    return script


def _install_script(monkeypatch, script=None):
    script = script or _script_with_valid_lineage()
    monkeypatch.setattr(
        migration_startup.ScriptDirectory,
        "from_config",
        Mock(return_value=script),
    )
    return script


def test_exact_stranded_state_repairs_before_normal_upgrade(monkeypatch):
    _install_script(monkeypatch)
    upgrade = Mock()
    monkeypatch.setattr(migration_startup.command, "upgrade", upgrade)
    heads = iter(
        [
            (migration_startup.STRANDED_REVISION,),
            tuple(sorted((migration_startup.STRANDED_REVISION, migration_startup.MISSING_SIBLING_REVISION))),
            (migration_startup.EXPECTED_REVISION,),
        ]
    )
    monkeypatch.setattr(migration_startup, "_database_heads", lambda: next(heads))

    result = migration_startup.run_verified_startup_migrations(Path("backend"))

    assert result == migration_startup.EXPECTED_REVISION
    assert upgrade.call_args_list == [
        call(ANY, migration_startup.MISSING_SIBLING_REVISION),
        call(ANY, "head"),
    ]


def test_normal_current_database_is_noop_before_normal_upgrade(monkeypatch):
    _install_script(monkeypatch)
    upgrade = Mock()
    monkeypatch.setattr(migration_startup.command, "upgrade", upgrade)
    monkeypatch.setattr(
        migration_startup,
        "_database_heads",
        lambda: (migration_startup.EXPECTED_REVISION,),
    )

    migration_startup.run_verified_startup_migrations(Path("backend"))

    assert upgrade.call_args_list == [call(ANY, "head")]


@pytest.mark.parametrize(
    "heads",
    [
        ("unknown",),
        tuple(sorted((migration_startup.STRANDED_REVISION, migration_startup.MISSING_SIBLING_REVISION))),
    ],
)
def test_unknown_or_partial_sibling_state_fails_closed(monkeypatch, heads):
    _install_script(monkeypatch)
    upgrade = Mock()
    monkeypatch.setattr(migration_startup.command, "upgrade", upgrade)
    monkeypatch.setattr(migration_startup, "_database_heads", lambda: heads)

    with pytest.raises(migration_startup.StartupMigrationError):
        migration_startup.run_verified_startup_migrations(Path("backend"))

    upgrade.assert_not_called()


def test_repository_graph_mismatch_fails_closed(monkeypatch):
    script = _script_with_valid_lineage()
    script.get_revision(migration_startup.MERGE_REVISION).down_revision = ("unexpected",)
    _install_script(monkeypatch, script)
    upgrade = Mock()
    monkeypatch.setattr(migration_startup.command, "upgrade", upgrade)

    with pytest.raises(migration_startup.StartupMigrationError):
        migration_startup.run_verified_startup_migrations(Path("backend"))

    upgrade.assert_not_called()


def test_final_revision_mismatch_fails_closed(monkeypatch):
    _install_script(monkeypatch)
    monkeypatch.setattr(migration_startup.command, "upgrade", Mock())
    heads = iter(
        [
            (migration_startup.STRANDED_REVISION,),
            tuple(sorted((migration_startup.STRANDED_REVISION, migration_startup.MISSING_SIBLING_REVISION))),
            ("unexpected-final",),
        ]
    )
    monkeypatch.setattr(migration_startup, "_database_heads", lambda: next(heads))

    with pytest.raises(migration_startup.StartupMigrationError):
        migration_startup.run_verified_startup_migrations(Path("backend"))


def test_bootstrap_failure_prevents_uvicorn_startup():
    render = (Path(__file__).parents[1] / "render.yaml").read_text(encoding="utf-8")
    command_line = next(line.strip() for line in render.splitlines() if "startCommand:" in line)
    assert "python -m app.scripts.bootstrap_production_migrations && uvicorn" in command_line
    assert "alembic upgrade head && uvicorn" not in command_line


def test_bootstrap_failure_emits_only_redacted_error_type(monkeypatch, caplog):
    monkeypatch.setattr(
        bootstrap_production_migrations,
        "run_verified_startup_migrations",
        Mock(side_effect=RuntimeError("credential-shaped-sensitive-detail")),
    )
    with caplog.at_level("CRITICAL"), pytest.raises(SystemExit) as exc_info:
        bootstrap_production_migrations.main()
    assert exc_info.value.code == 3
    assert "RuntimeError" in caplog.text
    assert "credential-shaped-sensitive-detail" not in caplog.text


def test_maintenance_runs_only_after_verified_migrations():
    source = (Path(__file__).parents[1] / "app" / "main.py").read_text(encoding="utf-8")
    assert source.index("run_verified_startup_migrations(backend_dir)") < source.index(
        "run_free_mvp_maintenance_if_enabled()"
    )


def test_consumed_maintenance_operation_id_cannot_rerun():
    db = Mock()
    db.execute.return_value.first.return_value = None
    with pytest.raises(free_mvp_maintenance.FreeMvpMaintenanceError, match="already consumed"):
        free_mvp_maintenance._claim_operation(db, "consumed-operation")
    db.commit.assert_called_once()


def test_maintenance_contract_has_no_apply_path_and_keeps_revision_guard():
    source = (Path(__file__).parents[1] / "app" / "core" / "free_mvp_maintenance.py").read_text(encoding="utf-8")
    assert "dry_run=True" in source
    assert "--apply" not in source
    assert "database revision does not match the approved revision" in source
    assert free_mvp_maintenance.EXPECTED_REVISION == migration_startup.EXPECTED_REVISION
