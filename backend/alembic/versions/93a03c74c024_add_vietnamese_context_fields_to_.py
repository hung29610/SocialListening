"""Add Vietnamese Context fields to AIAnalysis

Revision ID: 93a03c74c024
Revises: 022
Create Date: 2026-05-31 16:06:25.117226

Idempotency note
----------------
The six columns added here are ALSO added by revision ``98958b6e0e48``
("add_missing_ai_analysis_columns"), which branches off
``013_add_schedule_arrays`` and is merged back into the mainline at
``9ca8ada20c4d``.  Both revisions sit on the ancestry path of the single head,
so a plain ``alembic upgrade head`` against a *fresh* database executes
``98958b6e0e48`` and then this revision -- which used to raise
``DuplicateColumn: vietnamese_context_label``.

Every operation below is therefore guarded by a live reflection check, so the
revision is a safe no-op when the columns already exist.  This covers the
fresh-database path, the re-run path, and the partially-applied path.

Guards use ``sqlalchemy.inspect`` rather than dialect-specific
``ADD COLUMN IF NOT EXISTS`` so the migration behaves identically on
PostgreSQL (the deployment target) and on SQLite (used by throwaway test
harnesses), and so it does not depend on a minimum PostgreSQL version.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '93a03c74c024'
down_revision = '022'
branch_labels = None
depends_on = None


TABLE_NAME = 'ai_analysis'

# Columns owned by this revision, in creation order.  Each entry is applied
# independently, so a database that already has *some* of them converges
# correctly instead of aborting on the first duplicate.
COLUMNS = (
    ('vietnamese_context_label', sa.String(length=100)),
    ('tone', sa.String(length=50)),
    ('sarcasm_possible', sa.Boolean()),
    ('complaint_type', sa.String(length=100)),
    ('sensitive_signal', sa.Boolean()),
    ('explanation', sa.Text()),
)


def _reflect_columns():
    """Return the set of column names on TABLE_NAME, or None if it is absent.

    A fresh Inspector is built on every call so that DDL already emitted
    inside this transaction (e.g. by the sibling revision 98958b6e0e48) is
    visible.
    """
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if TABLE_NAME not in inspector.get_table_names():
        return None
    return {col['name'] for col in inspector.get_columns(TABLE_NAME)}


def upgrade() -> None:
    existing = _reflect_columns()
    if existing is None:
        # Table not present on this branch/database -- nothing to alter.
        return
    for name, column_type in COLUMNS:
        if name not in existing:
            op.add_column(TABLE_NAME, sa.Column(name, column_type, nullable=True))


def downgrade() -> None:
    existing = _reflect_columns()
    if existing is None:
        return
    for name, _column_type in reversed(COLUMNS):
        if name in existing:
            op.drop_column(TABLE_NAME, name)
