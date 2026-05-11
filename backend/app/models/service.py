from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Enum as SQLEnum, JSON, ForeignKey, Numeric
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from enum import Enum
from app.core.database import Base


class ServiceType(str, Enum):
    CRISIS_CONSULTING = "crisis_consulting"
    MONITORING = "monitoring"
    LEGAL_TAKEDOWN = "legal_takedown"
    PRESS_MEDIA = "press_media"
    COPYRIGHT_PROTECTION = "copyright_protection"
    COMMUNITY_RESPONSE = "community_response"
    REPUTATION_MANAGEMENT = "reputation_management"
    EVIDENCE_COLLECTION = "evidence_collection"
    AI_REPORTING = "ai_reporting"


class Platform(str, Enum):
    FACEBOOK = "facebook"
    YOUTUBE = "youtube"
    TIKTOK = "tiktok"
    TWITTER = "twitter"
    INSTAGRAM = "instagram"
    WEBSITE = "website"
    NEWS_MEDIA = "news_media"
    ALL_PLATFORMS = "all_platforms"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ServiceRequestStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    IN_PROGRESS = "in_progress"
    WAITING_EXTERNAL_RESPONSE = "waiting_external_response"
    COMPLETED = "completed"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class ApprovalStatus(str, Enum):
    NOT_REQUIRED = "not_required"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    REVISION_REQUIRED = "revision_required"


class Priority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class DeliverableType(str, Enum):
    REPORT = "report"
    DRAFT_RESPONSE = "draft_response"
    LEGAL_DOCUMENT = "legal_document"
    EVIDENCE_PACKAGE = "evidence_package"
    STRATEGY_PLAN = "strategy_plan"
    BRIEFING = "briefing"
    MONITORING_DASHBOARD = "monitoring_dashboard"


class ServiceCategory(Base):
    __tablename__ = "service_categories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    services = relationship("Service", back_populates="category")


class Service(Base):
    __tablename__ = "services"
    
    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("service_categories.id"), nullable=False, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(500), nullable=False)
    description = Column(Text)
    service_type = Column(SQLEnum(ServiceType, values_callable=lambda x: [e.value for e in x]), nullable=False, index=True)
    platform = Column(SQLEnum(Platform, values_callable=lambda x: [e.value for e in x]), nullable=False, index=True)
    legal_basis = Column(Text)  # Legal compliance notes
    workflow_template = Column(JSON)  # Workflow steps
    deliverables = Column(JSON)  # Expected deliverables
    estimated_duration = Column(String(100))  # e.g., "2-5 days"
    sla_hours = Column(Integer)  # SLA in hours
    base_price = Column(Numeric(15, 2))  # Base price in VND
    min_quantity = Column(Integer, default=1)
    unit = Column(String(50))  # e.g., "request", "mention", "month"
    risk_level = Column(SQLEnum(RiskLevel, values_callable=lambda x: [e.value for e in x]), default=RiskLevel.LOW, index=True)
    requires_approval = Column(Boolean, default=True, index=True)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    category = relationship("ServiceCategory", back_populates="services")
    service_requests = relationship("ServiceRequest", back_populates="service")


class ServiceRequest(Base):
    __tablename__ = "service_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False, index=True)
    related_mention_id = Column(Integer, ForeignKey("mentions.id"), nullable=True, index=True)
    related_alert_id = Column(Integer, ForeignKey("alerts.id"), nullable=True, index=True)
    related_incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=True, index=True)
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    
    # Request details
    status = Column(SQLEnum(ServiceRequestStatus, values_callable=lambda x: [e.value for e in x]), default=ServiceRequestStatus.DRAFT, index=True)
    priority = Column(SQLEnum(Priority, values_callable=lambda x: [e.value for e in x]), default=Priority.MEDIUM, index=True)
    request_reason = Column(Text)
    evidence_summary = Column(Text)
    desired_outcome = Column(Text)
    
    # Approval
    approval_status = Column(SQLEnum(ApprovalStatus, values_callable=lambda x: [e.value for e in x]), default=ApprovalStatus.NOT_REQUIRED, index=True)
    
    # Pricing
    quoted_price = Column(Numeric(15, 2))
    final_price = Column(Numeric(15, 2))
    
    # Timeline
    deadline = Column(DateTime(timezone=True))
    
    # Results
    result_summary = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    service = relationship("Service", back_populates="service_requests")
    requester = relationship("User", foreign_keys=[requester_id])
    assignee = relationship("User", foreign_keys=[assigned_to])
    related_mention = relationship("Mention")
    related_alert = relationship("Alert")
    related_incident = relationship("Incident")
    logs = relationship("ServiceRequestLog", back_populates="service_request")
    deliverables = relationship("ServiceDeliverable", back_populates="service_request")


class ServiceRequestLog(Base):
    __tablename__ = "service_request_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    service_request_id = Column(Integer, ForeignKey("service_requests.id"), nullable=False, index=True)
    action = Column(String(100), nullable=False)
    old_status = Column(String(50))
    new_status = Column(String(50))
    note = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    service_request = relationship("ServiceRequest", back_populates="logs")
    creator = relationship("User")


class ServiceDeliverable(Base):
    __tablename__ = "service_deliverables"
    
    id = Column(Integer, primary_key=True, index=True)
    service_request_id = Column(Integer, ForeignKey("service_requests.id"), nullable=False, index=True)
    deliverable_type = Column(SQLEnum(DeliverableType, values_callable=lambda x: [e.value for e in x]), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    content = Column(Text)
    file_url = Column(String(1000))
    approval_status = Column(SQLEnum(ApprovalStatus, values_callable=lambda x: [e.value for e in x]), default=ApprovalStatus.PENDING, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    service_request = relationship("ServiceRequest", back_populates="deliverables")