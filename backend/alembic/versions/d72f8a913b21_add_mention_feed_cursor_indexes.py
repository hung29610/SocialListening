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
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mentions_org_collected_id "
            "ON mentions (organization_id, collected_at, id)"
        )
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mentions_project_collected_id "
            "ON mentions (project_id, collected_at, id)"
        )
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mentions_keyword_collected_id "
            "ON mentions (keyword_id, collected_at, id)"
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
