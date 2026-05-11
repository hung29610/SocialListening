"""Merge service catalog and production schema repair heads

Revision ID: 010_merge_service_and_schema_heads
Revises: 003_add_service_catalog, 009_fix_all_tables_schema
Create Date: 2026-05-10 22:10:00.000000

"""
from alembic import op


revision = '010_merge_service_and_schema_heads'
down_revision = ('003_add_service_catalog', '009_fix_all_tables_schema')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
