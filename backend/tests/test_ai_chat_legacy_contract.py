from unittest.mock import Mock

import pytest
import sqlalchemy as sa


def _load_revision():
    import importlib.util
    from pathlib import Path

    path = (
        Path(__file__).parents[1]
        / "alembic"
        / "versions"
        / "7c2e4d6b8a91_add_ai_chat_messages.py"
    )
    spec = importlib.util.spec_from_file_location("ai_chat_revision", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _exact_inspector():
    inspector = Mock()
    inspector.get_table_names.return_value = ["ai_chat_messages"]
    inspector.get_columns.return_value = [
        {"name": "id", "type": sa.Integer(), "nullable": False},
        {"name": "organization_id", "type": sa.Integer(), "nullable": True},
        {"name": "user_id", "type": sa.Integer(), "nullable": False},
        {"name": "role", "type": sa.String(20), "nullable": False},
        {"name": "content", "type": sa.Text(), "nullable": False},
        {"name": "provider", "type": sa.String(50), "nullable": True},
        {"name": "model", "type": sa.String(255), "nullable": True},
        {"name": "used_tools", "type": sa.JSON(), "nullable": True},
        {"name": "error_message", "type": sa.Text(), "nullable": True},
        {
            "name": "created_at",
            "type": sa.DateTime(timezone=True),
            "nullable": False,
            "default": "now()",
        },
    ]
    inspector.get_pk_constraint.return_value = {"constrained_columns": ["id"]}
    inspector.get_indexes.return_value = [
        {"name": name, "column_names": list(columns), "unique": False}
        for name, columns in _load_revision().EXPECTED_INDEXES.items()
    ]
    inspector.get_foreign_keys.return_value = [
        {
            "constrained_columns": ["organization_id"],
            "referred_table": "organizations",
            "referred_columns": ["id"],
            "options": {"ondelete": "CASCADE"},
        },
        {
            "constrained_columns": ["user_id"],
            "referred_table": "users",
            "referred_columns": ["id"],
            "options": {"ondelete": "CASCADE"},
        },
    ]
    return inspector


def test_exact_existing_ai_chat_table_is_accepted_without_ddl(monkeypatch, caplog):
    revision = _load_revision()
    inspector = _exact_inspector()
    monkeypatch.setattr(revision.sa, "inspect", lambda _bind: inspector)
    monkeypatch.setattr(revision.op, "get_bind", lambda: object())
    create_table = Mock()
    create_index = Mock()
    monkeypatch.setattr(revision.op, "create_table", create_table)
    monkeypatch.setattr(revision.op, "create_index", create_index)

    with caplog.at_level("WARNING"):
        revision.upgrade()

    create_table.assert_not_called()
    create_index.assert_not_called()
    assert "AI_CHAT_SCHEMA_CONTRACT status=verified" in caplog.text


def test_mismatched_existing_ai_chat_table_fails_before_ddl(monkeypatch, caplog):
    revision = _load_revision()
    inspector = _exact_inspector()
    inspector.get_indexes.return_value = inspector.get_indexes.return_value[:-1]
    monkeypatch.setattr(revision.sa, "inspect", lambda _bind: inspector)
    monkeypatch.setattr(revision.op, "get_bind", lambda: object())
    create_table = Mock()
    create_index = Mock()
    monkeypatch.setattr(revision.op, "create_table", create_table)
    monkeypatch.setattr(revision.op, "create_index", create_index)

    with caplog.at_level("CRITICAL"), pytest.raises(
        revision.AIChatSchemaContractError
    ):
        revision.upgrade()

    create_table.assert_not_called()
    create_index.assert_not_called()
    assert "reasons=INDEX_CONTRACT_MISMATCH" in caplog.text
