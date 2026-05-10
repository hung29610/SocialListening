from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from datetime import datetime
from math import ceil

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.incident import Incident, IncidentStatus, IncidentLog

router = APIRouter()


@router.get("")
def list_incidents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List incidents with filtering and pagination"""
    query = select(Incident)
    
    if status:
        query = query.where(Incident.status == status)
    
    total = db.execute(select(func.count()).select_from(query.subquery())).scalar()
    
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(Incident.created_at.desc())
    
    incidents = db.execute(query).scalars().all()
    
    total_pages = ceil(total / page_size) if total > 0 else 1
    
    return {
        "items": [
            {
                "id": i.id,
                "mention_id": i.mention_id,
                "owner_id": i.owner_id,
                "title": i.title,
                "description": i.description,
                "status": i.status,
                "is_overdue": i.is_overdue,
                "deadline": i.deadline.isoformat() if i.deadline else None,
                "created_at": i.created_at.isoformat() if i.created_at else None,
                "resolved_at": i.resolved_at.isoformat() if i.resolved_at else None
            }
            for i in incidents
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }


@router.post("", status_code=201)
def create_incident(
    incident_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new incident"""
    incident = Incident(
        mention_id=incident_data.get("mention_id"),
        owner_id=current_user.id,
        title=incident_data.get("title"),
        description=incident_data.get("description"),
        status=IncidentStatus.NEW,
        deadline=datetime.fromisoformat(incident_data["deadline"]) if incident_data.get("deadline") else None
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    
    # Create log entry
    log = IncidentLog(
        incident_id=incident.id,
        user_id=current_user.id,
        action="created",
        new_status=incident.status.value,
        notes=f"Incident created"
    )
    db.add(log)
    db.commit()
    
    return {
        "id": incident.id,
        "mention_id": incident.mention_id,
        "owner_id": incident.owner_id,
        "title": incident.title,
        "description": incident.description,
        "status": incident.status,
        "created_at": incident.created_at.isoformat() if incident.created_at else None
    }


@router.get("/{incident_id}")
def get_incident(
    incident_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get an incident by ID"""
    incident = db.execute(
        select(Incident).where(Incident.id == incident_id)
    ).scalar_one_or_none()
    
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    return {
        "id": incident.id,
        "mention_id": incident.mention_id,
        "owner_id": incident.owner_id,
        "title": incident.title,
        "description": incident.description,
        "status": incident.status,
        "is_overdue": incident.is_overdue,
        "deadline": incident.deadline.isoformat() if incident.deadline else None,
        "outcome": incident.outcome,
        "resolution_notes": incident.resolution_notes,
        "created_at": incident.created_at.isoformat() if incident.created_at else None,
        "resolved_at": incident.resolved_at.isoformat() if incident.resolved_at else None,
        "closed_at": incident.closed_at.isoformat() if incident.closed_at else None
    }


@router.put("/{incident_id}")
def update_incident(
    incident_id: int,
    status: str = None,
    title: str = None,
    description: str = None,
    resolution_notes: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update an incident"""
    incident = db.execute(
        select(Incident).where(Incident.id == incident_id)
    ).scalar_one_or_none()
    
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    old_status = incident.status
    
    if title:
        incident.title = title
    if description:
        incident.description = description
    if status:
        incident.status = status
    if resolution_notes:
        incident.resolution_notes = resolution_notes
    
    if status == 'resolved' and not incident.resolved_at:
        incident.resolved_at = datetime.utcnow()
    elif status == 'closed' and not incident.closed_at:
        incident.closed_at = datetime.utcnow()
    
    db.commit()
    db.refresh(incident)
    
    # Create log entry if status changed
    if old_status != incident.status:
        log = IncidentLog(
            incident_id=incident.id,
            user_id=current_user.id,
            action="status_changed",
            old_status=old_status.value if old_status else None,
            new_status=incident.status.value if incident.status else None,
            notes=f"Status changed"
        )
        db.add(log)
        db.commit()
    
    return {
        "id": incident.id,
        "status": incident.status,
        "title": incident.title,
        "description": incident.description,
        "resolution_notes": incident.resolution_notes,
        "resolved_at": incident.resolved_at.isoformat() if incident.resolved_at else None
    }


@router.delete("/{incident_id}", status_code=204)
def delete_incident(
    incident_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete an incident"""
    incident = db.execute(
        select(Incident).where(Incident.id == incident_id)
    ).scalar_one_or_none()
    
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    db.delete(incident)
    db.commit()


@router.get("/{incident_id}/logs")
def get_incident_logs(
    incident_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all logs for an incident"""
    logs = db.execute(
        select(IncidentLog)
        .where(IncidentLog.incident_id == incident_id)
        .order_by(IncidentLog.created_at.desc())
    ).scalars().all()
    
    return [
        {
            "id": log.id,
            "action": log.action,
            "old_status": log.old_status,
            "new_status": log.new_status,
            "notes": log.notes,
            "created_at": log.created_at.isoformat() if log.created_at else None
        }
        for log in logs
    ]
