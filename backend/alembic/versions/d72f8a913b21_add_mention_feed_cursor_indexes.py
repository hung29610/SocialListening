"""add mention feed cursor indexes

Revision ID: d72f8a913b21
Revises: 7c2e4d6b8a91
Create Date: 2026-07-28

HIGH RISK: human diff review is required before deployment.
"""
from alembic import op
import sqlalchemy as sa


revision = "d72f8a913b21"
down_revision = "7c2e4d6b8a91"
branch_labels = None
depends_on = None


def _ensure_concurrent_index(name: str, columns: str) -> None:
    connection = op.get_bind()
    is_valid = connection.execute(
        sa.text(
            "SELECT i.indisvalid "
            "FROM pg_index i "
            "JOIN pg_class c ON c.oid = i.indexrelid "
            "WHERE c.relname = :name"
        ),
        {"name": name},
    ).scalar_one_or_none()
    if is_valid is False:
        op.execute(f'DROP INDEX CONCURRENTLY IF EXISTS "{name}"')
    if is_valid is not True:
        op.execute(
            f'CREATE INDEX CONCURRENTLY "{name}" ON mentions ({columns})'
        )


def upgrade() -> None:
    op.execute(
        "UPDATE mentions SET collected_at = CURRENT_TIMESTAMP "
        "WHERE collected_at IS NULL"
    )
    op.alter_column(
        "mentions",
        "collected_at",
        existing_type=sa.DateTime(timezone=True),
        nullable=False,
    )
    with op.get_context().autocommit_block():
        _ensure_concurrent_index(
            "idx_mentions_org_collected_id",
            "organization_id, collected_at, id",
        )
        _ensure_concurrent_index(
            "idx_mentions_project_collected_id",
            "project_id, collected_at, id",
        )
        _ensure_concurrent_index(
            "idx_mentions_keyword_collected_id",
            "keyword_id, collected_at, id",
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_mentions_keyword_collected_id")
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_mentions_project_collected_id")
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_mentions_org_collected_id")
    op.alter_column(
        "mentions",
        "collected_at",
        existing_type=sa.DateTime(timezone=True),
        nullable=True,
    )
