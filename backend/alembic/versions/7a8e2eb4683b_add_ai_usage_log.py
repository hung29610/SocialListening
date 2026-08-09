"""add_ai_usage_log

Revision ID: 7a8e2eb4683b
Revises: c4a1e2f3b5d7
Create Date: 2026-06-28 17:51:19.877161

"""
from alembic import op
import sqlalchemy as sa
import logging


# revision identifiers, used by Alembic.
revision = '7a8e2eb4683b'
down_revision = 'c4a1e2f3b5d7'
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.runtime.migration")

TABLE_NAME = "ai_usage_logs"
EXPECTED_COLUMNS = {
    "id": ("integer", False),
    "organization_id": ("integer", True),
    "user_id": ("integer", True),
    "model_config_id": ("integer", True),
    "provider": ("varchar_50", False),
    "model": ("varchar_255", False),
    "request_type": ("varchar_50", False),
    "input_tokens": ("integer", True),
    "output_tokens": ("integer", True),
    "total_tokens": ("integer", True),
    "estimated_cost": ("float", True),
    "success": ("boolean", False),
    "error_message": ("text", True),
    "created_at": ("timestamp_tz", False),
}
EXPECTED_INDEXES = {
    "ix_ai_usage_logs_id": ("id",),
    "ix_ai_usage_logs_model_config_id": ("model_config_id",),
    "ix_ai_usage_logs_organization_id": ("organization_id",),
    "ix_ai_usage_logs_user_id": ("user_id",),
}
PROVEN_MISSING_INDEX = "ix_ai_usage_logs_model_config_id"
EXPECTED_FOREIGN_KEYS = {
    (("organization_id",), "organizations", ("id",), "CASCADE"),
    (("user_id",), "users", ("id",), "SET NULL"),
    (("model_config_id",), "ai_model_config", ("id",), "SET NULL"),
}


class AIUsageSchemaContractError(RuntimeError):
    """Existing legacy table is not the exact schema owned by this revision."""


def _normalized_type(value):
    if isinstance(value, sa.Integer):
        return "integer"
    if isinstance(value, sa.Text):
        return "text"
    if isinstance(value, sa.String):
        if value.length == 50:
            return "varchar_50"
        if value.length == 255:
            return "varchar_255"
        return "string_other"
    if isinstance(value, sa.Float):
        return "float"
    if isinstance(value, sa.Boolean):
        return "boolean"
    if isinstance(value, sa.DateTime):
        return "timestamp_tz" if value.timezone else "timestamp_without_tz"
    return "other"


def _existing_contract_state(bind):
    inspector = sa.inspect(bind)
    columns = {
        item["name"]: (_normalized_type(item["type"]), bool(item["nullable"]))
        for item in inspector.get_columns(TABLE_NAME)
    }
    primary_key = tuple(inspector.get_pk_constraint(TABLE_NAME).get("constrained_columns") or ())
    indexes = {
        item["name"]: (tuple(item.get("column_names") or ()), bool(item.get("unique")))
        for item in inspector.get_indexes(TABLE_NAME)
    }
    foreign_keys = {
        (
            tuple(item.get("constrained_columns") or ()),
            item.get("referred_table"),
            tuple(item.get("referred_columns") or ()),
            str((item.get("options") or {}).get("ondelete") or "").upper(),
        )
        for item in inspector.get_foreign_keys(TABLE_NAME)
    }
    created_at = next(
        (
            item
            for item in inspector.get_columns(TABLE_NAME)
            if item["name"] == "created_at"
        ),
        {},
    )
    created_at_default = str(created_at.get("default") or "").lower().replace(" ", "")
    return columns, primary_key, indexes, foreign_keys, created_at_default


def _verify_and_complete_proven_existing_table(bind):
    columns, primary_key, indexes, foreign_keys, created_at_default = (
        _existing_contract_state(bind)
    )
    reasons = []
    if columns != EXPECTED_COLUMNS:
        reasons.append("COLUMN_CONTRACT_MISMATCH")
    if primary_key != ("id",):
        reasons.append("PRIMARY_KEY_MISMATCH")
    if foreign_keys != EXPECTED_FOREIGN_KEYS:
        reasons.append("FOREIGN_KEY_MISMATCH")
    if created_at_default not in {"now()", "current_timestamp"}:
        reasons.append("CREATED_AT_DEFAULT_MISMATCH")

    unexpected_indexes = set(indexes) - set(EXPECTED_INDEXES)
    missing_indexes = set(EXPECTED_INDEXES) - set(indexes)
    malformed_indexes = {
        name
        for name, expected_columns in EXPECTED_INDEXES.items()
        if name in indexes
        and indexes[name] != (expected_columns, False)
    }
    if unexpected_indexes:
        reasons.append("UNEXPECTED_INDEX")
    if missing_indexes and missing_indexes != {PROVEN_MISSING_INDEX}:
        reasons.append("UNSUPPORTED_MISSING_INDEX_SET")
    if malformed_indexes:
        reasons.append("INDEX_CONTRACT_MISMATCH")

    if reasons:
        logger.critical(
            "AI_USAGE_SCHEMA_CONTRACT status=rejected reasons=%s",
            ",".join(sorted(set(reasons))),
        )
        raise AIUsageSchemaContractError(
            "existing ai_usage_logs schema does not match revision contract"
        )

    if PROVEN_MISSING_INDEX in missing_indexes:
        op.create_index(
            PROVEN_MISSING_INDEX,
            TABLE_NAME,
            ["model_config_id"],
            unique=False,
        )

    final_indexes = {
        item["name"]: (tuple(item.get("column_names") or ()), bool(item.get("unique")))
        for item in sa.inspect(bind).get_indexes(TABLE_NAME)
    }
    if final_indexes != {
        name: (columns, False) for name, columns in EXPECTED_INDEXES.items()
    }:
        logger.critical(
            "AI_USAGE_SCHEMA_CONTRACT status=rejected reasons=FINAL_INDEX_VERIFICATION_FAILED"
        )
        raise AIUsageSchemaContractError(
            "existing ai_usage_logs index repair did not verify"
        )
    logger.warning(
        "AI_USAGE_SCHEMA_CONTRACT status=verified table_present=true "
        "missing_index_repaired=%s",
        str(PROVEN_MISSING_INDEX in missing_indexes).lower(),
    )


def upgrade() -> None:
    bind = op.get_bind()
    if TABLE_NAME in sa.inspect(bind).get_table_names():
        # Production is proven to have this revision-owned table while its
        # Alembic head is still the parent revision. Accept only the exact
        # historical table contract, repair only the one proven missing index,
        # and let Alembic advance the revision normally. No stamp, row read,
        # data rewrite, or broad duplicate-object suppression is used.
        _verify_and_complete_proven_existing_table(bind)
        return

    op.create_table(
        'ai_usage_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('organization_id', sa.Integer(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('model_config_id', sa.Integer(), nullable=True),
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('model', sa.String(length=255), nullable=False),
        sa.Column('request_type', sa.String(length=50), nullable=False),
        sa.Column('input_tokens', sa.Integer(), nullable=True),
        sa.Column('output_tokens', sa.Integer(), nullable=True),
        sa.Column('total_tokens', sa.Integer(), nullable=True),
        sa.Column('estimated_cost', sa.Float(), nullable=True),
        sa.Column('success', sa.Boolean(), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['model_config_id'], ['ai_model_config.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ai_usage_logs_id'), 'ai_usage_logs', ['id'], unique=False)
    op.create_index(op.f('ix_ai_usage_logs_model_config_id'), 'ai_usage_logs', ['model_config_id'], unique=False)
    op.create_index(op.f('ix_ai_usage_logs_organization_id'), 'ai_usage_logs', ['organization_id'], unique=False)
    op.create_index(op.f('ix_ai_usage_logs_user_id'), 'ai_usage_logs', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_ai_usage_logs_user_id'), table_name='ai_usage_logs')
    op.drop_index(op.f('ix_ai_usage_logs_organization_id'), table_name='ai_usage_logs')
    op.drop_index(op.f('ix_ai_usage_logs_model_config_id'), table_name='ai_usage_logs')
    op.drop_index(op.f('ix_ai_usage_logs_id'), table_name='ai_usage_logs')
    op.drop_table('ai_usage_logs')
