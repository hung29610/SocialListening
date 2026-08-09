"""add ai chat messages

Revision ID: 7c2e4d6b8a91
Revises: 33f8bf51df62
Create Date: 2026-07-14
"""
from alembic import op
import sqlalchemy as sa
import logging


revision = '7c2e4d6b8a91'
down_revision = '33f8bf51df62'
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.runtime.migration")
TABLE_NAME = "ai_chat_messages"
EXPECTED_COLUMNS = {
    "id": ("integer", False),
    "organization_id": ("integer", True),
    "user_id": ("integer", False),
    "role": ("varchar_20", False),
    "content": ("text", False),
    "provider": ("varchar_50", True),
    "model": ("varchar_255", True),
    "used_tools": ("json", True),
    "error_message": ("text", True),
    "created_at": ("timestamp_tz", False),
}
EXPECTED_INDEXES = {
    "ix_ai_chat_messages_id": ("id",),
    "ix_ai_chat_messages_organization_id": ("organization_id",),
    "ix_ai_chat_messages_user_id": ("user_id",),
    "ix_ai_chat_messages_created_at": ("created_at",),
    "idx_ai_chat_user_created": ("user_id", "created_at"),
    "idx_ai_chat_org_created": ("organization_id", "created_at"),
}
EXPECTED_FOREIGN_KEYS = {
    (("organization_id",), "organizations", ("id",), "CASCADE"),
    (("user_id",), "users", ("id",), "CASCADE"),
}


class AIChatSchemaContractError(RuntimeError):
    """Existing legacy table is not the exact schema owned by this revision."""


def _normalized_type(value):
    if isinstance(value, sa.Integer):
        return "integer"
    if isinstance(value, sa.Text):
        return "text"
    if isinstance(value, sa.String):
        if value.length == 20:
            return "varchar_20"
        if value.length == 50:
            return "varchar_50"
        if value.length == 255:
            return "varchar_255"
        return "string_other"
    if isinstance(value, sa.JSON):
        return "json"
    if isinstance(value, sa.DateTime):
        return "timestamp_tz" if value.timezone else "timestamp_without_tz"
    return "other"


def _verify_proven_existing_table(bind):
    inspector = sa.inspect(bind)
    reflected_columns = inspector.get_columns(TABLE_NAME)
    columns = {
        item["name"]: (_normalized_type(item["type"]), bool(item["nullable"]))
        for item in reflected_columns
    }
    primary_key = tuple(
        inspector.get_pk_constraint(TABLE_NAME).get("constrained_columns") or ()
    )
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
        (item for item in reflected_columns if item["name"] == "created_at"),
        {},
    )
    created_at_default = str(created_at.get("default") or "").lower().replace(" ", "")

    reasons = []
    if columns != EXPECTED_COLUMNS:
        reasons.append("COLUMN_CONTRACT_MISMATCH")
    if primary_key != ("id",):
        reasons.append("PRIMARY_KEY_MISMATCH")
    if foreign_keys != EXPECTED_FOREIGN_KEYS:
        reasons.append("FOREIGN_KEY_MISMATCH")
    if created_at_default not in {"now()", "current_timestamp"}:
        reasons.append("CREATED_AT_DEFAULT_MISMATCH")
    expected_indexes = {
        name: (index_columns, False)
        for name, index_columns in EXPECTED_INDEXES.items()
    }
    if indexes != expected_indexes:
        reasons.append("INDEX_CONTRACT_MISMATCH")

    if reasons:
        logger.critical(
            "AI_CHAT_SCHEMA_CONTRACT status=rejected reasons=%s",
            ",".join(sorted(set(reasons))),
        )
        raise AIChatSchemaContractError(
            "existing ai_chat_messages schema does not match revision contract"
        )
    logger.warning("AI_CHAT_SCHEMA_CONTRACT status=verified table_present=true")


def upgrade() -> None:
    bind = op.get_bind()
    if TABLE_NAME in sa.inspect(bind).get_table_names():
        # Production is proven to have this revision-owned table while its
        # committed Alembic head is still an ancestor. Accept only the exact
        # historical contract; do not stamp, rewrite rows, or suppress a
        # general duplicate-table error.
        _verify_proven_existing_table(bind)
        return

    op.create_table(
        'ai_chat_messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('organization_id', sa.Integer(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('provider', sa.String(length=50), nullable=True),
        sa.Column('model', sa.String(length=255), nullable=True),
        sa.Column('used_tools', sa.JSON(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_ai_chat_messages_id'), 'ai_chat_messages', ['id'], unique=False)
    op.create_index(op.f('ix_ai_chat_messages_organization_id'), 'ai_chat_messages', ['organization_id'], unique=False)
    op.create_index(op.f('ix_ai_chat_messages_user_id'), 'ai_chat_messages', ['user_id'], unique=False)
    op.create_index(op.f('ix_ai_chat_messages_created_at'), 'ai_chat_messages', ['created_at'], unique=False)
    op.create_index('idx_ai_chat_user_created', 'ai_chat_messages', ['user_id', 'created_at'], unique=False)
    op.create_index('idx_ai_chat_org_created', 'ai_chat_messages', ['organization_id', 'created_at'], unique=False)


def downgrade() -> None:
    op.drop_index('idx_ai_chat_org_created', table_name='ai_chat_messages')
    op.drop_index('idx_ai_chat_user_created', table_name='ai_chat_messages')
    op.drop_index(op.f('ix_ai_chat_messages_created_at'), table_name='ai_chat_messages')
    op.drop_index(op.f('ix_ai_chat_messages_user_id'), table_name='ai_chat_messages')
    op.drop_index(op.f('ix_ai_chat_messages_organization_id'), table_name='ai_chat_messages')
    op.drop_index(op.f('ix_ai_chat_messages_id'), table_name='ai_chat_messages')
    op.drop_table('ai_chat_messages')
