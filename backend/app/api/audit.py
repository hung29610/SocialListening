from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_superuser
from app.models.user import User
from app.models.rbac import AuditLog
from app.schemas.rbac import AuditLogResponse, AuditLogCreate

router = APIRouter()


# ─── Audit Log Queries ────────────────────────────────────────────────────────

@router.get("/", response_model=List[AuditLogResponse])
def list_audit_logs(
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """
    List audit logs with optional filters - Admin only
    
    Query parameters:
    - user_id: Filter by user ID
    - action: Filter by action (e.g., 'user.create', 'settings.update')
    - resource_type: Filter by resource type (e.g., 'user', 'source')
    - resource_id: Filter by resource ID
    - start_date: Filter logs after this date
    - end_date: Filter logs before this date
    - limit: Max results (1-1000, default 100)
    - offset: Pagination offset
    """
    # Validate limit
    if limit < 1 or limit > 1000:
        raise HTTPException(
            status_code=400,
            detail="Limit must be between 1 and 1000"
        )
    
    # Build query
    query = select(AuditLog)
    
    # Apply filters
    filters = []
    if user_id is not None:
        filters.append(AuditLog.user_id == user_id)
    if action:
        filters.append(AuditLog.action.ilike(f"%{action}%"))
    if resource_type:
        filters.append(AuditLog.resource_type == resource_type)
    if resource_id is not None:
        filters.append(AuditLog.resource_id == resource_id)
    if start_date:
        filters.append(AuditLog.created_at >= start_date)
    if end_date:
        filters.append(AuditLog.created_at <= end_date)
    
    if filters:
        query = query.where(and_(*filters))
    
    # Order by newest first
    query = query.order_by(AuditLog.created_at.desc())
    
    # Apply pagination
    query = query.limit(limit).offset(offset)
    
    logs = db.execute(query).scalars().all()
    return [AuditLogResponse.from_orm(log) for log in logs]


@router.get("/{log_id}", response_model=AuditLogResponse)
def get_audit_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Get a specific audit log by ID - Admin only"""
    log = db.execute(
        select(AuditLog).where(AuditLog.id == log_id)
    ).scalar_one_or_none()
    
    if not log:
        raise HTTPException(status_code=404, detail="Audit log not found")
    
    return AuditLogResponse.from_orm(log)


@router.get("/stats/summary")
def get_audit_stats(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Get audit log statistics - Admin only"""
    from sqlalchemy import func
    
    # Build base query
    query = select(
        AuditLog.action,
        func.count(AuditLog.id).label('count')
    )
    
    # Apply date filters
    filters = []
    if start_date:
        filters.append(AuditLog.created_at >= start_date)
    if end_date:
        filters.append(AuditLog.created_at <= end_date)
    
    if filters:
        query = query.where(and_(*filters))
    
    # Group by action
    query = query.group_by(AuditLog.action).order_by(func.count(AuditLog.id).desc())
    
    results = db.execute(query).all()
    
    return {
        "total_logs": sum(r.count for r in results),
        "by_action": [{"action": r.action, "count": r.count} for r in results]
    }


# ─── Audit Log Creation (Internal Helper) ─────────────────────────────────────

def create_audit_log(
    db: Session,
    user_id: Optional[int],
    action: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[int] = None,
    details: Optional[dict] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
):
    """
    Helper function to create audit logs.
    This should be called from other API endpoints to log actions.
    """
    log = AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        ip_address=ip_address,
        user_agent=user_agent
    )
    
    db.add(log)
    db.commit()
    db.refresh(log)
    
    return log


# ─── Audit Log Cleanup ────────────────────────────────────────────────────────

@router.delete("/cleanup")
def cleanup_old_logs(
    days: int = 90,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """
    Delete audit logs older than specified days - Admin only
    Default: 90 days
    """
    from datetime import timedelta
    
    if days < 1:
        raise HTTPException(
            status_code=400,
            detail="Days must be at least 1"
        )
    
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    # Count logs to be deleted
    count_query = select(func.count(AuditLog.id)).where(
        AuditLog.created_at < cutoff_date
    )
    count = db.execute(count_query).scalar()
    
    # Delete old logs
    db.execute(
        select(AuditLog).where(AuditLog.created_at < cutoff_date)
    )
    db.query(AuditLog).filter(AuditLog.created_at < cutoff_date).delete()
    db.commit()
    
    return {
        "success": True,
        "deleted_count": count,
        "cutoff_date": cutoff_date.isoformat()
    }
