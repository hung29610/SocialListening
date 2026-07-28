"""add mention feed cursor indexes

Revision ID: d72f8a913b21
Revises: 7c2e4d6b8a91
Create Date: 2026-07-28

HIGH RISK: human diff review is required before deployment.
"""
from alembic import op


revision = "d72f8a913b21"
down_revision = "7c2e4d6b8a91"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "idx_mentions_org_collected_id",
        "mentions",
        ["organization_id", "collected_at", "id"],
        unique=False,
    )
    op.create_index(
        "idx_mentions_project_collected_id",
        "mentions",
        ["project_id", "collected_at", "id"],
        unique=False,
    )
    op.create_index(
        "idx_mentions_keyword_collected_id",
        "mentions",
        ["keyword_id", "collected_at", "id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_mentions_keyword_collected_id", table_name="mentions")
    op.drop_index("idx_mentions_project_collected_id", table_name="mentions")
    op.drop_index("idx_mentions_org_collected_id", table_name="mentions")
