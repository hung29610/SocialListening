"""
Service Requests router â€” mounted at /api/service-requests
to avoid FastAPI path conflict with /api/services/{service_id}
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select, func
from typing import List, Optional
from decimal import Decimal

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.service import (
    Service, ServiceRequest, ServiceRequestLog, ServiceDeliverable,
    ServiceRequestStatus, ApprovalStatus, Priority
)
from app.schemas.service import (
    ServiceRequestCreate, ServiceRequestUpdate, ServiceRequestResponse,
    ServiceRequestLogCreate, ServiceRequestLogResponse,
    ServiceDeliverableCreate, ServiceDeliverableUpdate, ServiceDeliverableResponse,
    ServiceRequestSubmit, ServiceRequestApprove, ServiceRequestReject,
    ServiceRequestComplete, ServiceRequestCancel,
)

router = APIRouter()


def _serialize_request(sr: ServiceRequest) -> dict:
    """Manually serialize to avoid enum issues with Pydantic v1."""
    svc = sr.service
    cat = svc.category if svc else None
    return {
        "id": sr.id,
        "service_id": sr.service_id,
        "related_mention_id": sr.related_mention_id,
        "related_alert_id": sr.related_alert_id,
        "related_incident_id": sr.related_incident_id,
        "requester_id": sr.requester_id,
        "assigned_to": sr.assigned_to,
        "status": sr.status.value if hasattr(sr.status, 'value') else sr.status,
        "approval_status": sr.approval_status.value if hasattr(sr.approval_status, 'value') else sr.approval_status,
        "priority": sr.priority.value if hasattr(sr.priority, 'value') else sr.priority,
        "request_reason": sr.request_reason,
        "evidence_summary": sr.evidence_summary,
        "desired_outcome": sr.desired_outcome,
        "quoted_price": float(sr.quoted_price) if sr.quoted_price else None,
        "final_price": float(sr.final_price) if sr.final_price else None,
        "deadline": sr.deadline.isoformat() if sr.deadline else None,
        "result_summary": sr.result_summary,
        "created_at": sr.created_at.isoformat() if sr.created_at else None,
        "updated_at": sr.updated_at.isoformat() if sr.updated_at else None,
        "service": {
            "id": svc.id,
            "code": svc.code,
            "name": svc.name,
            "service_type": svc.service_type.value if hasattr(svc.service_type, 'value') else svc.service_type,
            "platform": svc.platform.value if hasattr(svc.platform, 'value') else svc.platform,
            "category": {
                "id": cat.id,
                "name": cat.name,
            } if cat else None,
        } if svc else None,
    }


@router.get("", response_model=List[dict])
def list_service_requests(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = None,
    priority: Optional[str] = None,
    approval_status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List service requests"""
    query = select(ServiceRequest).options(
        selectinload(ServiceRequest.service).selectinload(Service.category)
    )

    if status:
        query = query.where(ServiceRequest.status == status)
    if priority:
        query = query.where(ServiceRequest.priority == priority)
    if approval_status:
        query = query.where(ServiceRequest.approval_status == approval_status)

    query = query.offset(skip).limit(limit).order_by(ServiceRequest.created_at.desc())
    requests = db.execute(query).scalars().all()

    return [_serialize_request(r) for r in requests]


@router.post("", status_code=201)
def create_service_request(
    request_data: ServiceRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new service request"""
    service = db.execute(
        select(Service).where(Service.id == request_data.service_id)
    ).scalar_one_or_none()

    if not service:
        raise HTTPException(status_code=404, detail="Dá»‹ch vá»¥ khÃ´ng tá»“n táº¡i")

    approval_status = ApprovalStatus.PENDING if service.requires_approval else ApprovalStatus.NOT_REQUIRED

    sr = ServiceRequest(
        **request_data.model_dump(),
        requester_id=current_user.id,
        approval_status=approval_status
    )
    db.add(sr)
    db.commit()
    db.refresh(sr)

    # Reload with relationships
    sr = db.execute(
        select(ServiceRequest)
        .options(selectinload(ServiceRequest.service).selectinload(Service.category))
        .where(ServiceRequest.id == sr.id)
    ).scalar_one()

    log = ServiceRequestLog(
        service_request_id=sr.id,
        action="created",
        new_status=sr.status.value,
        note="YÃªu cáº§u dá»‹ch vá»¥ Ä‘Æ°á»£c táº¡o",
        created_by=current_user.id
    )
    db.add(log)
    db.commit()

    return _serialize_request(sr)


@router.get("/{request_id}")
def get_service_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a service request by ID"""
    sr = db.execute(
        select(ServiceRequest)
        .options(selectinload(ServiceRequest.service).selectinload(Service.category))
        .where(ServiceRequest.id == request_id)
    ).scalar_one_or_none()

    if not sr:
        raise HTTPException(status_code=404, detail="YÃªu cáº§u dá»‹ch vá»¥ khÃ´ng tá»“n táº¡i")

    return _serialize_request(sr)


@router.put("/{request_id}")
def update_service_request(
    request_id: int,
    request_data: ServiceRequestUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a service request"""
    sr = db.execute(
        select(ServiceRequest)
        .options(selectinload(ServiceRequest.service).selectinload(Service.category))
        .where(ServiceRequest.id == request_id)
    ).scalar_one_or_none()

    if not sr:
        raise HTTPException(status_code=404, detail="YÃªu cáº§u dá»‹ch vá»¥ khÃ´ng tá»“n táº¡i")

    old_status = sr.status
    for field, value in request_data.model_dump(exclude_unset=True).items():
        setattr(sr, field, value)

    db.commit()
    db.refresh(sr)

    if old_status != sr.status:
        log = ServiceRequestLog(
            service_request_id=sr.id,
            action="status_changed",
            old_status=old_status.value,
            new_status=sr.status.value,
            note="Tráº¡ng thÃ¡i Ä‘Æ°á»£c cáº­p nháº­t",
            created_by=current_user.id
        )
        db.add(log)
        db.commit()

    sr = db.execute(
        select(ServiceRequest)
        .options(selectinload(ServiceRequest.service).selectinload(Service.category))
        .where(ServiceRequest.id == request_id)
    ).scalar_one()

    return _serialize_request(sr)


@router.post("/{request_id}/submit")
def submit_service_request(
    request_id: int,
    submit_data: ServiceRequestSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    sr = db.execute(
        select(ServiceRequest)
        .options(selectinload(ServiceRequest.service).selectinload(Service.category))
        .where(ServiceRequest.id == request_id)
    ).scalar_one_or_none()

    if not sr:
        raise HTTPException(status_code=404, detail="YÃªu cáº§u dá»‹ch vá»¥ khÃ´ng tá»“n táº¡i")

    if sr.status != ServiceRequestStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Chá»‰ cÃ³ thá»ƒ gá»­i yÃªu cáº§u á»Ÿ tráº¡ng thÃ¡i NhÃ¡p")

    old_status = sr.status
    sr.status = ServiceRequestStatus.SUBMITTED
    db.commit()
    db.refresh(sr)

    log = ServiceRequestLog(
        service_request_id=sr.id,
        action="submitted",
        old_status=old_status.value,
        new_status=sr.status.value,
        note=submit_data.note or "YÃªu cáº§u Ä‘Æ°á»£c gá»­i",
        created_by=current_user.id
    )
    db.add(log)
    db.commit()

    sr = db.execute(
        select(ServiceRequest)
        .options(selectinload(ServiceRequest.service).selectinload(Service.category))
        .where(ServiceRequest.id == request_id)
    ).scalar_one()
    return _serialize_request(sr)


@router.post("/{request_id}/approve")
def approve_service_request(
    request_id: int,
    approve_data: ServiceRequestApprove,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    sr = db.execute(
        select(ServiceRequest)
        .options(selectinload(ServiceRequest.service).selectinload(Service.category))
        .where(ServiceRequest.id == request_id)
    ).scalar_one_or_none()

    if not sr:
        raise HTTPException(status_code=404, detail="YÃªu cáº§u dá»‹ch vá»¥ khÃ´ng tá»“n táº¡i")

    if sr.approval_status != ApprovalStatus.PENDING:
        raise HTTPException(status_code=400, detail="Chá»‰ cÃ³ thá»ƒ phÃª duyá»‡t yÃªu cáº§u Ä‘ang chá»")

    old_status = sr.status
    sr.approval_status = ApprovalStatus.APPROVED
    sr.status = ServiceRequestStatus.APPROVED

    if approve_data.final_price is not None:
        sr.final_price = approve_data.final_price

    db.commit()
    db.refresh(sr)

    log = ServiceRequestLog(
        service_request_id=sr.id,
        action="approved",
        old_status=old_status.value,
        new_status=sr.status.value,
        note=approve_data.note or "YÃªu cáº§u Ä‘Æ°á»£c phÃª duyá»‡t",
        created_by=current_user.id
    )
    db.add(log)
    db.commit()

    sr = db.execute(
        select(ServiceRequest)
        .options(selectinload(ServiceRequest.service).selectinload(Service.category))
        .where(ServiceRequest.id == request_id)
    ).scalar_one()
    return _serialize_request(sr)


@router.post("/{request_id}/reject")
def reject_service_request(
    request_id: int,
    reject_data: ServiceRequestReject,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    sr = db.execute(
        select(ServiceRequest)
        .options(selectinload(ServiceRequest.service).selectinload(Service.category))
        .where(ServiceRequest.id == request_id)
    ).scalar_one_or_none()

    if not sr:
        raise HTTPException(status_code=404, detail="YÃªu cáº§u dá»‹ch vá»¥ khÃ´ng tá»“n táº¡i")

    if sr.approval_status != ApprovalStatus.PENDING:
        raise HTTPException(status_code=400, detail="Chá»‰ cÃ³ thá»ƒ tá»« chá»‘i yÃªu cáº§u Ä‘ang chá»")

    old_status = sr.status
    sr.approval_status = ApprovalStatus.REJECTED
    sr.status = ServiceRequestStatus.REJECTED
    db.commit()
    db.refresh(sr)

    log = ServiceRequestLog(
        service_request_id=sr.id,
        action="rejected",
        old_status=old_status.value,
        new_status=sr.status.value,
        note=reject_data.note,
        created_by=current_user.id
    )
    db.add(log)
    db.commit()

    sr = db.execute(
        select(ServiceRequest)
        .options(selectinload(ServiceRequest.service).selectinload(Service.category))
        .where(ServiceRequest.id == request_id)
    ).scalar_one()
    return _serialize_request(sr)


@router.post("/{request_id}/complete")
def complete_service_request(
    request_id: int,
    complete_data: ServiceRequestComplete,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    sr = db.execute(
        select(ServiceRequest)
        .options(selectinload(ServiceRequest.service).selectinload(Service.category))
        .where(ServiceRequest.id == request_id)
    ).scalar_one_or_none()

    if not sr:
        raise HTTPException(status_code=404, detail="YÃªu cáº§u dá»‹ch vá»¥ khÃ´ng tá»“n táº¡i")

    if sr.status not in [ServiceRequestStatus.IN_PROGRESS, ServiceRequestStatus.WAITING_EXTERNAL_RESPONSE, ServiceRequestStatus.APPROVED]:
        raise HTTPException(status_code=400, detail="KhÃ´ng thá»ƒ hoÃ n thÃ nh yÃªu cáº§u á»Ÿ tráº¡ng thÃ¡i hiá»‡n táº¡i")

    old_status = sr.status
    sr.status = ServiceRequestStatus.COMPLETED
    sr.result_summary = complete_data.result_summary
    db.commit()
    db.refresh(sr)

    log = ServiceRequestLog(
        service_request_id=sr.id,
        action="completed",
        old_status=old_status.value,
        new_status=sr.status.value,
        note=complete_data.note or "YÃªu cáº§u hoÃ n thÃ nh",
        created_by=current_user.id
    )
    db.add(log)
    db.commit()

    sr = db.execute(
        select(ServiceRequest)
        .options(selectinload(ServiceRequest.service).selectinload(Service.category))
        .where(ServiceRequest.id == request_id)
    ).scalar_one()
    return _serialize_request(sr)


@router.post("/{request_id}/cancel")
def cancel_service_request(
    request_id: int,
    cancel_data: ServiceRequestCancel,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    sr = db.execute(
        select(ServiceRequest)
        .options(selectinload(ServiceRequest.service).selectinload(Service.category))
        .where(ServiceRequest.id == request_id)
    ).scalar_one_or_none()

    if not sr:
        raise HTTPException(status_code=404, detail="YÃªu cáº§u dá»‹ch vá»¥ khÃ´ng tá»“n táº¡i")

    if sr.status in [ServiceRequestStatus.COMPLETED, ServiceRequestStatus.CANCELLED]:
        raise HTTPException(status_code=400, detail="KhÃ´ng thá»ƒ há»§y yÃªu cáº§u Ä‘Ã£ hoÃ n thÃ nh hoáº·c Ä‘Ã£ há»§y")

    old_status = sr.status
    sr.status = ServiceRequestStatus.CANCELLED
    db.commit()

    log = ServiceRequestLog(
        service_request_id=sr.id,
        action="cancelled",
        old_status=old_status.value,
        new_status=sr.status.value,
        note=cancel_data.note,
        created_by=current_user.id
    )
    db.add(log)
    db.commit()

    sr = db.execute(
        select(ServiceRequest)
        .options(selectinload(ServiceRequest.service).selectinload(Service.category))
        .where(ServiceRequest.id == request_id)
    ).scalar_one()
    return _serialize_request(sr)


@router.get("/{request_id}/logs")
def get_service_request_logs(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    sr = db.execute(
        select(ServiceRequest).where(ServiceRequest.id == request_id)
    ).scalar_one_or_none()

    if not sr:
        raise HTTPException(status_code=404, detail="YÃªu cáº§u dá»‹ch vá»¥ khÃ´ng tá»“n táº¡i")

    logs = db.execute(
        select(ServiceRequestLog)
        .where(ServiceRequestLog.service_request_id == request_id)
        .order_by(ServiceRequestLog.created_at.desc())
    ).scalars().all()

    return [
        {
            "id": log.id,
            "service_request_id": log.service_request_id,
            "action": log.action,
            "old_status": log.old_status,
            "new_status": log.new_status,
            "note": log.note,
            "created_by": log.created_by,
            "created_at": log.created_at.isoformat() if log.created_at else None
        }
        for log in logs
    ]


@router.post("/{request_id}/logs", status_code=201)
def create_service_request_log(
    request_id: int,
    log_data: ServiceRequestLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    sr = db.execute(
        select(ServiceRequest).where(ServiceRequest.id == request_id)
    ).scalar_one_or_none()

    if not sr:
        raise HTTPException(status_code=404, detail="YÃªu cáº§u dá»‹ch vá»¥ khÃ´ng tá»“n táº¡i")

    log = ServiceRequestLog(
        service_request_id=request_id,
        created_by=current_user.id,
        **log_data.model_dump()
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    return ServiceRequestLogResponse.model_validate(log)


@router.get("/{request_id}/deliverables")
def get_service_deliverables(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    sr = db.execute(
        select(ServiceRequest).where(ServiceRequest.id == request_id)
    ).scalar_one_or_none()

    if not sr:
        raise HTTPException(status_code=404, detail="YÃªu cáº§u dá»‹ch vá»¥ khÃ´ng tá»“n táº¡i")

    deliverables = db.execute(
        select(ServiceDeliverable)
        .where(ServiceDeliverable.service_request_id == request_id)
        .order_by(ServiceDeliverable.created_at.desc())
    ).scalars().all()

    return [ServiceDeliverableResponse.model_validate(d) for d in deliverables]


@router.post("/{request_id}/deliverables", status_code=201)
def create_service_deliverable(
    request_id: int,
    deliverable_data: ServiceDeliverableCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    sr = db.execute(
        select(ServiceRequest).where(ServiceRequest.id == request_id)
    ).scalar_one_or_none()

    if not sr:
        raise HTTPException(status_code=404, detail="YÃªu cáº§u dá»‹ch vá»¥ khÃ´ng tá»“n táº¡i")

    deliverable = ServiceDeliverable(
        service_request_id=request_id,
        **deliverable_data.model_dump()
    )
    db.add(deliverable)
    db.commit()
    db.refresh(deliverable)

    return ServiceDeliverableResponse.model_validate(deliverable)


