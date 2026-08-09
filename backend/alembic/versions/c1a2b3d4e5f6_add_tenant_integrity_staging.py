"""add tenant integrity staging columns and quarantine ledger

Revision ID: c1a2b3d4e5f6
Revises: 7c2e4d6b8a91
Create Date: 2026-08-01

Schema only: this revision deliberately does not backfill production data.
"""
from alembic import op
import sqlalchemy as sa
import logging


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

logger = logging.getLogger("alembic.runtime.migration")
QUARANTINE_TABLE = "tenant_integrity_quarantine"
AUDIT_TABLE = "tenant_integrity_audit_state"

_QUARANTINE_COLUMNS = {
    "id": ("integer", False),
    "table_name": ("varchar_80", False),
    "row_identifier": ("varchar_255", False),
    "reason_code": ("varchar_80", False),
    "evidence": ("json", False),
    "status": ("varchar_20", False),
    "first_seen_at": ("timestamp_tz", False),
    "last_seen_at": ("timestamp_tz", False),
    "resolved_at": ("timestamp_tz", True),
}
_QUARANTINE_INDEXES = {
    "ix_tenant_integrity_quarantine_table_name": ("table_name",),
    "ix_tenant_integrity_quarantine_reason_code": ("reason_code",),
    "ix_tenant_integrity_quarantine_status": ("status",),
}
_AUDIT_COLUMNS = {
    "id": ("integer", False),
    "status": ("varchar_20", False),
    "unresolved_count": ("integer", False),
    "conflict_count": ("integer", False),
    "details": ("json", False),
    "last_run_at": ("timestamp_tz", True),
    "updated_at": ("timestamp_tz", False),
}


class TenantStagingSchemaContractError(RuntimeError):
    """Existing staging schema is not an exact supported historical shape."""


def _normalized_type(value):
    if isinstance(value, sa.Integer):
        return "integer"
    if isinstance(value, sa.Text):
        return "text"
    if isinstance(value, sa.String):
        if value.length in {20, 80, 255}:
            return f"varchar_{value.length}"
        return "string_other"
    if isinstance(value, sa.JSON):
        return "json"
    if isinstance(value, sa.DateTime):
        return "timestamp_tz" if value.timezone else "timestamp_without_tz"
    return "other"


def _default_kind(value):
    normalized = str(value or "").lower().replace(" ", "")
    if not normalized:
        return "none"
    if "current_timestamp" in normalized or "now()" in normalized:
        return "now"
    if "'open'" in normalized:
        return "open"
    if "'unknown'" in normalized:
        return "unknown"
    if normalized in {"0", "'0'", "0::integer", "'0'::integer"}:
        return "zero"
    return "other"


def _column_contract(inspector, table):
    return {
        item["name"]: (_normalized_type(item["type"]), bool(item["nullable"]))
        for item in inspector.get_columns(table)
    }


def _index_contract(inspector, table):
    return {
        item["name"]: (tuple(item.get("column_names") or ()), bool(item.get("unique")))
        for item in inspector.get_indexes(table)
        if not item.get("duplicates_constraint")
    }


def _reject(reasons):
    logger.critical(
        "TENANT_STAGING_SCHEMA_CONTRACT status=rejected reasons=%s",
        ",".join(sorted(set(reasons))),
    )
    raise TenantStagingSchemaContractError(
        "existing tenant staging schema does not match revision contract"
    )


def _ensure_scoped_columns(bind):
    for table, columns in _COLUMNS.items():
        inspector = sa.inspect(bind)
        if table not in inspector.get_table_names():
            _reject(["SCOPED_TABLE_MISSING"])
        existing_columns = {
            item["name"]: item for item in inspector.get_columns(table)
        }
        existing_indexes = _index_contract(inspector, table)
        for column in columns:
            index_name = f"ix_{table}_{column}"
            existing = existing_columns.get(column)
            index = existing_indexes.get(index_name)
            if existing is None:
                if index is not None:
                    _reject(["ORPHAN_SCOPED_INDEX"])
                op.add_column(table, sa.Column(column, sa.Integer(), nullable=True))
                op.create_index(index_name, table, [column], unique=False)
                continue
            if (
                _normalized_type(existing.get("type")) != "integer"
                or bool(existing.get("nullable")) is not True
                or index != ((column,), False)
            ):
                _reject(["SCOPED_COLUMN_CONTRACT_MISMATCH"])


def _verify_or_complete_quarantine(bind):
    inspector = sa.inspect(bind)
    if QUARANTINE_TABLE not in inspector.get_table_names():
        return False
    reasons = []
    if _column_contract(inspector, QUARANTINE_TABLE) != _QUARANTINE_COLUMNS:
        reasons.append("QUARANTINE_COLUMN_CONTRACT_MISMATCH")
    if tuple(
        inspector.get_pk_constraint(QUARANTINE_TABLE).get("constrained_columns") or ()
    ) != ("id",):
        reasons.append("QUARANTINE_PRIMARY_KEY_MISMATCH")
    indexes = _index_contract(inspector, QUARANTINE_TABLE)
    expected_indexes = {
        name: (columns, False) for name, columns in _QUARANTINE_INDEXES.items()
    }
    if indexes != expected_indexes:
        reasons.append("QUARANTINE_INDEX_CONTRACT_MISMATCH")
    unique_constraints = {
        (
            item.get("name"),
            tuple(item.get("column_names") or ()),
        )
        for item in inspector.get_unique_constraints(QUARANTINE_TABLE)
    }
    if unique_constraints != {
        (
            "uq_tenant_quarantine_row_reason",
            ("table_name", "row_identifier", "reason_code"),
        )
    }:
        reasons.append("QUARANTINE_UNIQUE_CONTRACT_MISMATCH")
    columns = {item["name"]: item for item in inspector.get_columns(QUARANTINE_TABLE)}
    if _default_kind(columns["first_seen_at"].get("default")) != "now":
        reasons.append("QUARANTINE_FIRST_SEEN_DEFAULT_MISMATCH")
    if _default_kind(columns["last_seen_at"].get("default")) != "now":
        reasons.append("QUARANTINE_LAST_SEEN_DEFAULT_MISMATCH")
    status_default = _default_kind(columns["status"].get("default"))
    if status_default not in {"none", "open"}:
        reasons.append("QUARANTINE_STATUS_DEFAULT_MISMATCH")
    if reasons:
        _reject(reasons)
    if status_default == "none":
        op.alter_column(QUARANTINE_TABLE, "status", server_default="open")
    return True


def _verify_or_complete_audit(bind):
    inspector = sa.inspect(bind)
    if AUDIT_TABLE not in inspector.get_table_names():
        return False
    reasons = []
    if _column_contract(inspector, AUDIT_TABLE) != _AUDIT_COLUMNS:
        reasons.append("AUDIT_COLUMN_CONTRACT_MISMATCH")
    if tuple(
        inspector.get_pk_constraint(AUDIT_TABLE).get("constrained_columns") or ()
    ) != ("id",):
        reasons.append("AUDIT_PRIMARY_KEY_MISMATCH")
    if _index_contract(inspector, AUDIT_TABLE):
        reasons.append("AUDIT_UNEXPECTED_INDEX")
    columns = {item["name"]: item for item in inspector.get_columns(AUDIT_TABLE)}
    expected_defaults = {
        "status": "unknown",
        "unresolved_count": "zero",
        "conflict_count": "zero",
        "updated_at": "now",
    }
    missing_defaults = []
    for column, expected in expected_defaults.items():
        actual = _default_kind(columns[column].get("default"))
        if actual == "none" and column != "updated_at":
            missing_defaults.append(column)
        elif actual != expected:
            reasons.append("AUDIT_DEFAULT_CONTRACT_MISMATCH")
    if reasons:
        _reject(reasons)
    for column in missing_defaults:
        default = "unknown" if column == "status" else "0"
        op.alter_column(AUDIT_TABLE, column, server_default=default)
    return True


def _verify_final_contract(bind):
    inspector = sa.inspect(bind)
    quarantine = {item["name"]: item for item in inspector.get_columns(QUARANTINE_TABLE)}
    audit = {item["name"]: item for item in inspector.get_columns(AUDIT_TABLE)}
    if (
        _default_kind(quarantine["status"].get("default")) != "open"
        or _default_kind(audit["status"].get("default")) != "unknown"
        or _default_kind(audit["unresolved_count"].get("default")) != "zero"
        or _default_kind(audit["conflict_count"].get("default")) != "zero"
    ):
        _reject(["FINAL_DEFAULT_VERIFICATION_FAILED"])
    logger.warning(
        "TENANT_STAGING_SCHEMA_CONTRACT status=verified quarantine_present=true "
        "audit_present=true"
    )


def upgrade() -> None:
    bind = op.get_bind()
    _ensure_scoped_columns(bind)

    quarantine_present = _verify_or_complete_quarantine(bind)
    if not quarantine_present:
        op.create_table(
            "tenant_integrity_quarantine",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("table_name", sa.String(length=80), nullable=False),
            sa.Column("row_identifier", sa.String(length=255), nullable=False),
            sa.Column("reason_code", sa.String(length=80), nullable=False),
            sa.Column("evidence", sa.JSON(), nullable=False),
            sa.Column(
                "status", sa.String(length=20), nullable=False, server_default="open"
            ),
            sa.Column(
                "first_seen_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("CURRENT_TIMESTAMP"),
                nullable=False,
            ),
            sa.Column(
                "last_seen_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("CURRENT_TIMESTAMP"),
                nullable=False,
            ),
            sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "table_name",
                "row_identifier",
                "reason_code",
                name="uq_tenant_quarantine_row_reason",
            ),
        )
        op.create_index(
            "ix_tenant_integrity_quarantine_table_name",
            "tenant_integrity_quarantine",
            ["table_name"],
        )
        op.create_index(
            "ix_tenant_integrity_quarantine_reason_code",
            "tenant_integrity_quarantine",
            ["reason_code"],
        )
        op.create_index(
            "ix_tenant_integrity_quarantine_status",
            "tenant_integrity_quarantine",
            ["status"],
        )

    audit_present = _verify_or_complete_audit(bind)
    if not audit_present:
        op.create_table(
            "tenant_integrity_audit_state",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column(
                "status",
                sa.String(length=20),
                nullable=False,
                server_default="unknown",
            ),
            sa.Column(
                "unresolved_count", sa.Integer(), nullable=False, server_default="0"
            ),
            sa.Column(
                "conflict_count", sa.Integer(), nullable=False, server_default="0"
            ),
            sa.Column("details", sa.JSON(), nullable=False),
            sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("CURRENT_TIMESTAMP"),
                nullable=False,
            ),
            sa.PrimaryKeyConstraint("id"),
        )
    _verify_final_contract(bind)


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
