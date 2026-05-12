"""add api keys, branding, and audit logs

Revision ID: 018
Revises: 017
Create Date: 2026-05-12 20:35:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '018'
down_revision = '017'
branch_labels = None
depends_on = None


def upgrade():
    # Create api_keys table
    op.create_table(
        'api_keys',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('key', sa.String(64), nullable=False, unique=True),  # SHA256 hash
        sa.Column('prefix', sa.String(8), nullable=False),  # First 8 chars for display
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('permissions', postgresql.JSON(), server_default='[]'),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True)),
        sa.Column('last_used_at', sa.DateTime(timezone=True)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE')
    )
    op.create_index('ix_api_keys_key', 'api_keys', ['key'])
    op.create_index('ix_api_keys_user_id', 'api_keys', ['user_id'])
    
    # Create branding_settings table (single row)
    op.create_table(
        'branding_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('primary_color', sa.String(7), server_default='#3B82F6'),  # Tailwind blue-500
        sa.Column('secondary_color', sa.String(7), server_default='#10B981'),  # Tailwind green-500
        sa.Column('logo_light_url', sa.Text()),
        sa.Column('logo_dark_url', sa.Text()),
        sa.Column('favicon_url', sa.Text()),
        sa.Column('login_background_url', sa.Text()),
        sa.Column('custom_css', sa.Text()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.text('now()')),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Insert default branding
    op.execute("""
        INSERT INTO branding_settings (id, primary_color, secondary_color)
        VALUES (1, '#3B82F6', '#10B981')
        ON CONFLICT (id) DO NOTHING;
    """)
    
    # Create audit_logs table
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer()),
        sa.Column('action', sa.String(100), nullable=False),  # e.g., 'user.create', 'settings.update'
        sa.Column('resource_type', sa.String(50)),  # e.g., 'user', 'source', 'keyword'
        sa.Column('resource_id', sa.Integer()),
        sa.Column('details', postgresql.JSON()),  # Additional context
        sa.Column('ip_address', sa.String(45)),
        sa.Column('user_agent', sa.Text()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False, index=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL')
    )
    op.create_index('ix_audit_logs_user_id', 'audit_logs', ['user_id'])
    op.create_index('ix_audit_logs_action', 'audit_logs', ['action'])
    op.create_index('ix_audit_logs_resource', 'audit_logs', ['resource_type', 'resource_id'])


def downgrade():
    op.drop_index('ix_audit_logs_resource', table_name='audit_logs')
    op.drop_index('ix_audit_logs_action', table_name='audit_logs')
    op.drop_index('ix_audit_logs_user_id', table_name='audit_logs')
    op.drop_table('audit_logs')
    
    op.drop_table('branding_settings')
    
    op.drop_index('ix_api_keys_user_id', table_name='api_keys')
    op.drop_index('ix_api_keys_key', table_name='api_keys')
    op.drop_table('api_keys')
