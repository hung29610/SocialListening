"""
EMERGENCY FIX: Add missing columns directly to production database
This bypasses Alembic and runs SQL directly
"""
import os
import sys
from sqlalchemy import create_engine, text

# Get DATABASE_URL from environment or use Render production URL
DATABASE_URL = os.getenv('DATABASE_URL')

if not DATABASE_URL:
    print("❌ ERROR: DATABASE_URL environment variable not set")
    print("\nTo fix production database, you need to:")
    print("1. Get DATABASE_URL from Render dashboard")
    print("2. Run: set DATABASE_URL=<your_database_url>")
    print("3. Run this script again")
    sys.exit(1)

print("="*80)
print("EMERGENCY FIX: Sources Table Schema")
print("="*80)
print(f"\nConnecting to database...")
print(f"URL: {DATABASE_URL[:50]}...")

try:
    engine = create_engine(DATABASE_URL)
    conn = engine.connect()
    print("✅ Connected successfully!")
except Exception as e:
    print(f"❌ Connection failed: {e}")
    sys.exit(1)

# SQL statements to fix the schema
sql_statements = [
    # 1. Create enum types
    """
    DO $$ BEGIN
        CREATE TYPE crawlfrequency AS ENUM ('daily', 'weekly', 'monthly', 'yearly', 'manual');
        RAISE NOTICE 'Created crawlfrequency enum';
    EXCEPTION
        WHEN duplicate_object THEN 
            RAISE NOTICE 'crawlfrequency enum already exists';
    END $$;
    """,
    
    """
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
    """,
    
    # 2. Fix crawl_frequency column
    """
    DO $$ 
    DECLARE
        col_type text;
    BEGIN
        SELECT data_type INTO col_type
        FROM information_schema.columns
        WHERE table_name = 'sources' AND column_name = 'crawl_frequency';
        
        IF col_type IS NULL THEN
            ALTER TABLE sources ADD COLUMN crawl_frequency crawlfrequency DEFAULT 'manual';
            RAISE NOTICE 'Added crawl_frequency column';
        ELSIF col_type = 'integer' THEN
            ALTER TABLE sources DROP COLUMN crawl_frequency CASCADE;
            ALTER TABLE sources ADD COLUMN crawl_frequency crawlfrequency DEFAULT 'manual';
            RAISE NOTICE 'Converted crawl_frequency from INTEGER to ENUM';
        ELSE
            RAISE NOTICE 'crawl_frequency column already correct';
        END IF;
    END $$;
    """,
    
    # 3. Add other columns
    """
    DO $$ BEGIN
        ALTER TABLE sources ADD COLUMN group_id INTEGER;
        RAISE NOTICE 'Added group_id';
    EXCEPTION WHEN duplicate_column THEN 
        RAISE NOTICE 'group_id already exists';
    END $$;
    """,
    
    """
    DO $$ BEGIN
        ALTER TABLE sources ADD COLUMN platform_id VARCHAR(255);
        RAISE NOTICE 'Added platform_id';
    EXCEPTION WHEN duplicate_column THEN 
        RAISE NOTICE 'platform_id already exists';
    END $$;
    """,
    
    """
    DO $$ BEGIN
        ALTER TABLE sources ADD COLUMN meta_data JSON;
        RAISE NOTICE 'Added meta_data';
    EXCEPTION WHEN duplicate_column THEN 
        RAISE NOTICE 'meta_data already exists';
    END $$;
    """,
    
    """
    DO $$ BEGIN
        ALTER TABLE sources ADD COLUMN crawl_time TIME;
        RAISE NOTICE 'Added crawl_time';
    EXCEPTION WHEN duplicate_column THEN 
        RAISE NOTICE 'crawl_time already exists';
    END $$;
    """,
    
    """
    DO $$ BEGIN
        ALTER TABLE sources ADD COLUMN crawl_day_of_week INTEGER;
        RAISE NOTICE 'Added crawl_day_of_week';
    EXCEPTION WHEN duplicate_column THEN 
        RAISE NOTICE 'crawl_day_of_week already exists';
    END $$;
    """,
    
    """
    DO $$ BEGIN
        ALTER TABLE sources ADD COLUMN crawl_day_of_month INTEGER;
        RAISE NOTICE 'Added crawl_day_of_month';
    EXCEPTION WHEN duplicate_column THEN 
        RAISE NOTICE 'crawl_day_of_month already exists';
    END $$;
    """,
    
    """
    DO $$ BEGIN
        ALTER TABLE sources ADD COLUMN crawl_month INTEGER;
        RAISE NOTICE 'Added crawl_month';
    EXCEPTION WHEN duplicate_column THEN 
        RAISE NOTICE 'crawl_month already exists';
    END $$;
    """,
    
    """
    DO $$ BEGIN
        ALTER TABLE sources ADD COLUMN next_crawl_at TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added next_crawl_at';
    EXCEPTION WHEN duplicate_column THEN 
        RAISE NOTICE 'next_crawl_at already exists';
    END $$;
    """,
    
    """
    DO $$ BEGIN
        ALTER TABLE sources ADD COLUMN last_success_at TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added last_success_at';
    EXCEPTION WHEN duplicate_column THEN 
        RAISE NOTICE 'last_success_at already exists';
    END $$;
    """,
    
    """
    DO $$ BEGIN
        ALTER TABLE sources ADD COLUMN last_error TEXT;
        RAISE NOTICE 'Added last_error';
    EXCEPTION WHEN duplicate_column THEN 
        RAISE NOTICE 'last_error already exists';
    END $$;
    """,
    
    """
    DO $$ BEGIN
        ALTER TABLE sources ADD COLUMN crawl_count INTEGER DEFAULT 0 NOT NULL;
        RAISE NOTICE 'Added crawl_count';
    EXCEPTION WHEN duplicate_column THEN 
        RAISE NOTICE 'crawl_count already exists';
    END $$;
    """,
    
    """
    DO $$ BEGIN
        ALTER TABLE sources ADD COLUMN error_count INTEGER DEFAULT 0 NOT NULL;
        RAISE NOTICE 'Added error_count';
    EXCEPTION WHEN duplicate_column THEN 
        RAISE NOTICE 'error_count already exists';
    END $$;
    """,
    
    # 4. Create indexes
    """
    DO $$ BEGIN
        CREATE INDEX ix_sources_group_id ON sources (group_id);
        RAISE NOTICE 'Created index ix_sources_group_id';
    EXCEPTION WHEN duplicate_table THEN 
        RAISE NOTICE 'Index ix_sources_group_id already exists';
    END $$;
    """,
    
    """
    DO $$ BEGIN
        CREATE INDEX ix_sources_crawl_frequency ON sources (crawl_frequency);
        RAISE NOTICE 'Created index ix_sources_crawl_frequency';
    EXCEPTION WHEN duplicate_table THEN 
        RAISE NOTICE 'Index ix_sources_crawl_frequency already exists';
    END $$;
    """,
]

print("\n" + "="*80)
print("Executing SQL statements...")
print("="*80)

for i, sql in enumerate(sql_statements, 1):
    print(f"\n[{i}/{len(sql_statements)}] Executing...")
    try:
        result = conn.execute(text(sql))
        conn.commit()
        print(f"✅ Success")
    except Exception as e:
        print(f"⚠️  Error: {e}")
        conn.rollback()

# Verify schema
print("\n" + "="*80)
print("Verifying schema...")
print("="*80)

try:
    result = conn.execute(text("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'sources' 
        ORDER BY ordinal_position
    """))
    
    columns = result.fetchall()
    print(f"\n✅ Sources table now has {len(columns)} columns:")
    for col in columns:
        print(f"  - {col[0]}: {col[1]}")
    
    # Check for crawl_frequency specifically
    crawl_freq = [c for c in columns if c[0] == 'crawl_frequency']
    if crawl_freq:
        print(f"\n✅ crawl_frequency exists with type: {crawl_freq[0][1]}")
    else:
        print(f"\n❌ crawl_frequency STILL MISSING!")
        
except Exception as e:
    print(f"❌ Verification failed: {e}")

conn.close()

print("\n" + "="*80)
print("✅ EMERGENCY FIX COMPLETE!")
print("="*80)
print("\nNext steps:")
print("1. Test API: GET https://social-listening-backend.onrender.com/api/sources")
print("2. Restart Render service if needed")
print("3. Run: python test_sources_fix.py")
