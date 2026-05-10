from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any
from decimal import Decimal
from app.models.service import (
    ServiceType, Platform, RiskLevel, ServiceRequestStatus, 
    ApprovalStatus, Priority, DeliverableType
)


# Service Category Schemas
class ServiceCategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    is_active: bool = True


class ServiceCategoryCreate(ServiceCategoryBase):
    pass


class ServiceCategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ServiceCategoryResponse(ServiceCategoryBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


# Service Schemas
class ServiceBase(BaseModel):
    category_id: int
    code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    service_type: ServiceType
    platform: Platform
    legal_basis: Optional[str] = None
    workflow_template: Optional[Dict[str, Any]] = None
    deliverables: Optional[Dict[str, Any]] = None
    estimated_duration: Optional[str] = None
    sla_hours: Optional[int] = None
    base_price: Optional[Decimal] = None
    min_quantity: int = 1
    unit: Optional[str] = None
    risk_level: RiskLevel = RiskLevel.LOW
    requires_approval: bool = True
    is_active: bool = True


class ServiceCreate(ServiceBase):
    pass


class ServiceUpdate(BaseModel):
    category_id: Optional[int] = None
    code: Optional[str] = Field(None, min_length=1, max_length=50)
    name: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = None
    service_type: Optional[ServiceType] = None
    platform: Optional[Platform] = None
    legal_basis: Optional[str] = None
    workflow_template: Optional[Dict[str, Any]] = None
    deliverables: Optional[Dict[str, Any]] = None
    estimated_duration: Optional[str] = None
    sla_hours: Optional[int] = None
    base_price: Optional[Decimal] = None
    min_quantity: Optional[int] = None
    unit: Optional[str] = None
    risk_level: Optional[RiskLevel] = None
    requires_approval: Optional[bool] = None
    is_active: Optional[bool] = None


class ServiceResponse(ServiceBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]
    category: ServiceCategoryResponse
    
    class Config:
        from_attributes = True


# Service Request Schemas
class ServiceRequestBase(BaseModel):
    service_id: int
    related_mention_id: Optional[int] = None
    related_alert_id: Optional[int] = None
    related_incident_id: Optional[int] = None
    assigned_to: Optional[int] = None
    priority: Priority = Priority.MEDIUM
    request_reason: Optional[str] = None
    evidence_summary: Optional[str] = None
    desired_outcome: Optional[str] = None
    quoted_price: Optional[Decimal] = None
    final_price: Optional[Decimal] = None
    deadline: Optional[datetime] = None


class ServiceRequestCreate(ServiceRequestBase):
    pass


class ServiceRequestUpdate(BaseModel):
    service_id: Optional[int] = None
    related_mention_id: Optional[int] = None
    related_alert_id: Optional[int] = None
    related_incident_id: Optional[int] = None
    assigned_to: Optional[int] = None
    status: Optional[ServiceRequestStatus] = None
    priority: Optional[Priority] = None
    request_reason: Optional[str] = None
    evidence_summary: Optional[str] = None
    desired_outcome: Optional[str] = None
    approval_status: Optional[ApprovalStatus] = None
    quoted_price: Optional[Decimal] = None
    final_price: Optional[Decimal] = None
    deadline: Optional[datetime] = None
    result_summary: Optional[str] = None


class ServiceRequestResponse(ServiceRequestBase):
    id: int
    requester_id: int
    status: ServiceRequestStatus
    approval_status: ApprovalStatus
    result_summary: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    service: ServiceResponse
    
    class Config:
        from_attributes = True


# Service Request Log Schemas
class ServiceRequestLogCreate(BaseModel):
    action: str = Field(..., min_length=1, max_length=100)
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    note: Optional[str] = None


class ServiceRequestLogResponse(ServiceRequestLogCreate):
    id: int
    service_request_id: int
    created_by: int
    created_at: datetime
    
    class Config:
        from_attributes = True


# Service Deliverable Schemas
class ServiceDeliverableBase(BaseModel):
    deliverable_type: DeliverableType
    title: str = Field(..., min_length=1, max_length=500)
    content: Optional[str] = None
    file_url: Optional[str] = None


class ServiceDeliverableCreate(ServiceDeliverableBase):
    pass


class ServiceDeliverableUpdate(BaseModel):
    deliverable_type: Optional[DeliverableType] = None
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    content: Optional[str] = None
    file_url: Optional[str] = None
    approval_status: Optional[ApprovalStatus] = None


class ServiceDeliverableResponse(ServiceDeliverableBase):
    id: int
    service_request_id: int
    approval_status: ApprovalStatus
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


# Dashboard Schemas
class ServiceDashboardSummary(BaseModel):
    total_active_services: int
    open_service_requests: int
    pending_approvals: int
    completed_requests: int
    high_risk_requests: int
    monthly_estimated_cost: Decimal
    
    class Config:
        from_attributes = True


# Service Request Actions
class ServiceRequestSubmit(BaseModel):
    note: Optional[str] = None


class ServiceRequestApprove(BaseModel):
    note: Optional[str] = None
    final_price: Optional[Decimal] = None


class ServiceRequestReject(BaseModel):
    note: str = Field(..., min_length=1)
    reason: Optional[str] = None


class ServiceRequestComplete(BaseModel):
    result_summary: str = Field(..., min_length=1)
    note: Optional[str] = None


class ServiceRequestCancel(BaseModel):
    reason: str = Field(..., min_length=1)
    note: Optional[str] = None


# AI Service Recommendation
class ServiceRecommendationRequest(BaseModel):
    mention_id: Optional[int] = None
    alert_id: Optional[int] = None
    incident_id: Optional[int] = None
    content: Optional[str] = None
    risk_score: Optional[int] = None
    crisis_level: Optional[int] = None
    source_type: Optional[str] = None


class ServiceRecommendationResponse(BaseModel):
    recommended_services: List[Dict[str, Any]]
    reasoning: str
    suggested_priority: Priority
    suggested_deadline: Optional[datetime]
    
    class Config:
        from_attributes = True