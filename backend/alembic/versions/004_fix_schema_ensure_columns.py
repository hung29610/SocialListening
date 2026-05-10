"""Fix schema - ensure all source columns exist

Revision ID: 004_fix_schema_ensure_columns
Revises: 003_add_service_catalog
Create Date: 2026-05-10 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = '004_fix_schema_ensure_columns'
down_revision = '003_add_service_catalog'
branch_labels = None
depends_on = None


def column_exists(table_name, column_name):
    """Check if a column exists in a table"""
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    # Add missing columns to sources table if they don't exist
    # These were in the model but missing from migration 002
    
    if not column_exists('sources', 'last_crawled_at'):
        op.add_column('sources', sa.Column('last_crawled_at', sa.DateTime(timezone=True), nullable=True))
    
    if not column_exists('sources', 'last_success_at'):
        op.add_column('sources', sa.Column('last_success_at', sa.DateTime(timezone=True), nullable=True))
    
    if not column_exists('sources', 'last_error'):
        op.add_column('sources', sa.Column('last_error', sa.Text(), nullable=True))
    
    if not column_exists('sources', 'crawl_count'):
        op.add_column('sources', sa.Column('crawl_count', sa.Integer(), nullable=False, server_default='0'))
    
    if not column_exists('sources', 'error_count'):
        op.add_column('sources', sa.Column('error_count', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    # Drop columns if they exist
    if column_exists('sources', 'error_count'):
        op.drop_column('sources', 'error_count')
    
    if column_exists('sources', 'crawl_count'):
        op.drop_column('sources', 'crawl_count')
    
    if column_exists('sources', 'last_error'):
        op.drop_column('sources', 'last_error')
    
    if column_exists('sources', 'last_success_at'):
        op.drop_column('sources', 'last_success_at')
    
    if column_exists('sources', 'last_crawled_at'):
        op.drop_column('sources', 'last_crawled_at')
