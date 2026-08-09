import importlib.util
from pathlib import Path
from unittest.mock import Mock

import pytest
import sqlalchemy as sa


def _load_revision():
    path = (
        Path(__file__).parents[1]
        / "alembic"
        / "versions"
        / "7a8e2eb4683b_add_ai_usage_log.py"
    )
    spec = importlib.util.spec_from_file_location("revision_7a8e_contract", path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _columns():
    return [
        {"name": "id", "type": sa.Integer(), "nullable": False},
        {"name": "organization_id", "type": sa.Integer(), "nullable": True},
        {"name": "user_id", "type": sa.Integer(), "nullable": True},
        {"name": "model_config_id", "type": sa.Integer(), "nullable": True},
        {"name": "provider", "type": sa.String(50), "nullable": False},
        {"name": "model", "type": sa.String(255), "nullable": False},
        {"name": "request_type", "type": sa.String(50), "nullable": False},
        {"name": "input_tokens", "type": sa.Integer(), "nullable": True},
        {"name": "output_tokens", "type": sa.Integer(), "nullable": True},
        {"name": "total_tokens", "type": sa.Integer(), "nullable": True},
        {"name": "estimated_cost", "type": sa.Float(), "nullable": True},
        {"name": "success", "type": sa.Boolean(), "nullable": False},
        {"name": "error_message", "type": sa.Text(), "nullable": True},
        {
            "name": "created_at",
            "type": sa.DateTime(timezone=True),
            "nullable": False,
            "default": "now()",
        },
    ]


def _indexes(*, include_model_config=False):
    result = [
        {"name": "ix_ai_usage_logs_id", "column_names": ["id"], "unique": False},
        {
            "name": "ix_ai_usage_logs_organization_id",
            "column_names": ["organization_id"],
            "unique": False,
        },
        {
            "name": "ix_ai_usage_logs_user_id",
            "column_names": ["user_id"],
            "unique": False,
        },
    ]
    if include_model_config:
        result.append(
            {
                "name": "ix_ai_usage_logs_model_config_id",
                "column_names": ["model_config_id"],
                "unique": False,
            }
        )
    return result


def _foreign_keys():
    return [
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
            "options": {"ondelete": "SET NULL"},
        },
        {
            "constrained_columns": ["model_config_id"],
            "referred_table": "ai_model_config",
            "referred_columns": ["id"],
            "options": {"ondelete": "SET NULL"},
        },
    ]


class InspectorStub:
    def __init__(self, columns=None, indexes=None, foreign_keys=None):
        self.columns = columns if columns is not None else _columns()
        self.indexes = indexes if indexes is not None else _indexes()
        self.foreign_keys = foreign_keys if foreign_keys is not None else _foreign_keys()

    def get_columns(self, _table):
        return self.columns

    def get_pk_constraint(self, _table):
        return {"constrained_columns": ["id"]}

    def get_indexes(self, _table):
        return self.indexes

    def get_foreign_keys(self, _table):
        return self.foreign_keys


def test_proven_contract_repairs_only_missing_model_config_index(monkeypatch, caplog):
    revision = _load_revision()
    before = InspectorStub()
    after = InspectorStub(indexes=_indexes(include_model_config=True))
    inspectors = iter([before, after])
    create_index = Mock()
    monkeypatch.setattr(revision.sa, "inspect", lambda _bind: next(inspectors))
    monkeypatch.setattr(revision.op, "create_index", create_index)

    with caplog.at_level("WARNING"):
        revision._verify_and_complete_proven_existing_table(object())

    create_index.assert_called_once_with(
        "ix_ai_usage_logs_model_config_id",
        "ai_usage_logs",
        ["model_config_id"],
        unique=False,
    )
    assert "AI_USAGE_SCHEMA_CONTRACT status=verified" in caplog.text
    assert "missing_index_repaired=true" in caplog.text


def test_complete_exact_contract_is_restart_safe_noop(monkeypatch):
    revision = _load_revision()
    inspector = InspectorStub(indexes=_indexes(include_model_config=True))
    create_index = Mock()
    monkeypatch.setattr(revision.sa, "inspect", lambda _bind: inspector)
    monkeypatch.setattr(revision.op, "create_index", create_index)

    revision._verify_and_complete_proven_existing_table(object())

    create_index.assert_not_called()


@pytest.mark.parametrize(
    "inspector",
    [
        InspectorStub(columns=_columns()[:-1]),
        InspectorStub(
            columns=[
                {**item, "nullable": True} if item["name"] == "success" else item
                for item in _columns()
            ]
        ),
        InspectorStub(indexes=_indexes() + [{"name": "unexpected", "column_names": ["id"], "unique": False}]),
        InspectorStub(
            indexes=[
                {**item, "unique": True} if item["name"] == "ix_ai_usage_logs_id" else item
                for item in _indexes()
            ]
        ),
        InspectorStub(foreign_keys=_foreign_keys()[:-1]),
    ],
)
def test_unproven_contract_fails_before_any_schema_mutation(
    monkeypatch, inspector, caplog
):
    revision = _load_revision()
    create_index = Mock()
    monkeypatch.setattr(revision.sa, "inspect", lambda _bind: inspector)
    monkeypatch.setattr(revision.op, "create_index", create_index)

    with caplog.at_level("CRITICAL"), pytest.raises(
        revision.AIUsageSchemaContractError
    ):
        revision._verify_and_complete_proven_existing_table(object())

    create_index.assert_not_called()
    assert "AI_USAGE_SCHEMA_CONTRACT status=rejected" in caplog.text
    assert "DATABASE_URL" not in caplog.text
    assert "SELECT " not in caplog.text
