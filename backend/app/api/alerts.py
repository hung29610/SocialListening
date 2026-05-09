from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from datetime import datetime
from typing import List
from math import ceil

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.alert import Alert, AlertStatus
from app.schemas.alert import (
    AlertCreate, AlertUpdate, AlertResponse, AlertAcknowledge, AlertResolve,
    AlertListResponse
)

router = APIRouter()


@router.get("", response_model=AlertListResponse)
async def list_alerts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    severity: str | None = None,
    status: AlertStatus | None = None,
    assigned_to: int | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List alerts with filtering and pagination"""
    query = select(Alert)
    
    if severity:
        query = query.where(Alert.severity == severity)
    
    if status:
        query = query.where(Alert.status == status)
    
    if assigned_to:
        query = query.where(Alert.assigned_to == assigned_to)
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(Alert.created_at.desc())
    
    result = await db.execute(query)
    alerts = result.scalars().all()
    
    total_pages = ceil(total / page_size) if total > 0 else 1
    
    return AlertListResponse(
        items=[AlertResponse.model_validate(a) for a in alerts],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.post("", response_model=AlertResponse, status_code=201)
async def create_alert(
    alert_data: AlertCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new alert"""
    alert = Alert(**alert_data.model_dump())
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    
    return alert


@router.get("/{alert_id}", response_model=AlertResponse)
async def get_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get an alert by ID"""
    query = select(Alert).where(Alert.id == alert_id)
    result = await db.execute(query)
    alert = result.scalar_one_or_none()
    
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return alert


@router.put("/{alert_id}", response_model=AlertResponse)
async def update_alert(
    alert_id: int,
    alert_data: AlertUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update an alert"""
    query = select(Alert).where(Alert.id == alert_id)
    result = await db.execute(query)
    alert = result.scalar_one_or_none()
    
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    for field, value in alert_data.model_dump(exclude_unset=True).items():
        setattr(alert, field, value)
    
    await db.commit()
    await db.refresh(alert)
    
    return alert


@router.post("/{alert_id}/acknowledge", response_model=AlertResponse)
async def acknowledge_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Acknowledge an alert"""
    query = select(Alert).where(Alert.id == alert_id)
    result = await db.execute(query)
    alert = result.scalar_one_or_none()
    
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    alert.status = AlertStatus.ACKNOWLEDGED
    alert.acknowledged_by = current_user.id
    alert.acknowledged_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(alert)
    
    return alert


@router.post("/{alert_id}/resolve", response_model=AlertResponse)
async def resolve_alert(
    alert_id: int,
    resolve_data: AlertResolve,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Resolve an alert"""
    query = select(Alert).where(Alert.id == alert_id)
    result = await db.execute(query)
    alert = result.scalar_one_or_none()
    
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    alert.status = AlertStatus.RESOLVED
    alert.resolved_by = current_user.id
    alert.resolved_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(alert)
    
    return alert


@router.delete("/{alert_id}", status_code=204)
async def delete_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete an alert"""
    query = select(Alert).where(Alert.id == alert_id)
    result = await db.execute(query)
    alert = result.scalar_one_or_none()
    
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    await db.delete(alert)
    await db.commit()
