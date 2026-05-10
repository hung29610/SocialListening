from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from app.models.incident import IncidentStatus


# Incident Schemas
class IncidentBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    deadline: Optional[datetime] = None


class IncidentCreate(IncidentBase):
    mention_id: int
    owner_id: int


class IncidentUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = None
    status: Optional[IncidentStatus] = None
    owner_id: Optional[int] = None
    deadline: Optional[datetime] = None
    outcome: Optional[str] = None
    resolution_notes: Optional[str] = None


class IncidentResponse(IncidentBase):
    id: int
    mention_id: int
    owner_id: int
    status: IncidentStatus
    is_overdue: bool
    outcome: Optional[str]
    resolution_notes: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    resolved_at: Optional[datetime]
    closed_at: Optional[datetime]
    
    model_config = {'from_attributes': True}


# Incident Log Schemas
class IncidentLogCreate(BaseModel):
    action: str = Field(..., min_length=1, max_length=100)
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    notes: Optional[str] = None


class IncidentLogResponse(BaseModel):
    id: int
    incident_id: int
    user_id: Optional[int]
    action: str
    old_status: Optional[str]
    new_status: Optional[str]
    notes: Optional[str]
    created_at: datetime
    
    model_config = {'from_attributes': True}


# Evidence File Schemas
class EvidenceFileCreate(BaseModel):
    file_name: str
    file_path: str
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    capture_method: Optional[str] = None
    original_url: Optional[str] = None
    metadata: Optional[str] = None


class EvidenceFileResponse(EvidenceFileCreate):
    id: int
    incident_id: int
    captured_by: Optional[int]
    captured_at: datetime
    
    model_config = {'from_attributes': True}


# Takedown Request Schemas
class TakedownRequestBase(BaseModel):
    platform: str = Field(..., min_length=1, max_length=100)
    request_type: Optional[str] = None
    title: str = Field(..., min_length=1, max_length=500)
    content: str


class TakedownRequestCreate(TakedownRequestBase):
    incident_id: int


class TakedownRequestUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    content: Optional[str] = None
    status: Optional[str] = None
    platform_reference: Optional[str] = None
    platform_response: Optional[str] = None


class TakedownRequestResponse(TakedownRequestBase):
    id: int
    incident_id: int
    status: str
    submitted_by: Optional[int]
    approved_by: Optional[int]
    approved_at: Optional[datetime]
    submitted_at: Optional[datetime]
    platform_reference: Optional[str]
    platform_response: Optional[str]
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]
    
    model_config = {'from_attributes': True}


# Response Template Schemas
class ResponseTemplateBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    template_type: str = Field(..., min_length=1, max_length=100)
    language: str = Field("vi", min_length=2, max_length=10)
    subject: Optional[str] = None
    body: str
    variables: Optional[str] = None
    is_active: bool = True


class ResponseTemplateCreate(ResponseTemplateBase):
    pass


class ResponseTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    subject: Optional[str] = None
    body: Optional[str] = None
    variables: Optional[str] = None
    is_active: Optional[bool] = None


class ResponseTemplateResponse(ResponseTemplateBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]
    
    model_config = {'from_attributes': True}


# Filters
class IncidentFilter(BaseModel):
    status: Optional[IncidentStatus] = None
    owner_id: Optional[int] = None
    is_overdue: Optional[bool] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class IncidentListResponse(BaseModel):
    items: List[IncidentResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

