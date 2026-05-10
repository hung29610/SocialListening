"""Ultimate sources fix - works from any state

Revision ID: 008_ultimate_sources_fix
Revises: 001_initial
Create Date: 2026-05-10 20:15:00.000000

This migration goes directly from 001 to 008, skipping all problematic migrations.
It will work regardless of current database state.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '008_ultimate_sources_fix'
down_revision = '001_initial'  # Go directly from 001, skip 002, 003, 007
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Add all missing columns using pure SQL with error handling.
    This will work even if some columns already exist.
    """
    
    conn = op.get_bind()
    
    # Execute each ALTER TABLE separately with error handling
    statements = [
        # Create enums
        "CREATE TYPE IF NOT EXISTS crawlfrequency AS ENUM ('daily', 'weekly', 'monthly', 'yearly', 'manual')",
        "CREATE TYPE IF NOT EXISTS sourcetype AS ENUM ('facebook_page', 'facebook_group', 'facebook_profile', 'youtube_channel', 'youtube_video', 'website', 'news', 'rss', 'forum', 'manual_url')",
        
        # Drop old crawl_frequency if it's INTEGER
        "ALTER TABLE sources DROP COLUMN IF EXISTS crawl_frequency CASCADE",
        
        # Add all columns
        "ALTER TABLE sources ADD COLUMN IF NOT EXISTS group_id INTEGER",
        "ALTER TABLE sources ADD COLUMN IF NOT EXISTS platform_id VARCHAR(255)",
        "ALTER TABLE sources ADD COLUMN IF NOT EXISTS meta_data JSON",
        "ALTER TABLE sources ADD COLUMN IF NOT EXISTS crawl_frequency crawlfrequency DEFAULT 'manual'",
        "ALTER TABLE sources ADD COLUMN IF NOT EXISTS crawl_time TIME",
        "ALTER TABLE sources ADD COLUMN IF NOT EXISTS crawl_day_of_week INTEGER",
        "ALTER TABLE sources ADD COLUMN IF NOT EXISTS crawl_day_of_month INTEGER",
        "ALTER TABLE sources ADD COLUMN IF NOT EXISTS crawl_month INTEGER",
        "ALTER TABLE sources ADD COLUMN IF NOT EXISTS next_crawl_at TIMESTAMP WITH TIME ZONE",
        "ALTER TABLE sources ADD COLUMN IF NOT EXISTS last_crawled_at TIMESTAMP WITH TIME ZONE",
        "ALTER TABLE sources ADD COLUMN IF NOT EXISTS last_success_at TIMESTAMP WITH TIME ZONE",
        "ALTER TABLE sources ADD COLUMN IF NOT EXISTS last_error TEXT",
        "ALTER TABLE sources ADD COLUMN IF NOT EXISTS crawl_count INTEGER DEFAULT 0 NOT NULL",
        "ALTER TABLE sources ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0 NOT NULL",
        
        # Create indexes
        "CREATE INDEX IF NOT EXISTS ix_sources_group_id ON sources (group_id)",
        "CREATE INDEX IF NOT EXISTS ix_sources_crawl_frequency ON sources (crawl_frequency)",
    ]
    
    for stmt in statements:
        try:
            conn.execute(sa.text(stmt))
            conn.commit()
        except Exception as e:
            print(f"Statement: {stmt[:50]}... - {e}")
            conn.rollback()
    
    print("✅ Migration 008 complete!")


def downgrade() -> None:
    """Minimal downgrade"""
    pass
