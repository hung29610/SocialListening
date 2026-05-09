from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Enum as SQLEnum, JSON
from sqlalchemy.sql import func
from enum import Enum
from app.core.database import Base


class SourceType(str, Enum):
    FACEBOOK_PAGE = "facebook_page"
    FACEBOOK_GROUP = "facebook_group"
    FACEBOOK_PROFILE = "facebook_profile"
    YOUTUBE_CHANNEL = "youtube_channel"
    YOUTUBE_VIDEO = "youtube_video"
    WEBSITE = "website"
    NEWS = "news"
    RSS = "rss"
    FORUM = "forum"
    MANUAL_URL = "manual_url"


class SourceGroup(Base):
    __tablename__ = "source_groups"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    


class Source(Base):
    __tablename__ = "sources"
    
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, index=True)
    name = Column(String(500), nullable=False)
    source_type = Column(SQLEnum(SourceType), nullable=False, index=True)
    url = Column(Text, nullable=False)
    
    # Metadata
    platform_id = Column(String(255))  # Facebook ID, YouTube channel ID, etc.
    meta_data = Column(JSON)  # Additional platform-specific data (renamed from metadata)
    
    # Status
    is_active = Column(Boolean, default=True, index=True)
    last_crawled_at = Column(DateTime(timezone=True))
    last_success_at = Column(DateTime(timezone=True))
    last_error = Column(Text)
    crawl_count = Column(Integer, default=0)
    error_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
