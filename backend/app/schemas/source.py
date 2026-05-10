from pydantic import BaseModel, Field, HttpUrl
from datetime import datetime, time
from typing import Optional, List, Dict, Any
from app.models.source import SourceType, CrawlFrequency


# Source Schemas
class SourceBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=500)
    source_type: SourceType
    url: str
    platform_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    is_active: bool = True
    crawl_frequency: CrawlFrequency = CrawlFrequency.MANUAL
    crawl_time: Optional[time] = None  # For daily
    crawl_day_of_week: Optional[int] = Field(None, ge=0, le=6)  # For weekly: 0=Monday, 6=Sunday
    crawl_day_of_month: Optional[int] = Field(None, ge=1, le=31)  # For monthly
    crawl_month: Optional[int] = Field(None, ge=1, le=12)  # For yearly


class SourceCreate(SourceBase):
    group_id: Optional[int] = None


class SourceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=500)
    source_type: Optional[SourceType] = None
    url: Optional[str] = None
    group_id: Optional[int] = None
    platform_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None
    crawl_frequency: Optional[CrawlFrequency] = None
    crawl_time: Optional[time] = None
    crawl_day_of_week: Optional[int] = Field(None, ge=0, le=6)
    crawl_day_of_month: Optional[int] = Field(None, ge=1, le=31)
    crawl_month: Optional[int] = Field(None, ge=1, le=12)


class SourceResponse(SourceBase):
    id: int
    group_id: Optional[int]
    next_crawl_at: Optional[datetime] = None
    last_crawled_at: Optional[datetime] = None
    last_success_at: Optional[datetime] = None
    last_error: Optional[str] = None
    crawl_count: int
    error_count: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    model_config = {'from_attributes': True}


# Source Group Schemas
class SourceGroupBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    is_active: bool = True


class SourceGroupCreate(SourceGroupBase):
    pass


class SourceGroupUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class SourceGroupResponse(SourceGroupBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    sources: List[SourceResponse] = []
    
    model_config = {'from_attributes': True}


class SourceGroupListResponse(SourceGroupBase):
    id: int
    created_at: datetime
    source_count: int = 0
    
    model_config = {'from_attributes': True}

