"""fix app wide missing columns

Revision ID: 012_fix_app_wide_missing_columns
Revises: 011_fix_sources_missing_crawl_columns
Create Date: 2026-05-10 22:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '012_fix_app_wide_missing_columns'
down_revision = '011_fix_sources_missing_crawl_columns'
branch_labels = None
depends_on = None


def _tables() -> set[str]:
    return set(sa.inspect(op.get_bind()).get_table_names())


def _columns(table_name: str) -> set[str]:
    return {column["name"] for column in sa.inspect(op.get_bind()).get_columns(table_name)}


def _ensure_table(table_name: str) -> None:
    if table_name not in _tables():
        op.get_bind().execute(sa.text(f"CREATE TABLE {table_name} (id SERIAL PRIMARY KEY)"))


def _add(table_name: str, column: sa.Column) -> None:
    _ensure_table(table_name)
    if column.name not in _columns(table_name):
        op.add_column(table_name, column)


def _idx(name: str, table_name: str, column_name: str) -> None:
    op.get_bind().execute(sa.text(f"CREATE INDEX IF NOT EXISTS {name} ON {table_name} ({column_name})"))


def upgrade() -> None:
    bind = op.get_bind()

    # User/authorization support tables present in models but missing from the initial migration.
    _add("roles", sa.Column("name", sa.String(length=100), nullable=True))
    _add("roles", sa.Column("description", sa.Text(), nullable=True))
    _add("roles", sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("now()")))
    _idx("ix_roles_id", "roles", "id")

    _add("permissions", sa.Column("name", sa.String(length=100), nullable=True))
    _add("permissions", sa.Column("resource", sa.String(length=100), nullable=True))
    _add("permissions", sa.Column("action", sa.String(length=50), nullable=True))
    _add("permissions", sa.Column("description", sa.Text(), nullable=True))
    _add("permissions", sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("now()")))
    _idx("ix_permissions_id", "permissions", "id")

    _add("audit_logs", sa.Column("user_id", sa.Integer(), nullable=True))
    _add("audit_logs", sa.Column("action", sa.String(length=100), nullable=True))
    _add("audit_logs", sa.Column("resource_type", sa.String(length=100), nullable=True))
    _add("audit_logs", sa.Column("resource_id", sa.Integer(), nullable=True))
    _add("audit_logs", sa.Column("ip_address", sa.String(length=50), nullable=True))
    _add("audit_logs", sa.Column("user_agent", sa.Text(), nullable=True))
    _add("audit_logs", sa.Column("details", sa.Text(), nullable=True))
    _add("audit_logs", sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("now()")))
    _idx("ix_audit_logs_created_at", "audit_logs", "created_at")

    # Source grouping and crawl scheduler models.
    _add("source_groups", sa.Column("name", sa.String(length=255), nullable=True))
    _add("source_groups", sa.Column("description", sa.Text(), nullable=True))
    _add("source_groups", sa.Column("is_active", sa.Boolean(), nullable=True, server_default=sa.text("true")))
    _add("source_groups", sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("now()")))
    _add("source_groups", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))
    _idx("ix_source_groups_name", "source_groups", "name")

    _add("crawl_jobs", sa.Column("job_type", sa.String(length=50), nullable=True))
    _add("crawl_jobs", sa.Column("source_ids", sa.JSON(), nullable=True))
    _add("crawl_jobs", sa.Column("keyword_group_ids", sa.JSON(), nullable=True))
    _add("crawl_jobs", sa.Column("status", sa.String(), nullable=True, server_default="pending"))
    _add("crawl_jobs", sa.Column("total_sources", sa.Integer(), nullable=True, server_default="0"))
    _add("crawl_jobs", sa.Column("processed_sources", sa.Integer(), nullable=True, server_default="0"))
    _add("crawl_jobs", sa.Column("mentions_found", sa.Integer(), nullable=True, server_default="0"))
    _add("crawl_jobs", sa.Column("error_message", sa.Text(), nullable=True))
    _add("crawl_jobs", sa.Column("retry_count", sa.Integer(), nullable=True, server_default="0"))
    _add("crawl_jobs", sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("now()")))
    _add("crawl_jobs", sa.Column("started_at", sa.DateTime(timezone=True), nullable=True))
    _add("crawl_jobs", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))
    _add("crawl_jobs", sa.Column("meta_data", sa.JSON(), nullable=True))
    _idx("ix_crawl_jobs_status", "crawl_jobs", "status")

    _add("scan_schedules", sa.Column("name", sa.String(length=255), nullable=True))
    _add("scan_schedules", sa.Column("description", sa.Text(), nullable=True))
    _add("scan_schedules", sa.Column("cron_expression", sa.String(length=100), nullable=True))
    _add("scan_schedules", sa.Column("timezone", sa.String(length=50), nullable=True, server_default="Asia/Ho_Chi_Minh"))
    _add("scan_schedules", sa.Column("source_group_ids", sa.JSON(), nullable=True))
    _add("scan_schedules", sa.Column("keyword_group_ids", sa.JSON(), nullable=True))
    _add("scan_schedules", sa.Column("is_active", sa.Boolean(), nullable=True, server_default=sa.text("true")))
    _add("scan_schedules", sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True))
    _add("scan_schedules", sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True))
    _add("scan_schedules", sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("now()")))
    _add("scan_schedules", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))
    _idx("ix_scan_schedules_next_run_at", "scan_schedules", "next_run_at")

    # Reports drifted significantly from the initial migration.
    _add("reports", sa.Column("description", sa.Text(), nullable=True))
    _add("reports", sa.Column("start_date", sa.DateTime(timezone=True), nullable=True))
    _add("reports", sa.Column("end_date", sa.DateTime(timezone=True), nullable=True))
    _add("reports", sa.Column("status", sa.String(), nullable=True, server_default="generating"))
    _add("reports", sa.Column("pdf_path", sa.Text(), nullable=True))
    _add("reports", sa.Column("excel_path", sa.Text(), nullable=True))
    _add("reports", sa.Column("json_path", sa.Text(), nullable=True))
    _add("reports", sa.Column("generated_by", sa.Integer(), nullable=True))
    _add("reports", sa.Column("error_message", sa.Text(), nullable=True))
    _add("reports", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))
    _add("reports", sa.Column("email_sent", sa.Boolean(), nullable=True, server_default=sa.text("false")))
    _add("reports", sa.Column("email_recipients", sa.Text(), nullable=True))
    _add("reports", sa.Column("email_sent_at", sa.DateTime(timezone=True), nullable=True))

    _add("system_settings", sa.Column("key", sa.String(length=255), nullable=True))
    _add("system_settings", sa.Column("value", sa.Text(), nullable=True))
    _add("system_settings", sa.Column("value_type", sa.String(length=50), nullable=True, server_default="string"))
    _add("system_settings", sa.Column("description", sa.Text(), nullable=True))
    _add("system_settings", sa.Column("is_public", sa.Boolean(), nullable=True, server_default=sa.text("false")))
    _add("system_settings", sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("now()")))
    _add("system_settings", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))
    _idx("ix_system_settings_key", "system_settings", "key")

    # Tighten safe integer defaults on already-known operational counters.
    for table_name, column_name in (
        ("crawl_jobs", "total_sources"),
        ("crawl_jobs", "processed_sources"),
        ("crawl_jobs", "mentions_found"),
        ("crawl_jobs", "retry_count"),
        ("sources", "crawl_count"),
        ("sources", "error_count"),
    ):
        if table_name in _tables() and column_name in _columns(table_name):
            bind.execute(sa.text(f"UPDATE {table_name} SET {column_name} = 0 WHERE {column_name} IS NULL"))


def downgrade() -> None:
    pass
