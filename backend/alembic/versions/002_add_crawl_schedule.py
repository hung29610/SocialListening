"""Add crawl schedule fields to sources

Revision ID: 002_add_crawl_schedule
Revises: 001_initial
Create Date: 2026-05-10 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '002_add_crawl_schedule'
down_revision = '001_initial'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = {column["name"] for column in inspector.get_columns("sources")}

    bind.execute(sa.text("""
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crawlfrequency') THEN
            CREATE TYPE crawlfrequency AS ENUM ('daily', 'weekly', 'monthly', 'yearly', 'manual');
        END IF;
    END
    $$;
    """))
    
    # Add crawl schedule columns to sources table
    if 'crawl_frequency' not in existing_columns:
        op.add_column('sources', sa.Column('crawl_frequency', sa.String(), nullable=True, server_default='manual'))
    if 'crawl_time' not in existing_columns:
        op.add_column('sources', sa.Column('crawl_time', sa.Time(), nullable=True))
    if 'crawl_day_of_week' not in existing_columns:
        op.add_column('sources', sa.Column('crawl_day_of_week', sa.Integer(), nullable=True))
    if 'crawl_day_of_month' not in existing_columns:
        op.add_column('sources', sa.Column('crawl_day_of_month', sa.Integer(), nullable=True))
    if 'crawl_month' not in existing_columns:
        op.add_column('sources', sa.Column('crawl_month', sa.Integer(), nullable=True))
    if 'next_crawl_at' not in existing_columns:
        op.add_column('sources', sa.Column('next_crawl_at', sa.DateTime(timezone=True), nullable=True))
    
    # Create index on crawl_frequency for better query performance
    bind.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_sources_crawl_frequency ON sources (crawl_frequency)"))


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
    op.execute("DROP TYPE IF EXISTS crawlfrequency")
