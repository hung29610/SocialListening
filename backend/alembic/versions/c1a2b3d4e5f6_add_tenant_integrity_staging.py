"""add tenant integrity staging columns and quarantine ledger

Revision ID: c1a2b3d4e5f6
Revises: 7c2e4d6b8a91
Create Date: 2026-08-01

Schema only: this revision deliberately does not backfill production data.
"""
from alembic import op
import sqlalchemy as sa


revision = "c1a2b3d4e5f6"
down_revision = "7c2e4d6b8a91"
branch_labels = None
depends_on = None


_COLUMNS = {
    "source_items": ("organization_id", "user_id"),
    "crawl_jobs": ("organization_id", "project_id"),
    "scan_schedules": ("organization_id",),
    "discovery_jobs": ("organization_id",),
    "discovered_sources": ("organization_id", "user_id"),
    "blocked_domains": ("organization_id",),
    "report_exports": ("organization_id",),
}


def upgrade() -> None:
    for table, columns in _COLUMNS.items():
        for column in columns:
            op.add_column(table, sa.Column(column, sa.Integer(), nullable=True))
            op.create_index(f"ix_{table}_{column}", table, [column], unique=False)

    op.create_table(
        "tenant_integrity_quarantine",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("table_name", sa.String(length=80), nullable=False),
        sa.Column("row_identifier", sa.String(length=255), nullable=False),
        sa.Column("reason_code", sa.String(length=80), nullable=False),
        sa.Column("evidence", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="open"),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("table_name", "row_identifier", "reason_code", name="uq_tenant_quarantine_row_reason"),
    )
    op.create_index("ix_tenant_integrity_quarantine_table_name", "tenant_integrity_quarantine", ["table_name"])
    op.create_index("ix_tenant_integrity_quarantine_reason_code", "tenant_integrity_quarantine", ["reason_code"])
    op.create_index("ix_tenant_integrity_quarantine_status", "tenant_integrity_quarantine", ["status"])

    op.create_table(
        "tenant_integrity_audit_state",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="unknown"),
        sa.Column("unresolved_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("conflict_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("tenant_integrity_audit_state")
    op.drop_index("ix_tenant_integrity_quarantine_status", table_name="tenant_integrity_quarantine")
    op.drop_index("ix_tenant_integrity_quarantine_reason_code", table_name="tenant_integrity_quarantine")
    op.drop_index("ix_tenant_integrity_quarantine_table_name", table_name="tenant_integrity_quarantine")
    op.drop_table("tenant_integrity_quarantine")
    for table, columns in reversed(tuple(_COLUMNS.items())):
        for column in reversed(columns):
            op.drop_index(f"ix_{table}_{column}", table_name=table)
            op.drop_column(table, column)
