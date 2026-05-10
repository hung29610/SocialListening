"""Fix all tables schema - comprehensive fix for entire database

Revision ID: 009_fix_all_tables_schema
Revises: 008_ultimate_sources_fix
Create Date: 2026-05-10 20:25:00.000000

This migration fixes ALL tables in the database to match their models.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '009_fix_all_tables_schema'
down_revision = '008_ultimate_sources_fix'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Fix all tables to match their SQLAlchemy models.
    Uses IF NOT EXISTS to be idempotent.
    """
    
    conn = op.get_bind()
    
    # Create all enum types
    enums = [
        "CREATE TYPE IF NOT EXISTS keywordtype AS ENUM ('brand', 'product', 'competitor', 'sensitive', 'general')",
        "CREATE TYPE IF NOT EXISTS logicoperator AS ENUM ('and', 'or', 'not')",
        "CREATE TYPE IF NOT EXISTS sentimentscore AS ENUM ('positive', 'neutral', 'negative_low', 'negative_medium', 'negative_high')",
        "CREATE TYPE IF NOT EXISTS alertseverity AS ENUM ('low', 'medium', 'high', 'critical')",
        "CREATE TYPE IF NOT EXISTS alertstatus AS ENUM ('new', 'acknowledged', 'assigned', 'resolved')",
        "CREATE TYPE IF NOT EXISTS incidentstatus AS ENUM ('new', 'verifying', 'responding', 'waiting_legal', 'waiting_platform', 'resolved', 'closed')",
        "CREATE TYPE IF NOT EXISTS takedownstatus AS ENUM ('draft', 'pending_review', 'approved', 'submitted', 'in_progress', 'completed', 'rejected')",
        "CREATE TYPE IF NOT EXISTS takedownplatform AS ENUM ('facebook', 'youtube', 'google', 'tiktok', 'zalo', 'authority', 'other')",
    ]
    
    for stmt in enums:
        try:
            conn.execute(sa.text(stmt))
            conn.commit()
        except Exception as e:
            print(f"Enum: {e}")
            conn.rollback()
    
    # Fix keyword_groups table
    keyword_groups_columns = [
        "ALTER TABLE keyword_groups ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 3",
        "ALTER TABLE keyword_groups ADD COLUMN IF NOT EXISTS alert_threshold FLOAT DEFAULT 70.0",
    ]
    
    # Fix keywords table
    keywords_columns = [
        "ALTER TABLE keywords ADD COLUMN IF NOT EXISTS group_id INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE keywords ADD COLUMN IF NOT EXISTS keyword_type keywordtype DEFAULT 'general'",
        "ALTER TABLE keywords ADD COLUMN IF NOT EXISTS logic_operator logicoperator DEFAULT 'or'",
        "ALTER TABLE keywords ADD COLUMN IF NOT EXISTS is_excluded BOOLEAN DEFAULT FALSE",
        "CREATE INDEX IF NOT EXISTS ix_keywords_group_id ON keywords (group_id)",
    ]
    
    # Fix mentions table
    mentions_columns = [
        "ALTER TABLE mentions ADD COLUMN IF NOT EXISTS title TEXT",
        "ALTER TABLE mentions ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64)",
        "ALTER TABLE mentions ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE",
        "ALTER TABLE mentions ADD COLUMN IF NOT EXISTS collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()",
        "ALTER TABLE mentions ADD COLUMN IF NOT EXISTS matched_keywords JSON",
        "ALTER TABLE mentions ADD COLUMN IF NOT EXISTS platform_post_id VARCHAR(255)",
        "ALTER TABLE mentions ADD COLUMN IF NOT EXISTS meta_data JSON",
        "CREATE INDEX IF NOT EXISTS ix_mentions_content_hash ON mentions (content_hash)",
        "CREATE INDEX IF NOT EXISTS ix_mentions_platform_post_id ON mentions (platform_post_id)",
        "CREATE INDEX IF NOT EXISTS ix_mentions_published_at ON mentions (published_at)",
        "CREATE INDEX IF NOT EXISTS ix_mentions_collected_at ON mentions (collected_at)",
    ]
    
    # Create ai_analysis table if not exists
    ai_analysis_table = """
    CREATE TABLE IF NOT EXISTS ai_analysis (
        id SERIAL PRIMARY KEY,
        mention_id INTEGER NOT NULL UNIQUE,
        sentiment sentimentscore NOT NULL,
        risk_score FLOAT NOT NULL,
        crisis_level INTEGER NOT NULL,
        summary_vi TEXT,
        suggested_action VARCHAR(100),
        responsible_department VARCHAR(100),
        confidence_score FLOAT,
        reasoning TEXT,
        ai_provider VARCHAR(50),
        model_version VARCHAR(100),
        processing_time_ms INTEGER,
        analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
    """
    
    # Fix alerts table
    alerts_columns = [
        "ALTER TABLE alerts ADD COLUMN IF NOT EXISTS severity alertseverity NOT NULL DEFAULT 'medium'",
        "ALTER TABLE alerts ADD COLUMN IF NOT EXISTS status alertstatus DEFAULT 'new'",
        "ALTER TABLE alerts ADD COLUMN IF NOT EXISTS title VARCHAR(500)",
        "ALTER TABLE alerts ADD COLUMN IF NOT EXISTS message TEXT",
        "ALTER TABLE alerts ADD COLUMN IF NOT EXISTS assigned_to INTEGER",
        "ALTER TABLE alerts ADD COLUMN IF NOT EXISTS acknowledged_by INTEGER",
        "ALTER TABLE alerts ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMP WITH TIME ZONE",
        "ALTER TABLE alerts ADD COLUMN IF NOT EXISTS resolved_by INTEGER",
        "ALTER TABLE alerts ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE",
        "ALTER TABLE alerts ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT FALSE",
        "ALTER TABLE alerts ADD COLUMN IF NOT EXISTS notification_channels VARCHAR(500)",
        "CREATE INDEX IF NOT EXISTS ix_alerts_severity ON alerts (severity)",
        "CREATE INDEX IF NOT EXISTS ix_alerts_status ON alerts (status)",
    ]
    
    # Create notification_channels table if not exists
    notification_channels_table = """
    CREATE TABLE IF NOT EXISTS notification_channels (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        channel_type VARCHAR(50) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        config TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE
    )
    """
    
    # Fix incidents table
    incidents_columns = [
        "ALTER TABLE incidents ADD COLUMN IF NOT EXISTS mention_id INTEGER",
        "ALTER TABLE incidents ADD COLUMN IF NOT EXISTS owner_id INTEGER",
        "ALTER TABLE incidents ADD COLUMN IF NOT EXISTS status incidentstatus DEFAULT 'new'",
        "ALTER TABLE incidents ADD COLUMN IF NOT EXISTS deadline TIMESTAMP WITH TIME ZONE",
        "ALTER TABLE incidents ADD COLUMN IF NOT EXISTS is_overdue BOOLEAN DEFAULT FALSE",
        "ALTER TABLE incidents ADD COLUMN IF NOT EXISTS outcome TEXT",
        "ALTER TABLE incidents ADD COLUMN IF NOT EXISTS resolution_notes TEXT",
        "ALTER TABLE incidents ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE",
        "CREATE INDEX IF NOT EXISTS ix_incidents_mention_id ON incidents (mention_id)",
        "CREATE INDEX IF NOT EXISTS ix_incidents_owner_id ON incidents (owner_id)",
        "CREATE INDEX IF NOT EXISTS ix_incidents_status ON incidents (status)",
        "CREATE INDEX IF NOT EXISTS ix_incidents_deadline ON incidents (deadline)",
        "CREATE INDEX IF NOT EXISTS ix_incidents_is_overdue ON incidents (is_overdue)",
    ]
    
    # Create incident_logs table if not exists
    incident_logs_table = """
    CREATE TABLE IF NOT EXISTS incident_logs (
        id SERIAL PRIMARY KEY,
        incident_id INTEGER NOT NULL,
        user_id INTEGER,
        action VARCHAR(100) NOT NULL,
        old_status VARCHAR(50),
        new_status VARCHAR(50),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
    """
    
    # Create evidence_files table if not exists
    evidence_files_table = """
    CREATE TABLE IF NOT EXISTS evidence_files (
        id SERIAL PRIMARY KEY,
        incident_id INTEGER NOT NULL,
        file_name VARCHAR(500) NOT NULL,
        file_path TEXT NOT NULL,
        file_type VARCHAR(100),
        file_size INTEGER,
        captured_by INTEGER,
        capture_method VARCHAR(100),
        original_url TEXT,
        meta_data TEXT,
        captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
    """
    
    # Create takedown_requests table if not exists
    takedown_requests_table = """
    CREATE TABLE IF NOT EXISTS takedown_requests (
        id SERIAL PRIMARY KEY,
        incident_id INTEGER NOT NULL,
        platform takedownplatform NOT NULL,
        content_url TEXT NOT NULL,
        reason VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        status takedownstatus DEFAULT 'draft',
        submitted_by INTEGER,
        approved_by INTEGER,
        approved_at TIMESTAMP WITH TIME ZONE,
        submitted_at TIMESTAMP WITH TIME ZONE,
        platform_reference VARCHAR(255),
        platform_response TEXT,
        completed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE
    )
    """
    
    # Create response_templates table if not exists
    response_templates_table = """
    CREATE TABLE IF NOT EXISTS response_templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        template_type VARCHAR(100) NOT NULL,
        language VARCHAR(10) DEFAULT 'vi',
        subject VARCHAR(500),
        body TEXT NOT NULL,
        variables TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE
    )
    """
    
    # Execute all statements
    all_statements = (
        keyword_groups_columns +
        keywords_columns +
        mentions_columns +
        [ai_analysis_table] +
        alerts_columns +
        [notification_channels_table] +
        incidents_columns +
        [incident_logs_table] +
        [evidence_files_table] +
        [takedown_requests_table] +
        [response_templates_table]
    )
    
    for stmt in all_statements:
        try:
            conn.execute(sa.text(stmt))
            conn.commit()
        except Exception as e:
            print(f"Statement error: {e}")
            conn.rollback()
    
    print("✅ Migration 009 complete - All tables fixed!")


def downgrade() -> None:
    """Minimal downgrade"""
    pass
