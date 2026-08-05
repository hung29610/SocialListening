from pathlib import Path
from unittest.mock import ANY, Mock, call

import pytest

from app.core import migration_startup
from app.core import free_mvp_maintenance


def _script_with_heads(*heads: str) -> Mock:
    script = Mock()
    script.get_heads.return_value = heads
    return script


def test_verified_startup_migrations_repairs_stranded_split(monkeypatch):
    monkeypatch.setattr(
        migration_startup.ScriptDirectory,
        "from_config",
        Mock(return_value=_script_with_heads(migration_startup.EXPECTED_REVISION)),
    )
    upgrade = Mock()
    monkeypatch.setattr(migration_startup.command, "upgrade", upgrade)
    heads = iter(
        [
            (migration_startup.STRANDED_REVISION,),
            tuple(
                sorted(
                    (
                        migration_startup.STRANDED_REVISION,
                        migration_startup.MISSING_SIBLING_REVISION,
                    )
                )
            ),
            (migration_startup.EXPECTED_REVISION,),
        ]
    )
    monkeypatch.setattr(migration_startup, "_database_heads", lambda: next(heads))

    result = migration_startup.run_verified_startup_migrations(Path("backend"))

    assert result == migration_startup.EXPECTED_REVISION
    assert upgrade.call_args_list == [
        call(ANY, "head"),
        call(ANY, migration_startup.MISSING_SIBLING_REVISION),
        call(ANY, "head"),
    ]


def test_verified_startup_migrations_does_not_repair_normal_head(monkeypatch):
    monkeypatch.setattr(
        migration_startup.ScriptDirectory,
        "from_config",
        Mock(return_value=_script_with_heads(migration_startup.EXPECTED_REVISION)),
    )
    upgrade = Mock()
    monkeypatch.setattr(migration_startup.command, "upgrade", upgrade)
    monkeypatch.setattr(
        migration_startup,
        "_database_heads",
        lambda: (migration_startup.EXPECTED_REVISION,),
    )

    migration_startup.run_verified_startup_migrations(Path("backend"))

    assert upgrade.call_args_list == [call(ANY, "head")]


def test_verified_startup_migrations_rejects_repository_head_mismatch(monkeypatch):
    monkeypatch.setattr(
        migration_startup.ScriptDirectory,
        "from_config",
        Mock(return_value=_script_with_heads("unexpected")),
    )
    upgrade = Mock()
    monkeypatch.setattr(migration_startup.command, "upgrade", upgrade)

    with pytest.raises(migration_startup.StartupMigrationError):
        migration_startup.run_verified_startup_migrations(Path("backend"))

    upgrade.assert_not_called()


def test_verified_startup_migrations_rejects_unexpected_database_revision(monkeypatch):
    monkeypatch.setattr(
        migration_startup.ScriptDirectory,
        "from_config",
        Mock(return_value=_script_with_heads(migration_startup.EXPECTED_REVISION)),
    )
    monkeypatch.setattr(migration_startup.command, "upgrade", Mock())
    monkeypatch.setattr(migration_startup, "_database_heads", lambda: ("unexpected",))

    with pytest.raises(migration_startup.StartupMigrationError):
        migration_startup.run_verified_startup_migrations(Path("backend"))


def test_verified_startup_migration_exception_propagates(monkeypatch):
    monkeypatch.setattr(
        migration_startup.ScriptDirectory,
        "from_config",
        Mock(return_value=_script_with_heads(migration_startup.EXPECTED_REVISION)),
    )
    monkeypatch.setattr(
        migration_startup.command,
        "upgrade",
        Mock(side_effect=RuntimeError("redacted migration failure")),
    )

    with pytest.raises(RuntimeError, match="redacted migration failure"):
        migration_startup.run_verified_startup_migrations(Path("backend"))


def test_startup_source_orders_verified_migrations_before_maintenance():
    source = (Path(__file__).parents[1] / "app" / "main.py").read_text(encoding="utf-8")
    assert source.index("run_verified_startup_migrations(backend_dir)") < source.index(
        "run_free_mvp_maintenance_if_enabled()"
    )
    assert "create_all skipped" not in source


def test_consumed_maintenance_operation_id_cannot_rerun():
    db = Mock()
    db.execute.return_value.first.return_value = None

    with pytest.raises(
        free_mvp_maintenance.FreeMvpMaintenanceError,
        match="already consumed",
    ):
        free_mvp_maintenance._claim_operation(db, "consumed-operation")

    db.commit.assert_called_once()


def test_maintenance_contract_has_no_apply_path_and_keeps_revision_guard():
    source = (
        Path(__file__).parents[1] / "app" / "core" / "free_mvp_maintenance.py"
    ).read_text(encoding="utf-8")
    assert "dry_run=True" in source
    assert "--apply" not in source
    assert "database revision does not match the approved revision" in source
    assert free_mvp_maintenance.EXPECTED_REVISION == migration_startup.EXPECTED_REVISION
