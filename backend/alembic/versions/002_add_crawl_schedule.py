"""Add crawl schedule fields to sources

Revision ID: 002_add_crawl_schedule
Revises: 001_initial
Create Date: 2026-05-10 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002_add_crawl_schedule'
down_revision = '001_initial'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enum type for crawl frequency
    crawl_frequency_enum = postgresql.ENUM(
        'daily', 'weekly', 'monthly', 'yearly', 'manual',
        name='crawlfrequency'
    )
    crawl_frequency_enum.create(op.get_bind())
    
    # Add crawl schedule columns to sources table
    op.add_column('sources', sa.Column('crawl_frequency', crawl_frequency_enum, server_default='manual'))
    op.add_column('sources', sa.Column('crawl_time', sa.Time(), nullable=True))
    op.add_column('sources', sa.Column('crawl_day_of_week', sa.Integer(), nullable=True))
    op.add_column('sources', sa.Column('crawl_day_of_month', sa.Integer(), nullable=True))
    op.add_column('sources', sa.Column('crawl_month', sa.Integer(), nullable=True))
    op.add_column('sources', sa.Column('next_crawl_at', sa.DateTime(timezone=True), nullable=True))
    
    # Create index on crawl_frequency for better query performance
    op.create_index('ix_sources_crawl_frequency', 'sources', ['crawl_frequency'])


def downgrade() -> None:
    # Drop index
    op.drop_index('ix_sources_crawl_frequency', table_name='sources')
    
    # Drop columns
    op.drop_column('sources', 'next_crawl_at')
    op.drop_column('sources', 'crawl_month')
    op.drop_column('sources', 'crawl_day_of_month')
    op.drop_column('sources', 'crawl_day_of_week')
    op.drop_column('sources', 'crawl_time')
    op.drop_column('sources', 'crawl_frequency')
    
    # Drop enum type
    crawl_frequency_enum = postgresql.ENUM(name='crawlfrequency')
    crawl_frequency_enum.drop(op.get_bind())