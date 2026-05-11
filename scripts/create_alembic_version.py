"""
Create alembic_version table and set current revision
"""
import os
import sys

try:
    import psycopg2
except ImportError:
    print("❌ ERROR: psycopg2 not installed")
    sys.exit(1)

DATABASE_URL = os.getenv('DATABASE_URL')

if not DATABASE_URL:
    print("❌ ERROR: DATABASE_URL not set")
    sys.exit(1)

print("="*80)
print("CREATE ALEMBIC_VERSION TABLE")
print("="*80)

try:
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    print("✅ Connected successfully!\n")
except Exception as e:
    print(f"❌ Connection failed: {e}")
    sys.exit(1)

# Create alembic_version table
print("Creating alembic_version table...")
try:
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS alembic_version (
            version_num VARCHAR(32) NOT NULL,
            CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
        )
    """)
    conn.commit()
    print("✅ Table created")
except Exception as e:
    print(f"❌ Failed: {e}")
    conn.rollback()
    cursor.close()
    conn.close()
    sys.exit(1)

# Insert current revision (latest migration)
# Since all tables exist, we mark as 012 (latest migration)
print("\nSetting current revision to 012_fix_app_wide_missing_columns...")
try:
    # Delete any existing version
    cursor.execute("DELETE FROM alembic_version")
    
    # Insert new version
    cursor.execute("""
        INSERT INTO alembic_version (version_num) 
        VALUES ('012_fix_app_wide_missing_columns')
    """)
    conn.commit()
    print("✅ Revision set to: 012_fix_app_wide_missing_columns")
except Exception as e:
    print(f"❌ Failed: {e}")
    conn.rollback()

# Verify
cursor.execute("SELECT version_num FROM alembic_version")
result = cursor.fetchone()
print(f"\n📌 Current revision: {result[0] if result else 'None'}")

cursor.close()
conn.close()

print("\n" + "="*80)
print("✅ DONE! Alembic is now ready")
print("="*80)
