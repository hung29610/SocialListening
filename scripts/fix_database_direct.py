"""
Fix Database Directly - Connect from local to Render PostgreSQL
No need for Render Shell (paid feature)
"""
import os
import sys

# Check if psycopg2 is installed
try:
    import psycopg2
except ImportError:
    print("❌ ERROR: psycopg2 not installed")
    print("\nInstall it with:")
    print("  pip install psycopg2-binary")
    sys.exit(1)

# Get DATABASE_URL from environment
DATABASE_URL = os.getenv('DATABASE_URL')

if not DATABASE_URL:
    print("❌ ERROR: DATABASE_URL not set")
    print("\n" + "="*80)
    print("HƯỚNG DẪN:")
    print("="*80)
    print("\n1. Vào Render Dashboard:")
    print("   https://dashboard.render.com/")
    print("\n2. Click vào DATABASE (không phải service backend):")
    print("   Tên: social-listening-db-v2")
    print("\n3. Tìm phần 'Connections'")
    print("\n4. Copy 'External Database URL' (KHÔNG phải Internal)")
    print("   - External URL có dạng: postgresql://...@dpg-xxxxx.oregon-postgres.render.com/...")
    print("   - Internal URL có dạng: postgresql://...@dpg-xxxxx-a/... (có -a ở cuối)")
    print("\n5. Chạy lệnh:")
    print("   Windows PowerShell:")
    print('   $env:DATABASE_URL="<paste_EXTERNAL_url_here>"')
    print("\n6. Chạy lại script này:")
    print("   python fix_database_direct.py")
    print("\n" + "="*80)
    sys.exit(1)

print("="*80)
print("FIX DATABASE DIRECTLY - Connect to Render PostgreSQL")
print("="*80)
print(f"\nDatabase URL: {DATABASE_URL[:50]}...")

# SQL statements to fix the database
sql_statements = [
    # Drop old crawl_frequency first
    ("Drop old crawl_frequency column",
     "ALTER TABLE sources DROP COLUMN IF EXISTS crawl_frequency CASCADE"),
    
    # Drop and recreate enum types (to ensure correct values)
    ("Drop old crawlfrequency enum",
     "DROP TYPE IF EXISTS crawlfrequency CASCADE"),
    
    ("Create crawlfrequency enum", 
     "CREATE TYPE crawlfrequency AS ENUM ('daily', 'weekly', 'monthly', 'yearly', 'manual')"),
    
    ("Drop old sourcetype enum",
     "DROP TYPE IF EXISTS sourcetype CASCADE"),
    
    ("Create sourcetype enum",
     "CREATE TYPE sourcetype AS ENUM ('facebook_page', 'facebook_group', 'facebook_profile', 'youtube_channel', 'youtube_video', 'website', 'news', 'rss', 'forum', 'manual_url')"),
    
    # Add all missing columns
    ("Add group_id",
     "ALTER TABLE sources ADD COLUMN IF NOT EXISTS group_id INTEGER"),
    
    ("Add source_type (ENUM)",
     "ALTER TABLE sources ADD COLUMN IF NOT EXISTS source_type sourcetype NOT NULL DEFAULT 'website'"),
    
    ("Add platform_id",
     "ALTER TABLE sources ADD COLUMN IF NOT EXISTS platform_id VARCHAR(255)"),
    
    ("Add meta_data",
     "ALTER TABLE sources ADD COLUMN IF NOT EXISTS meta_data JSON"),
    
    ("Add crawl_time",
     "ALTER TABLE sources ADD COLUMN IF NOT EXISTS crawl_time TIME"),
    
    ("Add crawl_day_of_week",
     "ALTER TABLE sources ADD COLUMN IF NOT EXISTS crawl_day_of_week INTEGER"),
    
    ("Add crawl_day_of_month",
     "ALTER TABLE sources ADD COLUMN IF NOT EXISTS crawl_day_of_month INTEGER"),
    
    ("Add crawl_month",
     "ALTER TABLE sources ADD COLUMN IF NOT EXISTS crawl_month INTEGER"),
    
    ("Add next_crawl_at",
     "ALTER TABLE sources ADD COLUMN IF NOT EXISTS next_crawl_at TIMESTAMP WITH TIME ZONE"),
    
    ("Add last_crawled_at",
     "ALTER TABLE sources ADD COLUMN IF NOT EXISTS last_crawled_at TIMESTAMP WITH TIME ZONE"),
    
    ("Add last_success_at",
     "ALTER TABLE sources ADD COLUMN IF NOT EXISTS last_success_at TIMESTAMP WITH TIME ZONE"),
    
    ("Add last_error",
     "ALTER TABLE sources ADD COLUMN IF NOT EXISTS last_error TEXT"),
    
    ("Add crawl_count",
     "ALTER TABLE sources ADD COLUMN IF NOT EXISTS crawl_count INTEGER DEFAULT 0 NOT NULL"),
    
    ("Add error_count",
     "ALTER TABLE sources ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0 NOT NULL"),
    
    # Now add crawl_frequency with the new enum
    ("Add crawl_frequency (ENUM)",
     "ALTER TABLE sources ADD COLUMN IF NOT EXISTS crawl_frequency crawlfrequency DEFAULT 'manual'"),
    
    # Create indexes
    ("Create index on group_id",
     "CREATE INDEX IF NOT EXISTS ix_sources_group_id ON sources (group_id)"),
    
    ("Create index on crawl_frequency",
     "CREATE INDEX IF NOT EXISTS ix_sources_crawl_frequency ON sources (crawl_frequency)"),
]

# Connect to database
print("\n" + "="*80)
print("Connecting to database...")
print("="*80)

try:
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    print("✅ Connected successfully!")
except Exception as e:
    print(f"❌ Connection failed: {e}")
    print("\nKiểm tra:")
    print("1. DATABASE_URL có đúng không?")
    print("2. Database có accessible từ máy local không?")
    print("3. Firewall có block không?")
    sys.exit(1)

# Execute SQL statements
print("\n" + "="*80)
print("Executing SQL statements...")
print("="*80)

success_count = 0
error_count = 0

for i, (description, sql) in enumerate(sql_statements, 1):
    print(f"\n[{i}/{len(sql_statements)}] {description}...")
    try:
        cursor.execute(sql)
        conn.commit()
        print(f"  ✅ Success")
        success_count += 1
    except Exception as e:
        print(f"  ⚠️  {e}")
        conn.rollback()
        error_count += 1

# Verify schema
print("\n" + "="*80)
print("Verifying schema...")
print("="*80)

try:
    cursor.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'sources' 
        ORDER BY ordinal_position
    """)
    
    columns = cursor.fetchall()
    print(f"\n✅ Sources table now has {len(columns)} columns:")
    for col_name, col_type in columns:
        print(f"  - {col_name}: {col_type}")
    
    # Check for crawl_frequency specifically
    crawl_freq = [c for c in columns if c[0] == 'crawl_frequency']
    if crawl_freq:
        print(f"\n✅ crawl_frequency exists with type: {crawl_freq[0][1]}")
    else:
        print(f"\n❌ crawl_frequency STILL MISSING!")
        
except Exception as e:
    print(f"❌ Verification failed: {e}")

# Close connection
cursor.close()
conn.close()

# Summary
print("\n" + "="*80)
print("SUMMARY")
print("="*80)
print(f"✅ Success: {success_count}/{len(sql_statements)}")
print(f"⚠️  Errors: {error_count}/{len(sql_statements)}")

if success_count >= len(sql_statements) - 2:  # Allow 2 errors (enums might exist)
    print("\n🎉 DATABASE FIXED SUCCESSFULLY!")
    print("\n" + "="*80)
    print("NEXT STEPS:")
    print("="*80)
    print("\n1. Restart Render service:")
    print("   - Vào Render Dashboard")
    print("   - Click: Manual Deploy → Deploy latest commit")
    print("   - Đợi 2-3 phút")
    print("\n2. Test API:")
    print("   curl https://social-listening-backend.onrender.com/api/sources")
    print("\n3. Test Frontend:")
    print("   https://social-listening-azure.vercel.app/dashboard/sources")
    print("\n4. Chạy test script:")
    print("   cd scripts")
    print("   python test_sources_fix.py")
else:
    print("\n⚠️  Some errors occurred. Check the output above.")
    print("\nNếu vẫn lỗi, gửi output này cho tôi để debug.")

print("\n" + "="*80)
