"""
Comprehensive Database Audit
Check all tables against SQLAlchemy models
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
print("COMPREHENSIVE DATABASE AUDIT")
print("="*80)
print(f"\nDatabase URL: {DATABASE_URL[:50]}...")

try:
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    print("✅ Connected successfully!\n")
except Exception as e:
    print(f"❌ Connection failed: {e}")
    sys.exit(1)

# Expected tables and their critical columns
EXPECTED_SCHEMA = {
    "users": ["id", "email", "hashed_password", "full_name", "is_active", "is_superuser"],
    "roles": ["id", "name", "description"],
    "permissions": ["id", "name", "resource", "action"],
    "audit_logs": ["id", "user_id", "action", "resource_type", "resource_id"],
    
    "keyword_groups": ["id", "name", "description", "priority", "alert_threshold", "is_active"],
    "keywords": ["id", "group_id", "keyword", "keyword_type", "logic_operator", "is_excluded", "is_active"],
    
    "source_groups": ["id", "name", "description", "is_active"],
    "sources": ["id", "group_id", "name", "source_type", "url", "platform_id", "meta_data",
                "crawl_frequency", "crawl_time", "crawl_day_of_week", "crawl_day_of_month", 
                "crawl_month", "next_crawl_at", "is_active", "last_crawled_at", "last_success_at",
                "last_error", "crawl_count", "error_count"],
    
    "scan_schedules": ["id", "name", "cron_expression", "timezone", "source_group_ids", 
                       "keyword_group_ids", "is_active", "last_run_at", "next_run_at"],
    "crawl_jobs": ["id", "job_type", "source_ids", "keyword_group_ids", "status", 
                   "total_sources", "processed_sources", "mentions_found"],
    
    "mentions": ["id", "source_id", "title", "content", "content_hash", "url", "author",
                 "published_at", "collected_at", "matched_keywords", "platform_post_id", "meta_data"],
    "ai_analysis": ["id", "mention_id", "sentiment", "risk_score", "crisis_level",
                    "summary_vi", "suggested_action", "responsible_department"],
    
    "alerts": ["id", "mention_id", "severity", "status", "title", "message", 
               "assigned_to", "acknowledged_by", "acknowledged_at", "resolved_by", "resolved_at"],
    "notification_channels": ["id", "name", "channel_type", "is_active", "config"],
    
    "incidents": ["id", "mention_id", "owner_id", "title", "description", "status",
                  "deadline", "is_overdue", "outcome", "resolution_notes"],
    "incident_logs": ["id", "incident_id", "user_id", "action", "old_status", "new_status", "notes"],
    "evidence_files": ["id", "incident_id", "file_name", "file_path", "file_type", "file_size"],
    "takedown_requests": ["id", "incident_id", "platform", "content_url", "reason", 
                          "description", "status", "submitted_by", "approved_by"],
    "response_templates": ["id", "name", "template_type", "language", "subject", "body", "is_active"],
    
    "reports": ["id", "report_type", "title", "description", "start_date", "end_date",
                "status", "data", "pdf_path", "generated_by"],
    "system_settings": ["id", "key", "value", "value_type", "description", "is_public"],
    
    "service_categories": ["id", "name", "description", "is_active"],
    "services": ["id", "category_id", "code", "name", "description", "service_type",
                 "platform", "legal_basis", "workflow_template", "deliverables",
                 "estimated_duration", "sla_hours", "base_price", "requires_approval", "is_active"],
    "service_requests": ["id", "service_id", "related_mention_id", "related_alert_id",
                         "related_incident_id", "requester_id", "assigned_to", "status",
                         "priority", "request_reason", "approval_status", "quoted_price", "deadline"],
    "service_request_logs": ["id", "service_request_id", "action", "old_status", "new_status", 
                             "note", "created_by"],
    "service_deliverables": ["id", "service_request_id", "deliverable_type", "title",
                             "content", "file_url", "approval_status"],
}

# Check each table
print("="*80)
print("TABLE AUDIT")
print("="*80)

missing_tables = []
tables_with_missing_columns = {}

for table_name, expected_columns in EXPECTED_SCHEMA.items():
    # Check if table exists
    cursor.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = %s
        )
    """, (table_name,))
    
    exists = cursor.fetchone()[0]
    
    if not exists:
        print(f"\n❌ {table_name}: TABLE DOES NOT EXIST")
        missing_tables.append(table_name)
        continue
    
    # Get actual columns
    cursor.execute("""
        SELECT column_name
        FROM information_schema.columns 
        WHERE table_name = %s
        ORDER BY ordinal_position
    """, (table_name,))
    
    actual_columns = [row[0] for row in cursor.fetchall()]
    
    # Check for missing columns
    missing_columns = [col for col in expected_columns if col not in actual_columns]
    
    if missing_columns:
        print(f"\n⚠️  {table_name}: MISSING {len(missing_columns)} COLUMNS")
        for col in missing_columns:
            print(f"     - {col}")
        tables_with_missing_columns[table_name] = missing_columns
    else:
        print(f"\n✅ {table_name}: ALL REQUIRED COLUMNS PRESENT ({len(actual_columns)} total)")

# Summary
print("\n" + "="*80)
print("SUMMARY")
print("="*80)

if missing_tables:
    print(f"\n❌ {len(missing_tables)} TABLES MISSING:")
    for table in missing_tables:
        print(f"   - {table}")
else:
    print("\n✅ All expected tables exist")

if tables_with_missing_columns:
    print(f"\n⚠️  {len(tables_with_missing_columns)} TABLES WITH MISSING COLUMNS:")
    for table, columns in tables_with_missing_columns.items():
        print(f"   - {table}: {len(columns)} columns missing")
else:
    print("\n✅ All tables have required columns")

# Check Alembic version
print("\n" + "="*80)
print("ALEMBIC REVISION")
print("="*80)

cursor.execute("""
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'alembic_version'
    )
""")

if cursor.fetchone()[0]:
    cursor.execute("SELECT version_num FROM alembic_version")
    result = cursor.fetchone()
    if result:
        print(f"\n📌 Current revision: {result[0]}")
    else:
        print("\n⚠️  alembic_version table is empty")
else:
    print("\n❌ alembic_version table does NOT exist")

cursor.close()
conn.close()

print("\n" + "="*80)
