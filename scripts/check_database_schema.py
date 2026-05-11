"""
Check Database Schema - Verify columns exist
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
    print("\nSet it with:")
    print('set DATABASE_URL=postgresql://...')
    sys.exit(1)

print("="*80)
print("CHECKING DATABASE SCHEMA")
print("="*80)
print(f"\nDatabase URL: {DATABASE_URL[:50]}...")

try:
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    print("✅ Connected successfully!")
except Exception as e:
    print(f"❌ Connection failed: {e}")
    sys.exit(1)

# Check sources table columns
print("\n" + "="*80)
print("SOURCES TABLE COLUMNS")
print("="*80)

try:
    cursor.execute("""
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'sources' 
        ORDER BY ordinal_position
    """)
    
    columns = cursor.fetchall()
    
    if not columns:
        print("❌ Sources table does not exist!")
    else:
        print(f"\n✅ Sources table has {len(columns)} columns:\n")
        for col_name, col_type, nullable, default in columns:
            print(f"  {col_name:25} {col_type:20} {'NULL' if nullable == 'YES' else 'NOT NULL':10} {default or ''}")
        
        # Check for required columns
        col_names = [c[0] for c in columns]
        required = ['source_type', 'crawl_frequency', 'group_id', 'platform_id', 'meta_data']
        
        print("\n" + "="*80)
        print("REQUIRED COLUMNS CHECK")
        print("="*80)
        
        for req in required:
            if req in col_names:
                print(f"  ✅ {req}")
            else:
                print(f"  ❌ {req} MISSING!")
        
except Exception as e:
    print(f"❌ Query failed: {e}")

cursor.close()
conn.close()

print("\n" + "="*80)
