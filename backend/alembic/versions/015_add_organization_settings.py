"""add organization settings

Revision ID: 015
Revises: 014
Create Date: 2026-05-12 20:15:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '015'
down_revision = '014'
branch_labels = None
depends_on = None


def upgrade():
    # Create organization_settings table (single row table)
    op.create_table(
        'organization_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('organization_name', sa.String(255), nullable=False, server_default='My Organization'),
        sa.Column('logo_url', sa.Text()),
        sa.Column('address', sa.Text()),
        sa.Column('contact_email', sa.String(255)),
        sa.Column('hotline', sa.String(50)),
        sa.Column('website', sa.String(255)),
        sa.Column('timezone', sa.String(50), server_default='Asia/Ho_Chi_Minh'),
        sa.Column('language', sa.String(10), server_default='vi'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.text('now()')),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Insert default row
    op.execute("""
        INSERT INTO organization_settings (id, organization_name, timezone, language)
        VALUES (1, 'Social Listening Platform', 'Asia/Ho_Chi_Minh', 'vi')
        ON CONFLICT (id) DO NOTHING;
    """)


def downgrade():
    op.drop_table('organization_settings')
