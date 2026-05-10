"""Add service catalog tables

Revision ID: 003_add_service_catalog
Revises: 002_add_crawl_schedule
Create Date: 2026-05-10 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '003_add_service_catalog'
down_revision = '002_add_crawl_schedule'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enum types
    service_type_enum = postgresql.ENUM(
        'crisis_consulting', 'monitoring', 'legal_takedown', 'press_media',
        'copyright_protection', 'community_response', 'reputation_management',
        'evidence_collection', 'ai_reporting',
        name='servicetype'
    )
    service_type_enum.create(op.get_bind())
    
    platform_enum = postgresql.ENUM(
        'facebook', 'youtube', 'tiktok', 'twitter', 'instagram',
        'website', 'news_media', 'all_platforms',
        name='platform'
    )
    platform_enum.create(op.get_bind())
    
    risk_level_enum = postgresql.ENUM(
        'low', 'medium', 'high', 'critical',
        name='risklevel'
    )
    risk_level_enum.create(op.get_bind())
    
    service_request_status_enum = postgresql.ENUM(
        'draft', 'submitted', 'pending_approval', 'approved', 'in_progress',
        'waiting_external_response', 'completed', 'rejected', 'cancelled',
        name='servicerequeststatus'
    )
    service_request_status_enum.create(op.get_bind())
    
    approval_status_enum = postgresql.ENUM(
        'not_required', 'pending', 'approved', 'rejected', 'revision_required',
        name='approvalstatus'
    )
    approval_status_enum.create(op.get_bind())
    
    priority_enum = postgresql.ENUM(
        'low', 'medium', 'high', 'urgent',
        name='priority'
    )
    priority_enum.create(op.get_bind())
    
    deliverable_type_enum = postgresql.ENUM(
        'report', 'draft_response', 'legal_document', 'evidence_package',
        'strategy_plan', 'briefing', 'monitoring_dashboard',
        name='deliverabletype'
    )
    deliverable_type_enum.create(op.get_bind())
    
    # Create service_categories table
    op.create_table('service_categories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_service_categories_id'), 'service_categories', ['id'], unique=False)
    op.create_index(op.f('ix_service_categories_name'), 'service_categories', ['name'], unique=False)
    op.create_index(op.f('ix_service_categories_is_active'), 'service_categories', ['is_active'], unique=False)
    
    # Create services table
    op.create_table('services',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=500), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('service_type', service_type_enum, nullable=False),
        sa.Column('platform', platform_enum, nullable=False),
        sa.Column('legal_basis', sa.Text(), nullable=True),
        sa.Column('workflow_template', sa.JSON(), nullable=True),
        sa.Column('deliverables', sa.JSON(), nullable=True),
        sa.Column('estimated_duration', sa.String(length=100), nullable=True),
        sa.Column('sla_hours', sa.Integer(), nullable=True),
        sa.Column('base_price', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('min_quantity', sa.Integer(), nullable=True),
        sa.Column('unit', sa.String(length=50), nullable=True),
        sa.Column('risk_level', risk_level_enum, nullable=True),
        sa.Column('requires_approval', sa.Boolean(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['category_id'], ['service_categories.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code')
    )
    op.create_index(op.f('ix_services_id'), 'services', ['id'], unique=False)
    op.create_index(op.f('ix_services_category_id'), 'services', ['category_id'], unique=False)
    op.create_index(op.f('ix_services_code'), 'services', ['code'], unique=False)
    op.create_index(op.f('ix_services_service_type'), 'services', ['service_type'], unique=False)
    op.create_index(op.f('ix_services_platform'), 'services', ['platform'], unique=False)
    op.create_index(op.f('ix_services_risk_level'), 'services', ['risk_level'], unique=False)
    op.create_index(op.f('ix_services_requires_approval'), 'services', ['requires_approval'], unique=False)
    op.create_index(op.f('ix_services_is_active'), 'services', ['is_active'], unique=False)
    
    # Create service_requests table
    op.create_table('service_requests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('service_id', sa.Integer(), nullable=False),
        sa.Column('related_mention_id', sa.Integer(), nullable=True),
        sa.Column('related_alert_id', sa.Integer(), nullable=True),
        sa.Column('related_incident_id', sa.Integer(), nullable=True),
        sa.Column('requester_id', sa.Integer(), nullable=False),
        sa.Column('assigned_to', sa.Integer(), nullable=True),
        sa.Column('status', service_request_status_enum, nullable=True),
        sa.Column('priority', priority_enum, nullable=True),
        sa.Column('request_reason', sa.Text(), nullable=True),
        sa.Column('evidence_summary', sa.Text(), nullable=True),
        sa.Column('desired_outcome', sa.Text(), nullable=True),
        sa.Column('approval_status', approval_status_enum, nullable=True),
        sa.Column('quoted_price', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('final_price', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('deadline', sa.DateTime(timezone=True), nullable=True),
        sa.Column('result_summary', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['service_id'], ['services.id'], ),
        sa.ForeignKeyConstraint(['related_mention_id'], ['mentions.id'], ),
        sa.ForeignKeyConstraint(['related_alert_id'], ['alerts.id'], ),
        sa.ForeignKeyConstraint(['related_incident_id'], ['incidents.id'], ),
        sa.ForeignKeyConstraint(['requester_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['assigned_to'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_service_requests_id'), 'service_requests', ['id'], unique=False)
    op.create_index(op.f('ix_service_requests_service_id'), 'service_requests', ['service_id'], unique=False)
    op.create_index(op.f('ix_service_requests_related_mention_id'), 'service_requests', ['related_mention_id'], unique=False)
    op.create_index(op.f('ix_service_requests_related_alert_id'), 'service_requests', ['related_alert_id'], unique=False)
    op.create_index(op.f('ix_service_requests_related_incident_id'), 'service_requests', ['related_incident_id'], unique=False)
    op.create_index(op.f('ix_service_requests_requester_id'), 'service_requests', ['requester_id'], unique=False)
    op.create_index(op.f('ix_service_requests_assigned_to'), 'service_requests', ['assigned_to'], unique=False)
    op.create_index(op.f('ix_service_requests_status'), 'service_requests', ['status'], unique=False)
    op.create_index(op.f('ix_service_requests_priority'), 'service_requests', ['priority'], unique=False)
    op.create_index(op.f('ix_service_requests_approval_status'), 'service_requests', ['approval_status'], unique=False)
    
    # Create service_request_logs table
    op.create_table('service_request_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('service_request_id', sa.Integer(), nullable=False),
        sa.Column('action', sa.String(length=100), nullable=False),
        sa.Column('old_status', sa.String(length=50), nullable=True),
        sa.Column('new_status', sa.String(length=50), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['service_request_id'], ['service_requests.id'], ),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_service_request_logs_id'), 'service_request_logs', ['id'], unique=False)
    op.create_index(op.f('ix_service_request_logs_service_request_id'), 'service_request_logs', ['service_request_id'], unique=False)
    
    # Create service_deliverables table
    op.create_table('service_deliverables',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('service_request_id', sa.Integer(), nullable=False),
        sa.Column('deliverable_type', deliverable_type_enum, nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('file_url', sa.String(length=1000), nullable=True),
        sa.Column('approval_status', approval_status_enum, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['service_request_id'], ['service_requests.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_service_deliverables_id'), 'service_deliverables', ['id'], unique=False)
    op.create_index(op.f('ix_service_deliverables_service_request_id'), 'service_deliverables', ['service_request_id'], unique=False)
    op.create_index(op.f('ix_service_deliverables_deliverable_type'), 'service_deliverables', ['deliverable_type'], unique=False)
    op.create_index(op.f('ix_service_deliverables_approval_status'), 'service_deliverables', ['approval_status'], unique=False)


def downgrade() -> None:
    # Drop tables
    op.drop_table('service_deliverables')
    op.drop_table('service_request_logs')
    op.drop_table('service_requests')
    op.drop_table('services')
    op.drop_table('service_categories')
    
    # Drop enum types
    deliverable_type_enum = postgresql.ENUM(name='deliverabletype')
    deliverable_type_enum.drop(op.get_bind())
    
    priority_enum = postgresql.ENUM(name='priority')
    priority_enum.drop(op.get_bind())
    
    approval_status_enum = postgresql.ENUM(name='approvalstatus')
    approval_status_enum.drop(op.get_bind())
    
    service_request_status_enum = postgresql.ENUM(name='servicerequeststatus')
    service_request_status_enum.drop(op.get_bind())
    
    risk_level_enum = postgresql.ENUM(name='risklevel')
    risk_level_enum.drop(op.get_bind())
    
    platform_enum = postgresql.ENUM(name='platform')
    platform_enum.drop(op.get_bind())
    
    service_type_enum = postgresql.ENUM(name='servicetype')
    service_type_enum.drop(op.get_bind())