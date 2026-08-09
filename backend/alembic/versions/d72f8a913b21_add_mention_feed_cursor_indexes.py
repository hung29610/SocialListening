"""add mention feed cursor indexes

Revision ID: d72f8a913b21
Revises: c1a2b3d4e5f6
Create Date: 2026-07-28

HIGH RISK: human diff review is required before deployment.
"""
from alembic import op
import sqlalchemy as sa
import logging


revision = "d72f8a913b21"
down_revision = "c1a2b3d4e5f6"
branch_labels = None
depends_on = None

logger = logging.getLogger("alembic.runtime.migration")
EXPECTED_INDEXES = {
    "idx_mentions_org_collected_id": (
        "organization_id",
        "collected_at",
        "id",
    ),
    "idx_mentions_project_collected_id": (
        "project_id",
        "collected_at",
        "id",
    ),
    "idx_mentions_keyword_collected_id": (
        "keyword_id",
        "collected_at",
        "id",
    ),
}


class MentionIndexContractError(RuntimeError):
    """Existing cursor index does not match the revision contract."""


def _ensure_index(name: str, columns: tuple[str, ...]) -> None:
    connection = op.get_bind()
    is_valid = connection.execute(
        sa.text(
            "SELECT i.indisvalid "
            "FROM pg_index i "
            "JOIN pg_class c ON c.oid = i.indexrelid "
            "JOIN pg_namespace n ON n.oid = c.relnamespace "
            "WHERE c.relname = :name AND n.nspname = current_schema()"
        ),
        {"name": name},
    ).scalar_one_or_none()
    reflected = {
        item["name"]: (tuple(item.get("column_names") or ()), bool(item.get("unique")))
        for item in sa.inspect(connection).get_indexes("mentions")
    }
    existing = reflected.get(name)
    if is_valid is True and existing != (columns, False):
        logger.critical(
            "MENTION_CURSOR_INDEX_CONTRACT status=rejected reason=INDEX_CONTRACT_MISMATCH "
            "index=%s",
            name,
        )
        raise MentionIndexContractError("existing mention cursor index is unexpected")
    if is_valid is False:
        op.execute(f'DROP INDEX IF EXISTS "{name}"')
    if is_valid is not True:
        column_sql = ", ".join(f'"{column}"' for column in columns)
        op.execute(f'CREATE INDEX "{name}" ON mentions ({column_sql})')

    final_indexes = {
        item["name"]: (tuple(item.get("column_names") or ()), bool(item.get("unique")))
        for item in sa.inspect(connection).get_indexes("mentions")
    }
    if final_indexes.get(name) != (columns, False):
        raise MentionIndexContractError("mention cursor index verification failed")


def upgrade() -> None:
    # Startup has not bound the web port yet, while the prior Render generation
    # may keep old read snapshots alive. CREATE INDEX CONCURRENTLY can wait for
    # those snapshots indefinitely and deadlock deployment. A bounded regular
    # index build is transactional, permits ordinary reads, and is fast for the
    # measured production table size.
    op.execute("SET LOCAL lock_timeout = '15s'")
    op.execute("SET LOCAL statement_timeout = '60s'")
    for name, columns in EXPECTED_INDEXES.items():
        _ensure_index(name, columns)
    logger.warning(
        "MENTION_CURSOR_INDEX_CONTRACT status=verified index_count=%d",
        len(EXPECTED_INDEXES),
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_mentions_keyword_collected_id")
    op.execute("DROP INDEX IF EXISTS idx_mentions_project_collected_id")
    op.execute("DROP INDEX IF EXISTS idx_mentions_org_collected_id")
