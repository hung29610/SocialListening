from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from datetime import datetime
from math import ceil

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.alert import Alert, AlertStatus

router = APIRouter()


@router.get("")
def list_alerts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    severity: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List alerts with filtering and pagination"""
    query = select(Alert)
    
    if severity:
        query = query.where(Alert.severity == severity)
    
    if status:
        query = query.where(Alert.status == status)
    
    total = db.execute(select(func.count()).select_from(query.subquery())).scalar()
    
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(Alert.created_at.desc())
    
    alerts = db.execute(query).scalars().all()
    
    total_pages = ceil(total / page_size) if total > 0 else 1
    
    return {
        "items": [
            {
                "id": a.id,
                "mention_id": a.mention_id,
                "severity": a.severity,
                "status": a.status,
                "title": a.title,
                "message": a.message,
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "acknowledged_at": a.acknowledged_at.isoformat() if a.acknowledged_at else None,
                "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None
            }
            for a in alerts
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }


@router.post("", status_code=201)
def create_alert(
    mention_id: int,
    title: str,
    severity: str,
    message: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new alert"""
    alert = Alert(
        mention_id=mention_id,
        title=title,
        severity=severity,
        message=message,
        status=AlertStatus.NEW
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    
    return {
        "id": alert.id,
        "mention_id": alert.mention_id,
        "severity": alert.severity,
        "status": alert.status,
        "title": alert.title,
        "message": alert.message,
        "created_at": alert.created_at.isoformat() if alert.created_at else None
    }


@router.get("/{alert_id}")
def get_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get an alert by ID"""
    alert = db.execute(
        select(Alert).where(Alert.id == alert_id)
    ).scalar_one_or_none()
    
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return {
        "id": alert.id,
        "mention_id": alert.mention_id,
        "severity": alert.severity,
        "status": alert.status,
        "title": alert.title,
        "message": alert.message,
        "created_at": alert.created_at.isoformat() if alert.created_at else None,
        "acknowledged_at": alert.acknowledged_at.isoformat() if alert.acknowledged_at else None,
        "resolved_at": alert.resolved_at.isoformat() if alert.resolved_at else None
    }


@router.post("/{alert_id}/acknowledge")
def acknowledge_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Acknowledge an alert"""
    alert = db.execute(
        select(Alert).where(Alert.id == alert_id)
    ).scalar_one_or_none()
    
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    alert.status = AlertStatus.ACKNOWLEDGED
    alert.acknowledged_by = current_user.id
    alert.acknowledged_at = datetime.utcnow()
    
    db.commit()
    db.refresh(alert)
    
    return {
        "id": alert.id,
        "status": alert.status,
        "acknowledged_at": alert.acknowledged_at.isoformat()
    }


@router.post("/{alert_id}/resolve")
def resolve_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Resolve an alert"""
    alert = db.execute(
        select(Alert).where(Alert.id == alert_id)
    ).scalar_one_or_none()
    
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    alert.status = AlertStatus.RESOLVED
    alert.resolved_by = current_user.id
    alert.resolved_at = datetime.utcnow()
    
    db.commit()
    db.refresh(alert)
    
    return {
        "id": alert.id,
        "status": alert.status,
        "resolved_at": alert.resolved_at.isoformat()
    }


@router.delete("/{alert_id}", status_code=204)
def delete_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete an alert"""
    alert = db.execute(
        select(Alert).where(Alert.id == alert_id)
    ).scalar_one_or_none()
    
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    db.delete(alert)
    db.commit()
