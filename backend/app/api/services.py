from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select, func, and_, or_
from typing import List, Optional
from datetime import datetime, timedelta
from decimal import Decimal

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.service import (
    ServiceCategory, Service, ServiceRequest, ServiceRequestLog, ServiceDeliverable,
    ServiceRequestStatus, ApprovalStatus, Priority
)
from app.schemas.service import (
    ServiceCategoryCreate, ServiceCategoryUpdate, ServiceCategoryResponse,
    ServiceCreate, ServiceUpdate, ServiceResponse,
    ServiceRequestCreate, ServiceRequestUpdate, ServiceRequestResponse,
    ServiceRequestLogCreate, ServiceRequestLogResponse,
    ServiceDeliverableCreate, ServiceDeliverableUpdate, ServiceDeliverableResponse,
    ServiceDashboardSummary,
    ServiceRequestSubmit, ServiceRequestApprove, ServiceRequestReject,
    ServiceRequestComplete, ServiceRequestCancel,
    ServiceRecommendationRequest, ServiceRecommendationResponse
)

router = APIRouter()


# Service Categories
@router.get("/categories", response_model=List[ServiceCategoryResponse])
def list_service_categories(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List service categories"""
    query = select(ServiceCategory)
    
    if is_active is not None:
        query = query.where(ServiceCategory.is_active == is_active)
    
    query = query.offset(skip).limit(limit).order_by(ServiceCategory.name)
    
    result = db.execute(query)
    categories = result.scalars().all()
    
    return categories


@router.post("/categories", response_model=ServiceCategoryResponse, status_code=status.HTTP_201_CREATED)
def create_service_category(
    category_data: ServiceCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new service category"""
    category = ServiceCategory(**category_data.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    
    return ServiceCategoryResponse.model_validate(category)


@router.get("/categories/{category_id}", response_model=ServiceCategoryResponse)
def get_service_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a service category by ID"""
    query = select(ServiceCategory).where(ServiceCategory.id == category_id)
    result = db.execute(query)
    category = result.scalar_one_or_none()
    
    if not category:
        raise HTTPException(status_code=404, detail="Service category not found")
    
    return ServiceCategoryResponse.model_validate(category)


@router.put("/categories/{category_id}", response_model=ServiceCategoryResponse)
def update_service_category(
    category_id: int,
    category_data: ServiceCategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a service category"""
    query = select(ServiceCategory).where(ServiceCategory.id == category_id)
    result = db.execute(query)
    category = result.scalar_one_or_none()
    
    if not category:
        raise HTTPException(status_code=404, detail="Service category not found")
    
    for field, value in category_data.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    
    db.commit()
    db.refresh(category)
    
    return ServiceCategoryResponse.model_validate(category)


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_service_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a service category"""
    query = select(ServiceCategory).where(ServiceCategory.id == category_id)
    result = db.execute(query)
    category = result.scalar_one_or_none()
    
    if not category:
        raise HTTPException(status_code=404, detail="Service category not found")
    
    db.delete(category)
    db.commit()


# â”€â”€ IMPORTANT: all named sub-routes MUST come before /{service_id} â”€â”€

# Services â€” Dashboard Summary (must be before GET "" and GET /{service_id})
@router.get("/dashboard-summary", response_model=ServiceDashboardSummary)
def get_service_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get service dashboard summary"""
    # Total active services
    total_active_services = db.execute(
        select(func.count(Service.id)).where(Service.is_active == True)
    ).scalar()
    
    # Open service requests
    open_service_requests = db.execute(
        select(func.count(ServiceRequest.id)).where(
            ServiceRequest.status.in_([
                ServiceRequestStatus.DRAFT,
                ServiceRequestStatus.SUBMITTED,
                ServiceRequestStatus.APPROVED,
                ServiceRequestStatus.IN_PROGRESS,
                ServiceRequestStatus.WAITING_EXTERNAL_RESPONSE
            ])
        )
    ).scalar()
    
    # Pending approvals
    pending_approvals = db.execute(
        select(func.count(ServiceRequest.id)).where(
            ServiceRequest.approval_status == ApprovalStatus.PENDING
        )
    ).scalar()
    
    # Completed requests
    completed_requests = db.execute(
        select(func.count(ServiceRequest.id)).where(
            ServiceRequest.status == ServiceRequestStatus.COMPLETED
        )
    ).scalar()
    
    # High risk requests
    high_risk_requests = db.execute(
        select(func.count(ServiceRequest.id)).where(
            and_(
                ServiceRequest.priority.in_([Priority.HIGH, Priority.URGENT]),
                ServiceRequest.status != ServiceRequestStatus.COMPLETED
            )
        )
    ).scalar()
    
    # Monthly estimated cost (current month)
    current_month_start = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    monthly_cost_result = db.execute(
        select(func.coalesce(func.sum(ServiceRequest.final_price), 0)).where(
            and_(
                ServiceRequest.created_at >= current_month_start,
                ServiceRequest.status != ServiceRequestStatus.CANCELLED
            )
        )
    ).scalar()
    
    monthly_estimated_cost = Decimal(str(monthly_cost_result or 0))
    
    return ServiceDashboardSummary(
        total_active_services=total_active_services or 0,
        open_service_requests=open_service_requests or 0,
        pending_approvals=pending_approvals or 0,
        completed_requests=completed_requests or 0,
        high_risk_requests=high_risk_requests or 0,
        monthly_estimated_cost=monthly_estimated_cost
    )


@router.get("")
def list_services(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    category_id: Optional[int] = None,
    service_type: Optional[str] = None,
    platform: Optional[str] = None,
    is_active: Optional[bool] = None,
    requires_approval: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List services"""
    query = select(Service).options(selectinload(Service.category))
    
    if category_id is not None:
        query = query.where(Service.category_id == category_id)
    
    if service_type is not None:
        query = query.where(Service.service_type == service_type)
    
    if platform is not None:
        query = query.where(Service.platform == platform)
    
    if is_active is not None:
        query = query.where(Service.is_active == is_active)
    
    if requires_approval is not None:
        query = query.where(Service.requires_approval == requires_approval)
    
    query = query.offset(skip).limit(limit).order_by(Service.name)
    
    result = db.execute(query)
    services = result.scalars().all()
    
    # Manual serialization to avoid enum issues
    return [
        {
            "id": s.id,
            "category_id": s.category_id,
            "code": s.code,
            "name": s.name,
            "description": s.description,
            "service_type": s.service_type.value if hasattr(s.service_type, 'value') else s.service_type,
            "platform": s.platform.value if hasattr(s.platform, 'value') else s.platform,
            "legal_basis": s.legal_basis,
            "workflow_template": s.workflow_template,
            "deliverables": s.deliverables,
            "estimated_duration": s.estimated_duration,
            "sla_hours": s.sla_hours,
            "base_price": float(s.base_price) if s.base_price else None,
            "min_quantity": s.min_quantity,
            "unit": s.unit,
            "risk_level": s.risk_level.value if hasattr(s.risk_level, 'value') else s.risk_level,
            "requires_approval": s.requires_approval,
            "is_active": s.is_active,
            "category": {
                "id": s.category.id,
                "name": s.category.name,
                "description": s.category.description,
                "is_active": s.category.is_active
            },
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None
        }
        for s in services
    ]


@router.post("", response_model=ServiceResponse, status_code=status.HTTP_201_CREATED)
def create_service(
    service_data: ServiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new service"""
    # Verify category exists
    category_query = select(ServiceCategory).where(ServiceCategory.id == service_data.category_id)
    category_result = db.execute(category_query)
    category = category_result.scalar_one_or_none()
    
    if not category:
        raise HTTPException(status_code=404, detail="Service category not found")
    
    service = Service(**service_data.model_dump())
    db.add(service)
    db.commit()
    db.refresh(service)
    
    # Load category relationship
    db.refresh(service, ['category'])
    
    return ServiceResponse.model_validate(service)


@router.get("/{service_id}", response_model=ServiceResponse)
def get_service(
    service_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a service by ID"""
    query = select(Service).options(selectinload(Service.category)).where(Service.id == service_id)
    result = db.execute(query)
    service = result.scalar_one_or_none()
    
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    return ServiceResponse.model_validate(service)


@router.put("/{service_id}", response_model=ServiceResponse)
def update_service(
    service_id: int,
    service_data: ServiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a service"""
    query = select(Service).options(selectinload(Service.category)).where(Service.id == service_id)
    result = db.execute(query)
    service = result.scalar_one_or_none()
    
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Verify category exists if being updated
    if service_data.category_id is not None:
        category_query = select(ServiceCategory).where(ServiceCategory.id == service_data.category_id)
        category_result = db.execute(category_query)
        category = category_result.scalar_one_or_none()
        
        if not category:
            raise HTTPException(status_code=404, detail="Service category not found")
    
    for field, value in service_data.model_dump(exclude_unset=True).items():
        setattr(service, field, value)
    
    db.commit()
    db.refresh(service)
    
    return ServiceResponse.model_validate(service)


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_service(
    service_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a service"""
    query = select(Service).where(Service.id == service_id)
    result = db.execute(query)
    service = result.scalar_one_or_none()
    
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    db.delete(service)
    db.commit()


# Service Requests
@router.get("/requests", response_model=List[ServiceRequestResponse])
def list_service_requests(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[ServiceRequestStatus] = None,
    priority: Optional[Priority] = None,
    approval_status: Optional[ApprovalStatus] = None,
    assigned_to: Optional[int] = None,
    requester_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List service requests"""
    query = select(ServiceRequest).options(selectinload(ServiceRequest.service).selectinload(Service.category))
    
    if status is not None:
        query = query.where(ServiceRequest.status == status)
    
    if priority is not None:
        query = query.where(ServiceRequest.priority == priority)
    
    if approval_status is not None:
        query = query.where(ServiceRequest.approval_status == approval_status)
    
    if assigned_to is not None:
        query = query.where(ServiceRequest.assigned_to == assigned_to)
    
    if requester_id is not None:
        query = query.where(ServiceRequest.requester_id == requester_id)
    
    query = query.offset(skip).limit(limit).order_by(ServiceRequest.created_at.desc())
    
    result = db.execute(query)
    requests = result.scalars().all()
    
    return requests


@router.post("/requests", response_model=ServiceRequestResponse, status_code=status.HTTP_201_CREATED)
def create_service_request(
    request_data: ServiceRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new service request"""
    # Verify service exists
    service_query = select(Service).where(Service.id == request_data.service_id)
    service_result = db.execute(service_query)
    service = service_result.scalar_one_or_none()
    
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Set approval status based on service requirements
    approval_status = ApprovalStatus.PENDING if service.requires_approval else ApprovalStatus.NOT_REQUIRED
    
    service_request = ServiceRequest(
        **request_data.model_dump(),
        requester_id=current_user.id,
        approval_status=approval_status
    )
    db.add(service_request)
    db.commit()
    db.refresh(service_request)
    
    # Load relationships
    db.refresh(service_request, ['service'])
    
    # Create log entry
    log = ServiceRequestLog(
        service_request_id=service_request.id,
        action="created",
        new_status=service_request.status.value,
        note="Service request created",
        created_by=current_user.id
    )
    db.add(log)
    db.commit()
    
    return ServiceRequestResponse.model_validate(service_request)


@router.get("/requests/{request_id}", response_model=ServiceRequestResponse)
def get_service_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a service request by ID"""
    query = select(ServiceRequest).options(
        selectinload(ServiceRequest.service).selectinload(Service.category)
    ).where(ServiceRequest.id == request_id)
    result = db.execute(query)
    service_request = result.scalar_one_or_none()
    
    if not service_request:
        raise HTTPException(status_code=404, detail="Service request not found")
    
    return ServiceRequestResponse.model_validate(service_request)


@router.put("/requests/{request_id}", response_model=ServiceRequestResponse)
def update_service_request(
    request_id: int,
    request_data: ServiceRequestUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a service request"""
    query = select(ServiceRequest).options(
        selectinload(ServiceRequest.service).selectinload(Service.category)
    ).where(ServiceRequest.id == request_id)
    result = db.execute(query)
    service_request = result.scalar_one_or_none()
    
    if not service_request:
        raise HTTPException(status_code=404, detail="Service request not found")
    
    old_status = service_request.status
    
    for field, value in request_data.model_dump(exclude_unset=True).items():
        setattr(service_request, field, value)
    
    db.commit()
    db.refresh(service_request)
    
    # Create log entry if status changed
    if old_status != service_request.status:
        log = ServiceRequestLog(
            service_request_id=service_request.id,
            action="status_changed",
            old_status=old_status.value,
            new_status=service_request.status.value,
            note="Status updated",
            created_by=current_user.id
        )
        db.add(log)
        db.commit()
    
    return ServiceRequestResponse.model_validate(service_request)


# Service Request Actions
@router.post("/requests/{request_id}/submit", response_model=ServiceRequestResponse)
def submit_service_request(
    request_id: int,
    submit_data: ServiceRequestSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Submit a service request"""
    query = select(ServiceRequest).options(
        selectinload(ServiceRequest.service).selectinload(Service.category)
    ).where(ServiceRequest.id == request_id)
    result = db.execute(query)
    service_request = result.scalar_one_or_none()
    
    if not service_request:
        raise HTTPException(status_code=404, detail="Service request not found")
    
    if service_request.status != ServiceRequestStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Only draft requests can be submitted")
    
    old_status = service_request.status
    service_request.status = ServiceRequestStatus.SUBMITTED
    
    db.commit()
    db.refresh(service_request)
    
    # Create log entry
    log = ServiceRequestLog(
        service_request_id=service_request.id,
        action="submitted",
        old_status=old_status.value,
        new_status=service_request.status.value,
        note=submit_data.note or "Request submitted",
        created_by=current_user.id
    )
    db.add(log)
    db.commit()
    
    return ServiceRequestResponse.model_validate(service_request)


@router.post("/requests/{request_id}/approve", response_model=ServiceRequestResponse)
def approve_service_request(
    request_id: int,
    approve_data: ServiceRequestApprove,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Approve a service request"""
    query = select(ServiceRequest).options(
        selectinload(ServiceRequest.service).selectinload(Service.category)
    ).where(ServiceRequest.id == request_id)
    result = db.execute(query)
    service_request = result.scalar_one_or_none()
    
    if not service_request:
        raise HTTPException(status_code=404, detail="Service request not found")
    
    if service_request.approval_status != ApprovalStatus.PENDING:
        raise HTTPException(status_code=400, detail="Only pending requests can be approved")
    
    old_status = service_request.status
    service_request.approval_status = ApprovalStatus.APPROVED
    service_request.status = ServiceRequestStatus.APPROVED
    
    if approve_data.final_price is not None:
        service_request.final_price = approve_data.final_price
    
    db.commit()
    db.refresh(service_request)
    
    # Create log entry
    log = ServiceRequestLog(
        service_request_id=service_request.id,
        action="approved",
        old_status=old_status.value,
        new_status=service_request.status.value,
        note=approve_data.note or "Request approved",
        created_by=current_user.id
    )
    db.add(log)
    db.commit()
    
    return ServiceRequestResponse.model_validate(service_request)


@router.post("/requests/{request_id}/reject", response_model=ServiceRequestResponse)
def reject_service_request(
    request_id: int,
    reject_data: ServiceRequestReject,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Reject a service request"""
    query = select(ServiceRequest).options(
        selectinload(ServiceRequest.service).selectinload(Service.category)
    ).where(ServiceRequest.id == request_id)
    result = db.execute(query)
    service_request = result.scalar_one_or_none()
    
    if not service_request:
        raise HTTPException(status_code=404, detail="Service request not found")
    
    if service_request.approval_status != ApprovalStatus.PENDING:
        raise HTTPException(status_code=400, detail="Only pending requests can be rejected")
    
    old_status = service_request.status
    service_request.approval_status = ApprovalStatus.REJECTED
    service_request.status = ServiceRequestStatus.REJECTED
    
    db.commit()
    db.refresh(service_request)
    
    # Create log entry
    log = ServiceRequestLog(
        service_request_id=service_request.id,
        action="rejected",
        old_status=old_status.value,
        new_status=service_request.status.value,
        note=reject_data.note,
        created_by=current_user.id
    )
    db.add(log)
    db.commit()
    
    return ServiceRequestResponse.model_validate(service_request)


@router.post("/requests/{request_id}/complete", response_model=ServiceRequestResponse)
def complete_service_request(
    request_id: int,
    complete_data: ServiceRequestComplete,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Complete a service request"""
    query = select(ServiceRequest).options(
        selectinload(ServiceRequest.service).selectinload(Service.category)
    ).where(ServiceRequest.id == request_id)
    result = db.execute(query)
    service_request = result.scalar_one_or_none()
    
    if not service_request:
        raise HTTPException(status_code=404, detail="Service request not found")
    
    if service_request.status not in [ServiceRequestStatus.IN_PROGRESS, ServiceRequestStatus.WAITING_EXTERNAL_RESPONSE]:
        raise HTTPException(status_code=400, detail="Only in-progress requests can be completed")
    
    old_status = service_request.status
    service_request.status = ServiceRequestStatus.COMPLETED
    service_request.result_summary = complete_data.result_summary
    
    db.commit()
    db.refresh(service_request)
    
    # Create log entry
    log = ServiceRequestLog(
        service_request_id=service_request.id,
        action="completed",
        old_status=old_status.value,
        new_status=service_request.status.value,
        note=complete_data.note or "Request completed",
        created_by=current_user.id
    )
    db.add(log)
    db.commit()
    
    return ServiceRequestResponse.model_validate(service_request)


@router.post("/requests/{request_id}/cancel", response_model=ServiceRequestResponse)
def cancel_service_request(
    request_id: int,
    cancel_data: ServiceRequestCancel,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Cancel a service request"""
    query = select(ServiceRequest).options(
        selectinload(ServiceRequest.service).selectinload(Service.category)
    ).where(ServiceRequest.id == request_id)
    result = db.execute(query)
    service_request = result.scalar_one_or_none()
    
    if not service_request:
        raise HTTPException(status_code=404, detail="Service request not found")
    
    if service_request.status in [ServiceRequestStatus.COMPLETED, ServiceRequestStatus.CANCELLED]:
        raise HTTPException(status_code=400, detail="Cannot cancel completed or already cancelled requests")
    
    old_status = service_request.status
    service_request.status = ServiceRequestStatus.CANCELLED
    
    db.commit()
    db.refresh(service_request)
    
    # Create log entry
    log = ServiceRequestLog(
        service_request_id=service_request.id,
        action="cancelled",
        old_status=old_status.value,
        new_status=service_request.status.value,
        note=cancel_data.note,
        created_by=current_user.id
    )
    db.add(log)
    db.commit()
    
    return ServiceRequestResponse.model_validate(service_request)


# Service Request Logs
@router.get("/requests/{request_id}/logs", response_model=List[ServiceRequestLogResponse])
def get_service_request_logs(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get logs for a service request"""
    # Verify request exists
    request_query = select(ServiceRequest).where(ServiceRequest.id == request_id)
    request_result = db.execute(request_query)
    service_request = request_result.scalar_one_or_none()
    
    if not service_request:
        raise HTTPException(status_code=404, detail="Service request not found")
    
    query = select(ServiceRequestLog).where(
        ServiceRequestLog.service_request_id == request_id
    ).order_by(ServiceRequestLog.created_at.desc())
    
    result = db.execute(query)
    logs = result.scalars().all()
    
    return logs


@router.post("/requests/{request_id}/logs", response_model=ServiceRequestLogResponse, status_code=status.HTTP_201_CREATED)
def create_service_request_log(
    request_id: int,
    log_data: ServiceRequestLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a log entry for a service request"""
    # Verify request exists
    request_query = select(ServiceRequest).where(ServiceRequest.id == request_id)
    request_result = db.execute(request_query)
    service_request = request_result.scalar_one_or_none()
    
    if not service_request:
        raise HTTPException(status_code=404, detail="Service request not found")
    
    log = ServiceRequestLog(
        service_request_id=request_id,
        created_by=current_user.id,
        **log_data.model_dump()
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    
    return ServiceRequestLogResponse.model_validate(log)


# Service Deliverables
@router.get("/requests/{request_id}/deliverables", response_model=List[ServiceDeliverableResponse])
def get_service_deliverables(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get deliverables for a service request"""
    # Verify request exists
    request_query = select(ServiceRequest).where(ServiceRequest.id == request_id)
    request_result = db.execute(request_query)
    service_request = request_result.scalar_one_or_none()
    
    if not service_request:
        raise HTTPException(status_code=404, detail="Service request not found")
    
    query = select(ServiceDeliverable).where(
        ServiceDeliverable.service_request_id == request_id
    ).order_by(ServiceDeliverable.created_at.desc())
    
    result = db.execute(query)
    deliverables = result.scalars().all()
    
    return deliverables


@router.post("/requests/{request_id}/deliverables", response_model=ServiceDeliverableResponse, status_code=status.HTTP_201_CREATED)
def create_service_deliverable(
    request_id: int,
    deliverable_data: ServiceDeliverableCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a deliverable for a service request"""
    # Verify request exists
    request_query = select(ServiceRequest).where(ServiceRequest.id == request_id)
    request_result = db.execute(request_query)
    service_request = request_result.scalar_one_or_none()
    
    if not service_request:
        raise HTTPException(status_code=404, detail="Service request not found")
    
    deliverable = ServiceDeliverable(
        service_request_id=request_id,
        **deliverable_data.model_dump()
    )
    db.add(deliverable)
    db.commit()
    db.refresh(deliverable)
    
    return ServiceDeliverableResponse.model_validate(deliverable)


@router.put("/deliverables/{deliverable_id}", response_model=ServiceDeliverableResponse)
def update_service_deliverable(
    deliverable_id: int,
    deliverable_data: ServiceDeliverableUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a service deliverable"""
    query = select(ServiceDeliverable).where(ServiceDeliverable.id == deliverable_id)
    result = db.execute(query)
    deliverable = result.scalar_one_or_none()
    
    if not deliverable:
        raise HTTPException(status_code=404, detail="Service deliverable not found")
    
    for field, value in deliverable_data.model_dump(exclude_unset=True).items():
        setattr(deliverable, field, value)
    
    db.commit()
    db.refresh(deliverable)
    
    return ServiceDeliverableResponse.model_validate(deliverable)

