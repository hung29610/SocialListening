from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select, func
from typing import List

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.source import Source, SourceGroup, SourceType
from app.schemas.source import (
    SourceCreate, SourceUpdate, SourceResponse,
    SourceGroupCreate, SourceGroupUpdate, SourceGroupResponse, SourceGroupListResponse
)

router = APIRouter()


# Source Group Endpoints
@router.get("/groups", response_model=List[SourceGroupListResponse])
def list_source_groups(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    is_active: bool | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List all source groups"""
    query = select(SourceGroup)
    
    if is_active is not None:
        query = query.where(SourceGroup.is_active == is_active)
    
    query = query.offset(skip).limit(limit).order_by(SourceGroup.created_at.desc())
    
    result = db.execute(query)
    groups = result.scalars().all()
    
    # Get source counts
    response = []
    for group in groups:
        count_query = select(func.count(Source.id)).where(Source.group_id == group.id)
        count_result = db.execute(count_query)
        source_count = count_result.scalar()
        
        response.append(SourceGroupListResponse(
            **group.__dict__,
            source_count=source_count
        ))
    
    return response


@router.post("/groups", response_model=SourceGroupResponse, status_code=status.HTTP_201_CREATED)
def create_source_group(
    group_data: SourceGroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new source group"""
    group = SourceGroup(**group_data.model_dump())
    db.add(group)
    db.commit()
    db.refresh(group)
    
    return SourceGroupResponse(**group.__dict__, sources=[])


@router.get("/groups/{group_id}", response_model=SourceGroupResponse)
def get_source_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a source group by ID"""
    query = select(SourceGroup).where(SourceGroup.id == group_id).options(selectinload(SourceGroup.sources))
    result = db.execute(query)
    group = result.scalar_one_or_none()
    
    if not group:
        raise HTTPException(status_code=404, detail="Source group not found")
    
    return group


@router.put("/groups/{group_id}", response_model=SourceGroupResponse)
def update_source_group(
    group_id: int,
    group_data: SourceGroupUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a source group"""
    query = select(SourceGroup).where(SourceGroup.id == group_id)
    result = db.execute(query)
    group = result.scalar_one_or_none()
    
    if not group:
        raise HTTPException(status_code=404, detail="Source group not found")
    
    # Update fields
    for field, value in group_data.model_dump(exclude_unset=True).items():
        setattr(group, field, value)
    
    db.commit()
    db.refresh(group)
    
    return group


@router.delete("/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_source_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a source group"""
    query = select(SourceGroup).where(SourceGroup.id == group_id)
    result = db.execute(query)
    group = result.scalar_one_or_none()
    
    if not group:
        raise HTTPException(status_code=404, detail="Source group not found")
    
    db.delete(group)
    db.commit()


# Source Endpoints
@router.get("", response_model=List[SourceResponse])
def list_sources(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    group_id: int | None = None,
    source_type: SourceType | None = None,
    is_active: bool | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List all sources"""
    query = select(Source)
    
    if group_id is not None:
        query = query.where(Source.group_id == group_id)
    
    if source_type is not None:
        query = query.where(Source.source_type == source_type)
    
    if is_active is not None:
        query = query.where(Source.is_active == is_active)
    
    query = query.offset(skip).limit(limit).order_by(Source.created_at.desc())
    
    result = db.execute(query)
    sources = result.scalars().all()
    
    return sources


@router.post("", response_model=SourceResponse, status_code=status.HTTP_201_CREATED)
def create_source(
    source_data: SourceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new source"""
    # Verify group exists if provided
    if source_data.group_id:
        group_query = select(SourceGroup).where(SourceGroup.id == source_data.group_id)
        group_result = db.execute(group_query)
        group = group_result.scalar_one_or_none()
        
        if not group:
            raise HTTPException(status_code=404, detail="Source group not found")
    
    source = Source(**source_data.model_dump())
    db.add(source)
    db.commit()
    db.refresh(source)
    
    return source


@router.get("/{source_id}", response_model=SourceResponse)
def get_source(
    source_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a source by ID"""
    query = select(Source).where(Source.id == source_id)
    result = db.execute(query)
    source = result.scalar_one_or_none()
    
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    
    return source


@router.put("/{source_id}", response_model=SourceResponse)
def update_source(
    source_id: int,
    source_data: SourceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a source"""
    query = select(Source).where(Source.id == source_id)
    result = db.execute(query)
    source = result.scalar_one_or_none()
    
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    
    # Verify group exists if being updated
    if source_data.group_id is not None:
        group_query = select(SourceGroup).where(SourceGroup.id == source_data.group_id)
        group_result = db.execute(group_query)
        group = group_result.scalar_one_or_none()
        
        if not group:
            raise HTTPException(status_code=404, detail="Source group not found")
    
    # Update fields
    for field, value in source_data.model_dump(exclude_unset=True).items():
        setattr(source, field, value)
    
    db.commit()
    db.refresh(source)
    
    return source


@router.delete("/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_source(
    source_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a source"""
    query = select(Source).where(Source.id == source_id)
    result = db.execute(query)
    source = result.scalar_one_or_none()
    
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    
    db.delete(source)
    db.commit()
