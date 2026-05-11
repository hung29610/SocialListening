"""
Fix ENUM case - Convert UPPERCASE to lowercase
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
print("FIX ENUM CASE - Convert to lowercase")
print("="*80)

try:
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    print("✅ Connected successfully!\n")
except Exception as e:
    print(f"❌ Connection failed: {e}")
    sys.exit(1)

# Enum mappings: old_value -> new_value
enum_fixes = {
    'servicetype': {
        'CRISIS_CONSULTING': 'crisis_consulting',
        'MONITORING': 'monitoring',
        'LEGAL_TAKEDOWN': 'legal_takedown',
        'PRESS_MEDIA': 'press_media',
        'COPYRIGHT_PROTECTION': 'copyright_protection',
        'COMMUNITY_RESPONSE': 'community_response',
        'REPUTATION_MANAGEMENT': 'reputation_management',
        'EVIDENCE_COLLECTION': 'evidence_collection',
        'AI_REPORTING': 'ai_reporting',
    },
    'platform': {
        'FACEBOOK': 'facebook',
        'YOUTUBE': 'youtube',
        'TIKTOK': 'tiktok',
        'TWITTER': 'twitter',
        'INSTAGRAM': 'instagram',
        'WEBSITE': 'website',
        'NEWS_MEDIA': 'news_media',
        'ALL_PLATFORMS': 'all_platforms',
    },
    'risklevel': {
        'LOW': 'low',
        'MEDIUM': 'medium',
        'HIGH': 'high',
        'CRITICAL': 'critical',
    },
    'priority': {
        'LOW': 'low',
        'MEDIUM': 'medium',
        'HIGH': 'high',
        'URGENT': 'urgent',
    },
    'servicerequeststatus': {
        'DRAFT': 'draft',
        'SUBMITTED': 'submitted',
        'PENDING_APPROVAL': 'pending_approval',
        'APPROVED': 'approved',
        'IN_PROGRESS': 'in_progress',
        'WAITING_EXTERNAL_RESPONSE': 'waiting_external_response',
        'COMPLETED': 'completed',
        'REJECTED': 'rejected',
        'CANCELLED': 'cancelled',
    },
    'approvalstatus': {
        'NOT_REQUIRED': 'not_required',
        'PENDING': 'pending',
        'APPROVED': 'approved',
        'REJECTED': 'rejected',
        'REVISION_REQUIRED': 'revision_required',
    },
    'deliverabletype': {
        'REPORT': 'report',
        'DRAFT_RESPONSE': 'draft_response',
        'LEGAL_DOCUMENT': 'legal_document',
        'EVIDENCE_PACKAGE': 'evidence_package',
        'STRATEGY_PLAN': 'strategy_plan',
        'BRIEFING': 'briefing',
        'MONITORING_DASHBOARD': 'monitoring_dashboard',
    },
    'alertseverity': {
        'LOW': 'low',
        'MEDIUM': 'medium',
        'HIGH': 'high',
        'CRITICAL': 'critical',
    },
    'alertstatus': {
        'NEW': 'new',
        'ACKNOWLEDGED': 'acknowledged',
        'ASSIGNED': 'assigned',
        'RESOLVED': 'resolved',
    },
    'incidentstatus': {
        'NEW': 'new',
        'VERIFYING': 'verifying',
        'RESPONDING': 'responding',
        'WAITING_LEGAL': 'waiting_legal',
        'WAITING_PLATFORM': 'waiting_platform',
        'RESOLVED': 'resolved',
        'CLOSED': 'closed',
    },
    'takedownplatform': {
        'FACEBOOK': 'facebook',
        'YOUTUBE': 'youtube',
        'GOOGLE': 'google',
        'TIKTOK': 'tiktok',
        'ZALO': 'zalo',
        'AUTHORITY': 'authority',
        'OTHER': 'other',
    },
    'takedownstatus': {
        'DRAFT': 'draft',
        'PENDING_REVIEW': 'pending_review',
        'APPROVED': 'approved',
        'SUBMITTED': 'submitted',
        'IN_PROGRESS': 'in_progress',
        'COMPLETED': 'completed',
        'REJECTED': 'rejected',
    },
    'reporttype': {
        'DAILY': 'daily',
        'WEEKLY': 'weekly',
        'MONTHLY': 'monthly',
        'CRISIS': 'crisis',
        'CUSTOM': 'custom',
    },
    'reportstatus': {
        'GENERATING': 'generating',
        'COMPLETED': 'completed',
        'FAILED': 'failed',
    },
    'crawljobstatus': {
        'PENDING': 'pending',
        'RUNNING': 'running',
        'COMPLETED': 'completed',
        'FAILED': 'failed',
        'CANCELLED': 'cancelled',
    },
    'sentimentscore': {
        'POSITIVE': 'positive',
        'NEUTRAL': 'neutral',
        'NEGATIVE_LOW': 'negative_low',
        'NEGATIVE_MEDIUM': 'negative_medium',
        'NEGATIVE_HIGH': 'negative_high',
    },
    'keywordtype': {
        'BRAND': 'brand',
        'PRODUCT': 'product',
        'COMPETITOR': 'competitor',
        'SENSITIVE': 'sensitive',
        'GENERAL': 'general',
    },
    'logicoperator': {
        'AND': 'and',
        'OR': 'or',
        'NOT': 'not',
    },
}

print("Fixing enum values...")
for enum_name, mappings in enum_fixes.items():
    print(f"\n📌 {enum_name}:")
    for old_val, new_val in mappings.items():
        try:
            # Add new value if not exists
            cursor.execute(f"""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_enum e
                        JOIN pg_type t ON e.enumtypid = t.oid
                        WHERE t.typname = '{enum_name}' AND e.enumlabel = '{new_val}'
                    ) THEN
                        ALTER TYPE {enum_name} ADD VALUE '{new_val}';
                    END IF;
                END $$;
            """)
            conn.commit()
            print(f"  ✅ Added: {new_val}")
        except Exception as e:
            print(f"  ⚠️  {new_val}: {e}")
            conn.rollback()

print("\n" + "="*80)
print("✅ DONE! Enum values updated")
print("="*80)
print("\nNow you can use lowercase values in your code")
print("Old UPPERCASE values still exist for backward compatibility")

cursor.close()
conn.close()
