"""Fix sources schema completely - handle all edge cases

Revision ID: 005_fix_sources_schema_complete
Revises: 004_fix_schema_ensure_columns
Create Date: 2026-05-10 16:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = '005_fix_sources_schema_complete'
down_revision = '004_fix_schema_ensure_columns'
branch_labels = None
depends_on = None


def column_exists(table_name, column_name):
    """Check if a column exists in a table"""
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def get_column_type(table_name, column_name):
    """Get the type of a column"""
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = inspector.get_columns(table_name)
    for col in columns:
        if col['name'] == column_name:
            return str(col['type'])
    return None


def enum_type_exists(enum_name):
    """Check if an enum type exists"""
    bind = op.get_bind()
    result = bind.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = :enum_name)"
    ), {"enum_name": enum_name})
    return result.scalar()


def upgrade() -> None:
    """
    This migration fixes the sources table schema completely.
    It handles multiple edge cases:
    1. crawl_frequency might be INTEGER (from 001) or ENUM (from 002) or missing
    2. Other crawl columns might exist or not
    3. Must be idempotent and safe for production
    """
    
    # Step 1: Fix crawl_frequency column type conflict
    if column_exists('sources', 'crawl_frequency'):
        col_type = get_column_type('sources', 'crawl_frequency')
        print(f"Current crawl_frequency type: {col_type}")
        
        # If it's INTEGER (from migration 001), we need to convert it
        if 'INTEGER' in str(col_type).upper():
            print("Converting crawl_frequency from INTEGER to ENUM...")
            
            # Create enum type if not exists
            if not enum_type_exists('crawlfrequency'):
                crawl_frequency_enum = postgresql.ENUM(
                    'daily', 'weekly', 'monthly', 'yearly', 'manual',
                    name='crawlfrequency'
                )
                crawl_frequency_enum.create(op.get_bind())
            
            # Drop the old INTEGER column
            op.drop_column('sources', 'crawl_frequency')
            
            # Add new ENUM column
            op.add_column('sources', sa.Column(
                'crawl_frequency',
                postgresql.ENUM('daily', 'weekly', 'monthly', 'yearly', 'manual', name='crawlfrequency'),
                server_default='manual',
                nullable=True
            ))
            
            # Create index
            if not op.get_bind().dialect.has_index(op.get_bind(), 'sources', 'ix_sources_crawl_frequency'):
                op.create_index('ix_sources_crawl_frequency', 'sources', ['crawl_frequency'])
    else:
        # crawl_frequency doesn't exist at all, add it
        print("Adding crawl_frequency column...")
        
        # Create enum type if not exists
        if not enum_type_exists('crawlfrequency'):
            crawl_frequency_enum = postgresql.ENUM(
                'daily', 'weekly', 'monthly', 'yearly', 'manual',
                name='crawlfrequency'
            )
            crawl_frequency_enum.create(op.get_bind())
        
        op.add_column('sources', sa.Column(
            'crawl_frequency',
            postgresql.ENUM('daily', 'weekly', 'monthly', 'yearly', 'manual', name='crawlfrequency'),
            server_default='manual',
            nullable=True
        ))
        
        op.create_index('ix_sources_crawl_frequency', 'sources', ['crawl_frequency'])
    
    # Step 2: Add other missing columns from Source model
    
    # Add group_id if missing
    if not column_exists('sources', 'group_id'):
        print("Adding group_id column...")
        op.add_column('sources', sa.Column('group_id', sa.Integer(), nullable=True))
        op.create_index('ix_sources_group_id', 'sources', ['group_id'])
    
    # Add platform_id if missing
    if not column_exists('sources', 'platform_id'):
        print("Adding platform_id column...")
        op.add_column('sources', sa.Column('platform_id', sa.String(255), nullable=True))
    
    # Add meta_data if missing
    if not column_exists('sources', 'meta_data'):
        print("Adding meta_data column...")
        op.add_column('sources', sa.Column('meta_data', postgresql.JSON(), nullable=True))
    
    # Add crawl schedule columns if missing
    if not column_exists('sources', 'crawl_time'):
        print("Adding crawl_time column...")
        op.add_column('sources', sa.Column('crawl_time', sa.Time(), nullable=True))
    
    if not column_exists('sources', 'crawl_day_of_week'):
        print("Adding crawl_day_of_week column...")
        op.add_column('sources', sa.Column('crawl_day_of_week', sa.Integer(), nullable=True))
    
    if not column_exists('sources', 'crawl_day_of_month'):
        print("Adding crawl_day_of_month column...")
        op.add_column('sources', sa.Column('crawl_day_of_month', sa.Integer(), nullable=True))
    
    if not column_exists('sources', 'crawl_month'):
        print("Adding crawl_month column...")
        op.add_column('sources', sa.Column('crawl_month', sa.Integer(), nullable=True))
    
    if not column_exists('sources', 'next_crawl_at'):
        print("Adding next_crawl_at column...")
        op.add_column('sources', sa.Column('next_crawl_at', sa.DateTime(timezone=True), nullable=True))
    
    # Add status tracking columns if missing
    if not column_exists('sources', 'last_crawled_at'):
        print("Adding last_crawled_at column...")
        op.add_column('sources', sa.Column('last_crawled_at', sa.DateTime(timezone=True), nullable=True))
    
    if not column_exists('sources', 'last_success_at'):
        print("Adding last_success_at column...")
        op.add_column('sources', sa.Column('last_success_at', sa.DateTime(timezone=True), nullable=True))
    
    if not column_exists('sources', 'last_error'):
        print("Adding last_error column...")
        op.add_column('sources', sa.Column('last_error', sa.Text(), nullable=True))
    
    if not column_exists('sources', 'crawl_count'):
        print("Adding crawl_count column...")
        op.add_column('sources', sa.Column('crawl_count', sa.Integer(), nullable=False, server_default='0'))
    
    if not column_exists('sources', 'error_count'):
        print("Adding error_count column...")
        op.add_column('sources', sa.Column('error_count', sa.Integer(), nullable=False, server_default='0'))
    
    # Step 3: Fix source_type to use ENUM if it's still String
    if column_exists('sources', 'source_type'):
        col_type = get_column_type('sources', 'source_type')
        if 'VARCHAR' in str(col_type).upper() or 'STRING' in str(col_type).upper():
            print("Converting source_type from String to ENUM...")
            
            # Create enum type if not exists
            if not enum_type_exists('sourcetype'):
                source_type_enum = postgresql.ENUM(
                    'facebook_page', 'facebook_group', 'facebook_profile',
                    'youtube_channel', 'youtube_video', 'website', 'news',
                    'rss', 'forum', 'manual_url',
                    name='sourcetype'
                )
                source_type_enum.create(op.get_bind())
            
            # Alter column type
            op.execute("""
                ALTER TABLE sources 
                ALTER COLUMN source_type TYPE sourcetype 
                USING source_type::sourcetype
            """)
            
            # Create index if not exists
            if not op.get_bind().dialect.has_index(op.get_bind(), 'sources', 'ix_sources_source_type'):
                op.create_index('ix_sources_source_type', 'sources', ['source_type'])
    
    # Step 4: Ensure is_active index exists
    if not op.get_bind().dialect.has_index(op.get_bind(), 'sources', 'ix_sources_is_active'):
        op.create_index('ix_sources_is_active', 'sources', ['is_active'])
    
    print("✅ Sources table schema fix complete!")


def downgrade() -> None:
    """
    Downgrade is intentionally minimal to avoid data loss.
    Only removes indexes and columns added by this migration.
    """
    # Remove indexes
    op.drop_index('ix_sources_is_active', table_name='sources', if_exists=True)
    op.drop_index('ix_sources_source_type', table_name='sources', if_exists=True)
    op.drop_index('ix_sources_group_id', table_name='sources', if_exists=True)
    op.drop_index('ix_sources_crawl_frequency', table_name='sources', if_exists=True)
    
    # Note: We don't drop columns in downgrade to prevent data loss
    # If you need to remove columns, do it manually with careful consideration
    print("⚠️  Downgrade complete. Columns were not removed to prevent data loss.")
