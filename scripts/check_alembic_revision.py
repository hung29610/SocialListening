"""
Check Alembic Revision - See what migration version is in production
"""
import os
import sys

try:
    import psycopg2
except ImportError:
    print("❌ ERROR: psycopg2 not installed")
    print("Install: pip install psycopg2-binary")
    sys.exit(1)

DATABASE_URL = os.getenv('DATABASE_URL')

if not DATABASE_URL:
    print("❌ ERROR: DATABASE_URL not set")
    sys.exit(1)

print("="*80)
print("CHECKING ALEMBIC REVISION")
print("="*80)

try:
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    print("✅ Connected successfully!")
except Exception as e:
    print(f"❌ Connection failed: {e}")
    sys.exit(1)

# Check if alembic_version table exists
try:
    cursor.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'alembic_version'
        )
    """)
    
    exists = cursor.fetchone()[0]
    
    if not exists:
        print("\n❌ alembic_version table does NOT exist!")
        print("   Database has never run Alembic migrations")
    else:
        print("\n✅ alembic_version table exists")
        
        # Get current revision
        cursor.execute("SELECT version_num FROM alembic_version")
        result = cursor.fetchone()
        
        if result:
            print(f"\n📌 Current revision: {result[0]}")
        else:
            print("\n⚠️  alembic_version table is empty")
            
except Exception as e:
    print(f"❌ Query failed: {e}")

cursor.close()
conn.close()

print("\n" + "="*80)
