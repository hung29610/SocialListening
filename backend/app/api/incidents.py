from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from datetime import datetime
from typing import List
from math import ceil
import os
import uuid

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.incident import (
    Incident, IncidentLog, EvidenceFile, TakedownRequest, ResponseTemplate, IncidentStatus
)
from app.schemas.incident import (
    IncidentCreate, IncidentUpdate, IncidentResponse, IncidentListResponse,
    IncidentLogCreate, IncidentLogResponse,
    EvidenceFileCreate, EvidenceFileResponse,
    TakedownRequestCreate, TakedownRequestUpdate, TakedownRequestResponse,
    ResponseTemplateCreate, ResponseTemplateUpdate, ResponseTemplateResponse
)

router = APIRouter()


# Incident Endpoints
@router.get("", response_model=IncidentListResponse)
async def list_incidents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: IncidentStatus | None = None,
    owner_id: int | None = None,
    is_overdue: bool | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List incidents with filtering and pagination"""
    query = select(Incident)
    
    if status:
        query = query.where(Incident.status == status)
    
    if owner_id:
        query = query.where(Incident.owner_id == owner_id)
    
    if is_overdue is not None:
        query = query.where(Incident.is_overdue == is_overdue)
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(Incident.created_at.desc())
    
    result = await db.execute(query)
    incidents = result.scalars().all()
    
    total_pages = ceil(total / page_size) if total > 0 else 1
    
    return IncidentListResponse(
        items=[IncidentResponse.model_validate(i) for i in incidents],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.post("", response_model=IncidentResponse, status_code=201)
async def create_incident(
    incident_data: IncidentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new incident"""
    incident = Incident(**incident_data.model_dump())
    db.add(incident)
    await db.commit()
    await db.refresh(incident)
    
    # Create initial log entry
    log = IncidentLog(
        incident_id=incident.id,
        user_id=current_user.id,
        action="created",
        new_status=incident.status.value,
        notes=f"Incident created by {current_user.full_name or current_user.email}"
    )
    db.add(log)
    await db.commit()
    
    return incident


@router.get("/{incident_id}", response_model=IncidentResponse)
async def get_incident(
    incident_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get an incident by ID"""
    query = select(Incident).where(Incident.id == incident_id)
    result = await db.execute(query)
    incident = result.scalar_one_or_none()
    
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    return incident


@router.put("/{incident_id}", response_model=IncidentResponse)
async def update_incident(
    incident_id: int,
    incident_data: IncidentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update an incident"""
    query = select(Incident).where(Incident.id == incident_id)
    result = await db.execute(query)
    incident = result.scalar_one_or_none()
    
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    old_status = incident.status
    
    # Update fields
    for field, value in incident_data.model_dump(exclude_unset=True).items():
        setattr(incident, field, value)
    
    # Update resolved/closed timestamps
    if incident.status == IncidentStatus.RESOLVED and not incident.resolved_at:
        incident.resolved_at = datetime.utcnow()
    elif incident.status == IncidentStatus.CLOSED and not incident.closed_at:
        incident.closed_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(incident)
    
    # Create log entry if status changed
    if old_status != incident.status:
        log = IncidentLog(
            incident_id=incident.id,
            user_id=current_user.id,
            action="status_changed",
            old_status=old_status.value,
            new_status=incident.status.value,
            notes=f"Status changed by {current_user.full_name or current_user.email}"
        )
        db.add(log)
        await db.commit()
    
    return incident


@router.delete("/{incident_id}", status_code=204)
async def delete_incident(
    incident_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete an incident"""
    query = select(Incident).where(Incident.id == incident_id)
    result = await db.execute(query)
    incident = result.scalar_one_or_none()
    
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    await db.delete(incident)
    await db.commit()


# Incident Logs
@router.get("/{incident_id}/logs", response_model=List[IncidentLogResponse])
async def get_incident_logs(
    incident_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all logs for an incident"""
    query = select(IncidentLog).where(IncidentLog.incident_id == incident_id).order_by(IncidentLog.created_at.desc())
    result = await db.execute(query)
    logs = result.scalars().all()
    
    return logs


@router.post("/{incident_id}/logs", response_model=IncidentLogResponse, status_code=201)
async def create_incident_log(
    incident_id: int,
    log_data: IncidentLogCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Add a log entry to an incident"""
    # Verify incident exists
    incident_query = select(Incident).where(Incident.id == incident_id)
    incident_result = await db.execute(incident_query)
    incident = incident_result.scalar_one_or_none()
    
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    log = IncidentLog(
        incident_id=incident_id,
        user_id=current_user.id,
        **log_data.model_dump()
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    
    return log


# Evidence Files
@router.get("/{incident_id}/evidence", response_model=List[EvidenceFileResponse])
async def get_incident_evidence(
    incident_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all evidence files for an incident"""
    query = select(EvidenceFile).where(EvidenceFile.incident_id == incident_id).order_by(EvidenceFile.captured_at.desc())
    result = await db.execute(query)
    files = result.scalars().all()
    
    return files


@router.post("/{incident_id}/evidence", response_model=EvidenceFileResponse, status_code=201)
async def upload_evidence(
    incident_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Upload an evidence file"""
    # Verify incident exists
    incident_query = select(Incident).where(Incident.id == incident_id)
    incident_result = await db.execute(incident_query)
    incident = incident_result.scalar_one_or_none()
    
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    # Save file
    upload_dir = f"uploads/evidence/{incident_id}"
    os.makedirs(upload_dir, exist_ok=True)
    
    file_ext = os.path.splitext(file.filename)[1]
    file_name = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(upload_dir, file_name)
    
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    # Create evidence record
    evidence = EvidenceFile(
        incident_id=incident_id,
        file_name=file.filename,
        file_path=file_path,
        file_type=file.content_type,
        file_size=len(content),
        captured_by=current_user.id,
        capture_method="manual_upload"
    )
    db.add(evidence)
    await db.commit()
    await db.refresh(evidence)
    
    return evidence


# Takedown Requests
@router.get("/{incident_id}/takedown-requests", response_model=List[TakedownRequestResponse])
async def get_takedown_requests(
    incident_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all takedown requests for an incident"""
    query = select(TakedownRequest).where(TakedownRequest.incident_id == incident_id).order_by(TakedownRequest.created_at.desc())
    result = await db.execute(query)
    requests = result.scalars().all()
    
    return requests


@router.post("/{incident_id}/takedown-requests", response_model=TakedownRequestResponse, status_code=201)
async def create_takedown_request(
    incident_id: int,
    request_data: TakedownRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a takedown request"""
    # Verify incident exists
    incident_query = select(Incident).where(Incident.id == incident_id)
    incident_result = await db.execute(incident_query)
    incident = incident_result.scalar_one_or_none()
    
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    request = TakedownRequest(
        **request_data.model_dump(),
        submitted_by=current_user.id
    )
    db.add(request)
    await db.commit()
    await db.refresh(request)
    
    return request


@router.put("/takedown-requests/{request_id}", response_model=TakedownRequestResponse)
async def update_takedown_request(
    request_id: int,
    request_data: TakedownRequestUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a takedown request"""
    query = select(TakedownRequest).where(TakedownRequest.id == request_id)
    result = await db.execute(query)
    request = result.scalar_one_or_none()
    
    if not request:
        raise HTTPException(status_code=404, detail="Takedown request not found")
    
    for field, value in request_data.model_dump(exclude_unset=True).items():
        setattr(request, field, value)
    
    await db.commit()
    await db.refresh(request)
    
    return request


# Response Templates
@router.get("/templates", response_model=List[ResponseTemplateResponse])
async def list_response_templates(
    template_type: str | None = None,
    is_active: bool | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List response templates"""
    query = select(ResponseTemplate)
    
    if template_type:
        query = query.where(ResponseTemplate.template_type == template_type)
    
    if is_active is not None:
        query = query.where(ResponseTemplate.is_active == is_active)
    
    query = query.order_by(ResponseTemplate.created_at.desc())
    
    result = await db.execute(query)
    templates = result.scalars().all()
    
    return templates


@router.post("/templates", response_model=ResponseTemplateResponse, status_code=201)
async def create_response_template(
    template_data: ResponseTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a response template"""
    template = ResponseTemplate(**template_data.model_dump())
    db.add(template)
    await db.commit()
    await db.refresh(template)
    
    return template


@router.put("/templates/{template_id}", response_model=ResponseTemplateResponse)
async def update_response_template(
    template_id: int,
    template_data: ResponseTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a response template"""
    query = select(ResponseTemplate).where(ResponseTemplate.id == template_id)
    result = await db.execute(query)
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    for field, value in template_data.model_dump(exclude_unset=True).items():
        setattr(template, field, value)
    
    await db.commit()
    await db.refresh(template)
    
    return template


@router.delete("/templates/{template_id}", status_code=204)
async def delete_response_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a response template"""
    query = select(ResponseTemplate).where(ResponseTemplate.id == template_id)
    result = await db.execute(query)
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    await db.delete(template)
    await db.commit()
