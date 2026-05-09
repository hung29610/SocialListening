from pydantic import BaseModel, Field, HttpUrl
from datetime import datetime
from typing import Optional, List, Dict, Any
from app.models.source import SourceType


# Source Schemas
class SourceBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=500)
    source_type: SourceType
    url: str
    platform_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    is_active: bool = True


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


class SourceResponse(SourceBase):
    id: int
    group_id: Optional[int]
    last_crawled_at: Optional[datetime]
    last_success_at: Optional[datetime]
    last_error: Optional[str]
    crawl_count: int
    error_count: int
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


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
    updated_at: Optional[datetime]
    sources: List[SourceResponse] = []
    
    class Config:
        from_attributes = True


class SourceGroupListResponse(SourceGroupBase):
    id: int
    created_at: datetime
    source_count: int = 0
    
    class Config:
        from_attributes = True
