"""Add missing ai_analysis columns.

Revision ID: 98958b6e0e48
Revises: 013_add_schedule_arrays

Idempotency note
----------------
Six of the twelve columns below (``vietnamese_context_label``, ``tone``,
``sarcasm_possible``, ``complaint_type``, ``sensitive_signal``,
``explanation``) are also added by the sibling revision ``93a03c74c024``.
The two revisions live on parallel branches off ``013_add_schedule_arrays``
that are merged back at ``9ca8ada20c4d``, so both run during a single
``alembic upgrade head``.

Alembic's ordering between two sibling branches is an implementation detail
and is NOT contractually stable across Alembic releases.  Today
``98958b6e0e48`` happens to run first and ``93a03c74c024`` fails; a different
topological ordering would make THIS revision the one that fails.  Guarding
only one of the pair is therefore not sufficient -- both are guarded.
"""
from alembic import op
import sqlalchemy as sa

revision = '98958b6e0e48'
down_revision = '013_add_schedule_arrays'
branch_labels = None
depends_on = None


TABLE_NAME = 'ai_analysis'

# (name, type, server_default) in creation order.
COLUMNS = (
    ('urgency', sa.String(length=50), None),
    ('response_type', sa.String(length=100), None),
    ('recommended_owner', sa.String(length=100), None),
    ('deadline_suggestion', sa.String(length=100), None),
    ('escalation_needed', sa.Boolean(), 'false'),
    ('why_it_matters', sa.Text(), None),
    ('vietnamese_context_label', sa.String(length=100), None),
    ('tone', sa.String(length=50), None),
    ('sarcasm_possible', sa.Boolean(), 'false'),
    ('complaint_type', sa.String(length=100), None),
    ('sensitive_signal', sa.Boolean(), 'false'),
    ('explanation', sa.Text(), None),
)


def _reflect_columns():
    """Return the set of column names on TABLE_NAME, or None if it is absent."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if TABLE_NAME not in inspector.get_table_names():
        return None
    return {col['name'] for col in inspector.get_columns(TABLE_NAME)}


def upgrade() -> None:
    existing = _reflect_columns()
    if existing is None:
        return
    for name, column_type, server_default in COLUMNS:
        if name not in existing:
            op.add_column(
                TABLE_NAME,
                sa.Column(name, column_type, server_default=server_default, nullable=True),
            )


def downgrade() -> None:
    existing = _reflect_columns()
    if existing is None:
        return
    for name, _column_type, _server_default in reversed(COLUMNS):
        if name in existing:
            op.drop_column(TABLE_NAME, name)
