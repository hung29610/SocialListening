"""fix roles table schema

Revision ID: 019
Revises: 018
Create Date: 2026-05-13 20:20:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '019'
down_revision = '018'
branch_labels = None
depends_on = None


def upgrade():
    # Check if roles table exists and has wrong schema
    # Drop and recreate with correct schema
    
    # Drop existing tables if they exist
    op.execute("DROP TABLE IF EXISTS user_roles CASCADE")
    op.execute("DROP TABLE IF EXISTS roles CASCADE")
    
    # Create roles table with correct schema
    op.create_table(
        'roles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(50), nullable=False),
        sa.Column('display_name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('permissions', postgresql.JSON(), nullable=False, server_default='[]'),
        sa.Column('is_system', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    op.create_index('ix_roles_id', 'roles', ['id'])
    op.create_index('ix_roles_name', 'roles', ['name'])
    
    # Insert default system roles
    op.execute("""
        INSERT INTO roles (name, display_name, description, permissions, is_system, is_active)
        VALUES 
        ('super_admin', 'Super Admin', 'Full system access', 
         '["*"]'::json, true, true),
        ('admin', 'Admin', 'Administrative access', 
         '["users.read", "users.write", "settings.read", "settings.write", "reports.read"]'::json, 
         true, true),
        ('manager', 'Manager', 'Team management', 
         '["users.read", "reports.read", "reports.write", "incidents.write"]'::json, 
         true, true),
        ('analyst', 'Analyst', 'Data analysis', 
         '["mentions.read", "reports.read", "keywords.read", "sources.read"]'::json, 
         true, true),
        ('viewer', 'Viewer', 'Read-only access', 
         '["mentions.read", "reports.read"]'::json, 
         true, true)
        ON CONFLICT (name) DO NOTHING;
    """)
    
    # Create user_roles junction table
    op.create_table(
        'user_roles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('role_id', sa.Integer(), nullable=False),
        sa.Column('assigned_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('assigned_by', sa.Integer()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['assigned_by'], ['users.id'], ondelete='SET NULL'),
        sa.UniqueConstraint('user_id', 'role_id', name='uq_user_role')
    )
    op.create_index('ix_user_roles_id', 'user_roles', ['id'])
    op.create_index('ix_user_roles_user_id', 'user_roles', ['user_id'])
    op.create_index('ix_user_roles_role_id', 'user_roles', ['role_id'])
    
    # Migrate existing user roles to new system
    op.execute("""
        INSERT INTO user_roles (user_id, role_id)
        SELECT u.id, r.id
        FROM users u
        CROSS JOIN roles r
        WHERE 
            (u.role = 'super_admin' AND r.name = 'super_admin') OR
            (u.role = 'admin' AND r.name = 'admin') OR
            (u.role = 'manager' AND r.name = 'manager') OR
            (u.role = 'analyst' AND r.name = 'analyst') OR
            (u.role = 'viewer' AND r.name = 'viewer') OR
            (u.role NOT IN ('super_admin', 'admin', 'manager', 'analyst', 'viewer') AND r.name = 'viewer')
        ON CONFLICT (user_id, role_id) DO NOTHING;
    """)


def downgrade():
    op.drop_index('ix_user_roles_role_id', table_name='user_roles')
    op.drop_index('ix_user_roles_user_id', table_name='user_roles')
    op.drop_index('ix_user_roles_id', table_name='user_roles')
    op.drop_table('user_roles')
    
    op.drop_index('ix_roles_name', table_name='roles')
    op.drop_index('ix_roles_id', table_name='roles')
    op.drop_table('roles')
