"""Check which migrations have been applied"""
import psycopg2
import os
from dotenv import load_dotenv
from pathlib import Path

# Load .env from backend directory
backend_dir = Path(__file__).parent.parent / "backend"
env_path = backend_dir / ".env"
load_dotenv(env_path)

# Connect to database
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("❌ DATABASE_URL not found in .env")
    exit(1)

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

# Check alembic_version table
print("🔍 Checking applied migrations...")
cur.execute("SELECT version_num FROM alembic_version")
result = cur.fetchone()

if result:
    current_version = result[0]
    print(f"✅ Current migration version: {current_version}")
else:
    print("❌ No migrations applied yet")

# Check if roles table exists and its schema
print("\n🔍 Checking roles table schema...")
cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'roles'
    ORDER BY ordinal_position
""")
columns = cur.fetchall()

if columns:
    print("✅ Roles table exists with columns:")
    for col_name, col_type in columns:
        print(f"  - {col_name}: {col_type}")
else:
    print("❌ Roles table does not exist")

cur.close()
conn.close()
