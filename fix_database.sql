-- ============================================================================
-- FIX DATABASE SCHEMA - Run this SQL directly in Render PostgreSQL
-- ============================================================================

-- Create enum types
CREATE TYPE IF NOT EXISTS crawlfrequency AS ENUM ('daily', 'weekly', 'monthly', 'yearly', 'manual');
CREATE TYPE IF NOT EXISTS sourcetype AS ENUM ('facebook_page', 'facebook_group', 'facebook_profile', 'youtube_channel', 'youtube_video', 'website', 'news', 'rss', 'forum', 'manual_url');
CREATE TYPE IF NOT EXISTS keywordtype AS ENUM ('brand', 'product', 'competitor', 'sensitive', 'general');
CREATE TYPE IF NOT EXISTS logicoperator AS ENUM ('and', 'or', 'not');
CREATE TYPE IF NOT EXISTS sentimentscore AS ENUM ('positive', 'neutral', 'negative_low', 'negative_medium', 'negative_high');
CREATE TYPE IF NOT EXISTS alertseverity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE IF NOT EXISTS alertstatus AS ENUM ('new', 'acknowledged', 'assigned', 'resolved');
CREATE TYPE IF NOT EXISTS incidentstatus AS ENUM ('new', 'verifying', 'responding', 'waiting_legal', 'waiting_platform', 'resolved', 'closed');

-- ============================================================================
-- FIX SOURCES TABLE
-- ============================================================================

-- Drop old crawl_frequency if it's INTEGER
ALTER TABLE sources DROP COLUMN IF EXISTS crawl_frequency CASCADE;

-- Add all missing columns
ALTER TABLE sources ADD COLUMN IF NOT EXISTS group_id INTEGER;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS platform_id VARCHAR(255);
ALTER TABLE sources ADD COLUMN IF NOT EXISTS meta_data JSON;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS crawl_frequency crawlfrequency DEFAULT 'manual';
ALTER TABLE sources ADD COLUMN IF NOT EXISTS crawl_time TIME;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS crawl_day_of_week INTEGER;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS crawl_day_of_month INTEGER;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS crawl_month INTEGER;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS next_crawl_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS last_crawled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS last_success_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS crawl_count INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0 NOT NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS ix_sources_group_id ON sources (group_id);
CREATE INDEX IF NOT EXISTS ix_sources_crawl_frequency ON sources (crawl_frequency);

-- ============================================================================
-- FIX KEYWORDS TABLE
-- ============================================================================

ALTER TABLE keywords ADD COLUMN IF NOT EXISTS group_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE keywords ADD COLUMN IF NOT EXISTS keyword_type keywordtype DEFAULT 'general';
ALTER TABLE keywords ADD COLUMN IF NOT EXISTS logic_operator logicoperator DEFAULT 'or';
ALTER TABLE keywords ADD COLUMN IF NOT EXISTS is_excluded BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS ix_keywords_group_id ON keywords (group_id);

-- ============================================================================
-- FIX KEYWORD_GROUPS TABLE
-- ============================================================================

ALTER TABLE keyword_groups ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 3;
ALTER TABLE keyword_groups ADD COLUMN IF NOT EXISTS alert_threshold FLOAT DEFAULT 70.0;

-- ============================================================================
-- FIX MENTIONS TABLE
-- ============================================================================

ALTER TABLE mentions ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE mentions ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64);
ALTER TABLE mentions ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE mentions ADD COLUMN IF NOT EXISTS collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE mentions ADD COLUMN IF NOT EXISTS matched_keywords JSON;
ALTER TABLE mentions ADD COLUMN IF NOT EXISTS platform_post_id VARCHAR(255);
ALTER TABLE mentions ADD COLUMN IF NOT EXISTS meta_data JSON;
CREATE INDEX IF NOT EXISTS ix_mentions_content_hash ON mentions (content_hash);
CREATE INDEX IF NOT EXISTS ix_mentions_platform_post_id ON mentions (platform_post_id);
CREATE INDEX IF NOT EXISTS ix_mentions_published_at ON mentions (published_at);
CREATE INDEX IF NOT EXISTS ix_mentions_collected_at ON mentions (collected_at);

-- ============================================================================
-- FIX ALERTS TABLE
-- ============================================================================

ALTER TABLE alerts ADD COLUMN IF NOT EXISTS severity alertseverity NOT NULL DEFAULT 'medium';
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS status alertstatus DEFAULT 'new';
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS title VARCHAR(500);
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS assigned_to INTEGER;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS acknowledged_by INTEGER;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS resolved_by INTEGER;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS notification_channels VARCHAR(500);
CREATE INDEX IF NOT EXISTS ix_alerts_severity ON alerts (severity);
CREATE INDEX IF NOT EXISTS ix_alerts_status ON alerts (status);

-- ============================================================================
-- FIX INCIDENTS TABLE
-- ============================================================================

ALTER TABLE incidents ADD COLUMN IF NOT EXISTS mention_id INTEGER;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS owner_id INTEGER;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS status incidentstatus DEFAULT 'new';
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS deadline TIMESTAMP WITH TIME ZONE;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS is_overdue BOOLEAN DEFAULT FALSE;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS outcome TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS resolution_notes TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS ix_incidents_mention_id ON incidents (mention_id);
CREATE INDEX IF NOT EXISTS ix_incidents_owner_id ON incidents (owner_id);
CREATE INDEX IF NOT EXISTS ix_incidents_status ON incidents (status);
CREATE INDEX IF NOT EXISTS ix_incidents_deadline ON incidents (deadline);
CREATE INDEX IF NOT EXISTS ix_incidents_is_overdue ON incidents (is_overdue);

-- ============================================================================
-- DONE
-- ============================================================================

SELECT 'Database schema fixed successfully!' AS result;
