"""
Check ENUM Values in Database
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
print("CHECKING ENUM VALUES")
print("="*80)

try:
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    print("✅ Connected successfully!\n")
except Exception as e:
    print(f"❌ Connection failed: {e}")
    sys.exit(1)

# Get all enum types
cursor.execute("""
    SELECT t.typname as enum_name,
           e.enumlabel as enum_value
    FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid  
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    ORDER BY t.typname, e.enumsortorder
""")

enums = {}
for row in cursor.fetchall():
    enum_name, enum_value = row
    if enum_name not in enums:
        enums[enum_name] = []
    enums[enum_name].append(enum_value)

if not enums:
    print("❌ No ENUM types found in database!")
else:
    for enum_name, values in sorted(enums.items()):
        print(f"\n📌 {enum_name}:")
        for val in values:
            print(f"   - {val}")

cursor.close()
conn.close()

print("\n" + "="*80)
