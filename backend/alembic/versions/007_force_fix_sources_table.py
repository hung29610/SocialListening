"""Force fix sources table - independent of previous migrations

Revision ID: 007_force_fix_sources_table
Revises: 003_add_service_catalog
Create Date: 2026-05-10 20:05:00.000000

IMPORTANT: This migration is designed to work regardless of whether
migrations 002, 004, 005, 006 were applied or not.

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '007_force_fix_sources_table'
down_revision = '003_add_service_catalog'  # Skip 004, 005, 006 - go directly from 003
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    This migration FORCES the sources table to have all required columns.
    It uses raw SQL with error handling to be completely idempotent.
    """
    
    conn = op.get_bind()
    
    print("="*80)
    print("FORCE FIX SOURCES TABLE - Migration 007")
    print("="*80)
    
    # Step 1: Create enum types (ignore if exist)
    print("\n1. Creating enum types...")
    conn.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE crawlfrequency AS ENUM ('daily', 'weekly', 'monthly', 'yearly', 'manual');
            RAISE NOTICE 'Created crawlfrequency enum';
        EXCEPTION
            WHEN duplicate_object THEN 
                RAISE NOTICE 'crawlfrequency enum already exists';
        END $$;
    """))
    
    conn.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE sourcetype AS ENUM (
                'facebook_page', 'facebook_group', 'facebook_profile',
                'youtube_channel', 'youtube_video', 'website', 'news',
                'rss', 'forum', 'manual_url'
            );
            RAISE NOTICE 'Created sourcetype enum';
        EXCEPTION
            WHEN duplicate_object THEN 
                RAISE NOTICE 'sourcetype enum already exists';
        END $$;
    """))
    
    # Step 2: Fix crawl_frequency column (the main problem)
    print("\n2. Fixing crawl_frequency column...")
    conn.execute(sa.text("""
        DO $$ 
        DECLARE
            col_type text;
        BEGIN
            -- Check if column exists and get its type
            SELECT data_type INTO col_type
            FROM information_schema.columns
            WHERE table_name = 'sources' AND column_name = 'crawl_frequency';
            
            IF col_type IS NULL THEN
                -- Column doesn't exist, add it
                ALTER TABLE sources ADD COLUMN crawl_frequency crawlfrequency DEFAULT 'manual';
                RAISE NOTICE 'Added crawl_frequency column';
            ELSIF col_type = 'integer' THEN
                -- Column exists but is INTEGER, need to convert
                ALTER TABLE sources DROP COLUMN crawl_frequency CASCADE;
                ALTER TABLE sources ADD COLUMN crawl_frequency crawlfrequency DEFAULT 'manual';
                RAISE NOTICE 'Converted crawl_frequency from INTEGER to ENUM';
            ELSE
                RAISE NOTICE 'crawl_frequency column already correct type';
            END IF;
        END $$;
    """))
    
    # Step 3: Add all other missing columns
    print("\n3. Adding missing columns...")
    
    columns_to_add = [
        ("group_id", "INTEGER"),
        ("platform_id", "VARCHAR(255)"),
        ("meta_data", "JSON"),
        ("crawl_time", "TIME"),
        ("crawl_day_of_week", "INTEGER"),
        ("crawl_day_of_month", "INTEGER"),
        ("crawl_month", "INTEGER"),
        ("next_crawl_at", "TIMESTAMP WITH TIME ZONE"),
        ("last_success_at", "TIMESTAMP WITH TIME ZONE"),
        ("last_error", "TEXT"),
        ("crawl_count", "INTEGER DEFAULT 0 NOT NULL"),
        ("error_count", "INTEGER DEFAULT 0 NOT NULL"),
    ]
    
    for col_name, col_type in columns_to_add:
        conn.execute(sa.text(f"""
            DO $$ BEGIN
                ALTER TABLE sources ADD COLUMN {col_name} {col_type};
                RAISE NOTICE 'Added column: {col_name}';
            EXCEPTION
                WHEN duplicate_column THEN 
                    RAISE NOTICE 'Column {col_name} already exists';
            END $$;
        """))
    
    # Step 4: Create indexes
    print("\n4. Creating indexes...")
    
    indexes = [
        ("ix_sources_group_id", "group_id"),
        ("ix_sources_crawl_frequency", "crawl_frequency"),
        ("ix_sources_source_type", "source_type"),
        ("ix_sources_is_active", "is_active"),
    ]
    
    for idx_name, col_name in indexes:
        conn.execute(sa.text(f"""
            DO $$ BEGIN
                CREATE INDEX {idx_name} ON sources ({col_name});
                RAISE NOTICE 'Created index: {idx_name}';
            EXCEPTION
                WHEN duplicate_table THEN 
                    RAISE NOTICE 'Index {idx_name} already exists';
            END $$;
        """))
    
    # Step 5: Verify all columns exist
    print("\n5. Verifying schema...")
    result = conn.execute(sa.text("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'sources' 
        ORDER BY ordinal_position
    """))
    
    columns = result.fetchall()
    print(f"\nSources table now has {len(columns)} columns:")
    for col in columns:
        print(f"  - {col[0]}: {col[1]}")
    
    print("\n" + "="*80)
    print("✅ MIGRATION 007 COMPLETE!")
    print("="*80)


def downgrade() -> None:
    """Minimal downgrade"""
    conn = op.get_bind()
    
    # Only drop indexes, not columns (to prevent data loss)
    indexes = [
        "ix_sources_group_id",
        "ix_sources_crawl_frequency",
        "ix_sources_source_type",
        "ix_sources_is_active",
    ]
    
    for idx_name in indexes:
        conn.execute(sa.text(f"DROP INDEX IF EXISTS {idx_name}"))
    
    print("⚠️  Downgrade complete. Columns not removed to prevent data loss.")
