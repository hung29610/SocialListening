"""add email and notification settings

Revision ID: 016
Revises: 015
Create Date: 2026-05-12 20:20:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '016'
down_revision = '015'
branch_labels = None
depends_on = None


def upgrade():
    # Create email_settings table (single row table)
    op.create_table(
        'email_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('smtp_host', sa.String(255)),
        sa.Column('smtp_port', sa.Integer(), server_default='587'),
        sa.Column('smtp_username', sa.String(255)),
        sa.Column('smtp_password', sa.Text()),  # Should be encrypted
        sa.Column('from_email', sa.String(255)),
        sa.Column('from_name', sa.String(255)),
        sa.Column('use_tls', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('use_ssl', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('is_configured', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.text('now()')),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Insert default row
    op.execute("""
        INSERT INTO email_settings (id, smtp_port, use_tls, use_ssl, is_configured)
        VALUES (1, 587, true, false, false)
        ON CONFLICT (id) DO NOTHING;
    """)
    
    # Create system_notification_settings table (single row table)
    op.create_table(
        'system_notification_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('webhook_url', sa.Text()),
        sa.Column('telegram_webhook', sa.Text()),
        sa.Column('slack_webhook', sa.Text()),
        sa.Column('discord_webhook', sa.Text()),
        sa.Column('system_alerts_enabled', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('alert_channels', sa.JSON()),  # Array of enabled channels: ['email', 'telegram', 'slack']
        sa.Column('daily_report_enabled', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('daily_report_time', sa.String(10), server_default='09:00'),  # HH:MM format
        sa.Column('weekly_report_enabled', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('weekly_report_day', sa.Integer(), server_default='0'),  # 0=Monday
        sa.Column('weekly_report_time', sa.String(10), server_default='09:00'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.text('now()')),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Insert default row
    op.execute("""
        INSERT INTO system_notification_settings (
            id, system_alerts_enabled, alert_channels, 
            daily_report_enabled, daily_report_time,
            weekly_report_enabled, weekly_report_day, weekly_report_time
        )
        VALUES (
            1, true, '["email"]'::json,
            false, '09:00',
            false, 0, '09:00'
        )
        ON CONFLICT (id) DO NOTHING;
    """)


def downgrade():
    op.drop_table('system_notification_settings')
    op.drop_table('email_settings')
