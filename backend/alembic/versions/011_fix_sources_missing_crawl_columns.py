"""fix sources missing crawl columns

Revision ID: 011_fix_sources_missing_crawl_columns
Revises: 010_merge_service_and_schema_heads
Create Date: 2026-05-10 22:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '011_fix_sources_missing_crawl_columns'
down_revision = '010_merge_service_and_schema_heads'
branch_labels = None
depends_on = None


def _columns(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return {column["name"] for column in inspector.get_columns(table_name)}


def _add_column_if_missing(table_name: str, column: sa.Column) -> None:
    if column.name not in _columns(table_name):
        op.add_column(table_name, column)


def upgrade() -> None:
    bind = op.get_bind()

    bind.execute(sa.text("""
    CREATE TABLE IF NOT EXISTS sources (
        id SERIAL PRIMARY KEY
    )
    """))

    bind.execute(sa.text("""
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sourcetype') THEN
            CREATE TYPE sourcetype AS ENUM (
                'facebook_page', 'facebook_group', 'facebook_profile',
                'youtube_channel', 'youtube_video', 'website', 'news',
                'rss', 'forum', 'manual_url'
            );
        END IF;
    END
    $$;
    """))

    _add_column_if_missing("sources", sa.Column("group_id", sa.Integer(), nullable=True))
    _add_column_if_missing("sources", sa.Column("name", sa.String(length=500), nullable=True))
    _add_column_if_missing("sources", sa.Column("source_type", sa.String(), nullable=True))
    _add_column_if_missing("sources", sa.Column("url", sa.Text(), nullable=True))
    _add_column_if_missing("sources", sa.Column("platform_id", sa.String(length=255), nullable=True))
    _add_column_if_missing("sources", sa.Column("meta_data", sa.JSON(), nullable=True))

    _add_column_if_missing("sources", sa.Column("crawl_frequency", sa.String(), nullable=True, server_default="daily"))
    _add_column_if_missing("sources", sa.Column("crawl_time", sa.Time(), nullable=True))
    _add_column_if_missing("sources", sa.Column("crawl_day_of_week", sa.Integer(), nullable=True))
    _add_column_if_missing("sources", sa.Column("crawl_day_of_month", sa.Integer(), nullable=True))
    _add_column_if_missing("sources", sa.Column("crawl_month", sa.Integer(), nullable=True))
    _add_column_if_missing("sources", sa.Column("next_crawl_at", sa.DateTime(timezone=True), nullable=True))

    _add_column_if_missing("sources", sa.Column("is_active", sa.Boolean(), nullable=True, server_default=sa.text("true")))
    _add_column_if_missing("sources", sa.Column("last_crawled_at", sa.DateTime(timezone=True), nullable=True))
    _add_column_if_missing("sources", sa.Column("last_success_at", sa.DateTime(timezone=True), nullable=True))
    _add_column_if_missing("sources", sa.Column("last_error", sa.Text(), nullable=True))
    _add_column_if_missing("sources", sa.Column("crawl_count", sa.Integer(), nullable=False, server_default="0"))
    _add_column_if_missing("sources", sa.Column("error_count", sa.Integer(), nullable=False, server_default="0"))

    _add_column_if_missing("sources", sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("now()")))
    _add_column_if_missing("sources", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))

    bind.execute(sa.text("UPDATE sources SET crawl_count = 0 WHERE crawl_count IS NULL"))
    bind.execute(sa.text("UPDATE sources SET error_count = 0 WHERE error_count IS NULL"))
    bind.execute(sa.text("UPDATE sources SET crawl_frequency = 'daily' WHERE crawl_frequency IS NULL"))

    bind.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_sources_group_id ON sources (group_id)"))
    bind.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_sources_source_type ON sources (source_type)"))
    bind.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_sources_crawl_frequency ON sources (crawl_frequency)"))
    bind.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_sources_is_active ON sources (is_active)"))


def downgrade() -> None:
    pass
