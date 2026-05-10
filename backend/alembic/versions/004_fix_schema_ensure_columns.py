"""Ensure all schema columns exist and fix source_groups table

Revision ID: 004_fix_schema_ensure_columns
Revises: 003_add_service_catalog
Create Date: 2026-05-10 16:00:00.000000

This migration is ADDITIVE ONLY — it uses IF NOT EXISTS checks so it is
safe to run against a DB that already has some or all columns.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import text

revision = '004_fix_schema_ensure_columns'
down_revision = '003_add_service_catalog'
branch_labels = None
depends_on = None


def column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    result = bind.execute(text(
        "SELECT COUNT(*) FROM information_schema.columns "
        "WHERE table_name=:t AND column_name=:c"
    ), {"t": table, "c": column})
    return result.scalar() > 0


def table_exists(table: str) -> bool:
    bind = op.get_bind()
    result = bind.execute(text(
        "SELECT COUNT(*) FROM information_schema.tables "
        "WHERE table_name=:t"
    ), {"t": table})
    return result.scalar() > 0


def upgrade() -> None:
    bind = op.get_bind()

    # ── source_groups ──────────────────────────────────────────────────────────
    if not table_exists('source_groups'):
        op.create_table(
            'source_groups',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('name', sa.String(255), nullable=False, index=True),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('is_active', sa.Boolean(), default=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
        )

    # ── sources ────────────────────────────────────────────────────────────────
    if not table_exists('sources'):
        # Create enum types first
        bind.execute(text(
            "DO $$ BEGIN "
            "CREATE TYPE sourcetype AS ENUM ("
            "'facebook_page','facebook_group','facebook_profile',"
            "'youtube_channel','youtube_video','website','news','rss','forum','manual_url'"
            "); EXCEPTION WHEN duplicate_object THEN NULL; END $$"
        ))
        bind.execute(text(
            "DO $$ BEGIN "
            "CREATE TYPE crawlfrequency AS ENUM ("
            "'daily','weekly','monthly','yearly','manual'"
            "); EXCEPTION WHEN duplicate_object THEN NULL; END $$"
        ))
        op.create_table(
            'sources',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('group_id', sa.Integer(), nullable=True, index=True),
            sa.Column('name', sa.String(500), nullable=False),
            sa.Column('source_type', sa.Text(), nullable=False, index=True),
            sa.Column('url', sa.Text(), nullable=False),
            sa.Column('platform_id', sa.String(255), nullable=True),
            sa.Column('meta_data', sa.JSON(), nullable=True),
            sa.Column('crawl_frequency', sa.Text(), server_default='manual'),
            sa.Column('crawl_time', sa.Time(), nullable=True),
            sa.Column('crawl_day_of_week', sa.Integer(), nullable=True),
            sa.Column('crawl_day_of_month', sa.Integer(), nullable=True),
            sa.Column('crawl_month', sa.Integer(), nullable=True),
            sa.Column('next_crawl_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('is_active', sa.Boolean(), default=True, index=True),
            sa.Column('last_crawled_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('last_success_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('last_error', sa.Text(), nullable=True),
            sa.Column('crawl_count', sa.Integer(), default=0),
            sa.Column('error_count', sa.Integer(), default=0),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
        )
    else:
        # Table exists — add any missing columns one by one
        missing_cols = {
            'meta_data': "ALTER TABLE sources ADD COLUMN IF NOT EXISTS meta_data JSONB",
            'platform_id': "ALTER TABLE sources ADD COLUMN IF NOT EXISTS platform_id VARCHAR(255)",
            'crawl_frequency': "ALTER TABLE sources ADD COLUMN IF NOT EXISTS crawl_frequency TEXT DEFAULT 'manual'",
            'crawl_time': "ALTER TABLE sources ADD COLUMN IF NOT EXISTS crawl_time TIME",
            'crawl_day_of_week': "ALTER TABLE sources ADD COLUMN IF NOT EXISTS crawl_day_of_week INTEGER",
            'crawl_day_of_month': "ALTER TABLE sources ADD COLUMN IF NOT EXISTS crawl_day_of_month INTEGER",
            'crawl_month': "ALTER TABLE sources ADD COLUMN IF NOT EXISTS crawl_month INTEGER",
            'next_crawl_at': "ALTER TABLE sources ADD COLUMN IF NOT EXISTS next_crawl_at TIMESTAMPTZ",
            'last_success_at': "ALTER TABLE sources ADD COLUMN IF NOT EXISTS last_success_at TIMESTAMPTZ",
            'last_error': "ALTER TABLE sources ADD COLUMN IF NOT EXISTS last_error TEXT",
            'crawl_count': "ALTER TABLE sources ADD COLUMN IF NOT EXISTS crawl_count INTEGER DEFAULT 0",
            'error_count': "ALTER TABLE sources ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0",
            'group_id': "ALTER TABLE sources ADD COLUMN IF NOT EXISTS group_id INTEGER",
        }
        for col, ddl in missing_cols.items():
            try:
                bind.execute(text(ddl))
            except Exception as e:
                print(f"  skipped {col}: {e}")

    # ── keywords / keyword_groups ──────────────────────────────────────────────
    if not table_exists('keyword_groups'):
        op.create_table(
            'keyword_groups',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('name', sa.String(255), nullable=False, index=True),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('priority', sa.Integer(), default=3),
            sa.Column('alert_threshold', sa.Float(), default=70.0),
            sa.Column('is_active', sa.Boolean(), default=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
        )
    else:
        for col, ddl in {
            'priority': "ALTER TABLE keyword_groups ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 3",
            'alert_threshold': "ALTER TABLE keyword_groups ADD COLUMN IF NOT EXISTS alert_threshold FLOAT DEFAULT 70.0",
        }.items():
            try:
                bind.execute(text(ddl))
            except Exception as e:
                print(f"  skipped keyword_groups.{col}: {e}")

    # ── mentions ───────────────────────────────────────────────────────────────
    for col, ddl in {
        'content_hash': "ALTER TABLE mentions ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64)",
        'matched_keywords': "ALTER TABLE mentions ADD COLUMN IF NOT EXISTS matched_keywords JSONB DEFAULT '[]'",
        'published_at': "ALTER TABLE mentions ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ",
        'author': "ALTER TABLE mentions ADD COLUMN IF NOT EXISTS author VARCHAR(255)",
    }.items():
        try:
            bind.execute(text(ddl))
        except Exception as e:
            print(f"  skipped mentions.{col}: {e}")

    # ── incidents ──────────────────────────────────────────────────────────────
    for col, ddl in {
        'deadline': "ALTER TABLE incidents ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ",
        'resolution_notes': "ALTER TABLE incidents ADD COLUMN IF NOT EXISTS resolution_notes TEXT",
        'is_overdue': "ALTER TABLE incidents ADD COLUMN IF NOT EXISTS is_overdue BOOLEAN DEFAULT FALSE",
    }.items():
        try:
            bind.execute(text(ddl))
        except Exception as e:
            print(f"  skipped incidents.{col}: {e}")

    # ── reports ────────────────────────────────────────────────────────────────
    for col, ddl in {
        'generated_at': "ALTER TABLE reports ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ",
        'start_date': "ALTER TABLE reports ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ",
        'end_date': "ALTER TABLE reports ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ",
    }.items():
        try:
            bind.execute(text(ddl))
        except Exception as e:
            print(f"  skipped reports.{col}: {e}")

    print("Migration 004: schema sync complete")


def downgrade() -> None:
    # This migration only adds columns/tables, downgrade is a no-op
    # to avoid accidental data loss
    pass
