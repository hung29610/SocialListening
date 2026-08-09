import importlib.util
from pathlib import Path
from unittest.mock import Mock

import pytest


def _load_revision():
    path = (
        Path(__file__).parents[1]
        / "alembic"
        / "versions"
        / "d72f8a913b21_add_mention_feed_cursor_indexes.py"
    )
    spec = importlib.util.spec_from_file_location("mention_index_revision", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _inspector(revision, *, mismatch=False):
    indexes = [
        {"name": name, "column_names": list(columns), "unique": False}
        for name, columns in revision.EXPECTED_INDEXES.items()
    ]
    if mismatch:
        indexes[0]["column_names"] = ["id"]
    inspector = Mock()
    inspector.get_indexes.return_value = indexes
    return inspector


def test_existing_exact_indexes_are_verified_without_rebuild(monkeypatch, caplog):
    revision = _load_revision()
    scalar = Mock()
    scalar.scalar_one_or_none.return_value = True
    connection = Mock()
    connection.execute.return_value = scalar
    inspector = _inspector(revision)
    monkeypatch.setattr(revision.op, "get_bind", lambda: connection)
    monkeypatch.setattr(revision.sa, "inspect", lambda _bind: inspector)
    execute = Mock()
    monkeypatch.setattr(revision.op, "execute", execute)

    with caplog.at_level("WARNING"):
        revision.upgrade()

    statements = [call.args[0] for call in execute.call_args_list]
    assert statements == [
        "SET LOCAL lock_timeout = '15s'",
        "SET LOCAL statement_timeout = '60s'",
    ]
    assert "MENTION_CURSOR_INDEX_CONTRACT status=verified index_count=3" in caplog.text


def test_malformed_valid_index_fails_before_rebuild(monkeypatch, caplog):
    revision = _load_revision()
    scalar = Mock()
    scalar.scalar_one_or_none.return_value = True
    connection = Mock()
    connection.execute.return_value = scalar
    monkeypatch.setattr(revision.op, "get_bind", lambda: connection)
    monkeypatch.setattr(revision.sa, "inspect", lambda _bind: _inspector(revision, mismatch=True))
    execute = Mock()
    monkeypatch.setattr(revision.op, "execute", execute)

    with caplog.at_level("CRITICAL"), pytest.raises(
        revision.MentionIndexContractError
    ):
        revision.upgrade()

    assert "reason=INDEX_CONTRACT_MISMATCH" in caplog.text
    assert all("CREATE INDEX" not in call.args[0] for call in execute.call_args_list)


def test_revision_contains_no_concurrent_ddl():
    source = Path(_load_revision().__file__).read_text(encoding="utf-8")
    assert "op.execute(f'CREATE INDEX CONCURRENTLY" not in source
    assert "DROP INDEX CONCURRENTLY IF EXISTS" not in source
