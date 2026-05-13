"""add display_name to roles

Revision ID: 020
Revises: 019
Create Date: 2026-05-13 22:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '020'
down_revision = '019'
branch_labels = None
depends_on = None


def upgrade():
    # Check if display_name column exists
    conn = op.get_bind()
    result = conn.execute(sa.text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'roles' AND column_name = 'display_name'
    """))
    
    if result.fetchone() is None:
        # Add display_name column if it doesn't exist
        op.add_column('roles', sa.Column('display_name', sa.String(100), nullable=True))
        
        # Update existing roles with display names
        op.execute("""
            UPDATE roles 
            SET display_name = CASE 
                WHEN name = 'super_admin' THEN 'Super Admin'
                WHEN name = 'admin' THEN 'Admin'
                WHEN name = 'manager' THEN 'Manager'
                WHEN name = 'analyst' THEN 'Analyst'
                WHEN name = 'viewer' THEN 'Viewer'
                ELSE INITCAP(REPLACE(name, '_', ' '))
            END
            WHERE display_name IS NULL
        """)
        
        # Make display_name NOT NULL after populating
        op.alter_column('roles', 'display_name', nullable=False)


def downgrade():
    op.drop_column('roles', 'display_name')
