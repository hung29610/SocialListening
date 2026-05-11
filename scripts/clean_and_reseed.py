"""
Clean old data and reseed with correct enum values
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
print("CLEAN AND RESEED DATABASE")
print("="*80)

try:
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    print("✅ Connected successfully!\n")
except Exception as e:
    print(f"❌ Connection failed: {e}")
    sys.exit(1)

# Delete all data from tables with enum issues
tables_to_clean = [
    'service_deliverables',
    'service_request_logs', 
    'service_requests',
    'services',
    'crawl_jobs',
    'ai_analysis',
    'mentions',
    'alerts',
    'incidents',
    'incident_logs',
    'takedown_requests',
    'reports',
]

print("Cleaning old data...")
for table in tables_to_clean:
    try:
        cursor.execute(f"DELETE FROM {table}")
        count = cursor.rowcount
        print(f"  ✅ {table}: deleted {count} rows")
    except Exception as e:
        print(f"  ⚠️  {table}: {e}")
        conn.rollback()
        continue

conn.commit()

print("\n" + "="*80)
print("✅ DONE! Database cleaned")
print("="*80)
print("\nNow restart Render service to reseed services")

cursor.close()
conn.close()
