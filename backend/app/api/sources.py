from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
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
async def list_source_groups(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    is_active: bool | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List all source groups"""
    query = select(SourceGroup)
    
    if is_active is not None:
        query = query.where(SourceGroup.is_active == is_active)
    
    query = query.offset(skip).limit(limit).order_by(SourceGroup.created_at.desc())
    
    result = await db.execute(query)
    groups = result.scalars().all()
    
    # Get source counts
    response = []
    for group in groups:
        count_query = select(func.count(Source.id)).where(Source.group_id == group.id)
        count_result = await db.execute(count_query)
        source_count = count_result.scalar()
        
        response.append(SourceGroupListResponse(
            **group.__dict__,
            source_count=source_count
        ))
    
    return response


@router.post("/groups", response_model=SourceGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_source_group(
    group_data: SourceGroupCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new source group"""
    group = SourceGroup(**group_data.model_dump())
    db.add(group)
    await db.commit()
    await db.refresh(group)
    
    return SourceGroupResponse(**group.__dict__, sources=[])


@router.get("/groups/{group_id}", response_model=SourceGroupResponse)
async def get_source_group(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a source group by ID"""
    query = select(SourceGroup).where(SourceGroup.id == group_id).options(selectinload(SourceGroup.sources))
    result = await db.execute(query)
    group = result.scalar_one_or_none()
    
    if not group:
        raise HTTPException(status_code=404, detail="Source group not found")
    
    return group


@router.put("/groups/{group_id}", response_model=SourceGroupResponse)
async def update_source_group(
    group_id: int,
    group_data: SourceGroupUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a source group"""
    query = select(SourceGroup).where(SourceGroup.id == group_id)
    result = await db.execute(query)
    group = result.scalar_one_or_none()
    
    if not group:
        raise HTTPException(status_code=404, detail="Source group not found")
    
    # Update fields
    for field, value in group_data.model_dump(exclude_unset=True).items():
        setattr(group, field, value)
    
    await db.commit()
    await db.refresh(group, ["sources"])
    
    return group


@router.delete("/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_source_group(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a source group"""
    query = select(SourceGroup).where(SourceGroup.id == group_id)
    result = await db.execute(query)
    group = result.scalar_one_or_none()
    
    if not group:
        raise HTTPException(status_code=404, detail="Source group not found")
    
    await db.delete(group)
    await db.commit()


# Source Endpoints
@router.get("", response_model=List[SourceResponse])
async def list_sources(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    group_id: int | None = None,
    source_type: SourceType | None = None,
    is_active: bool | None = None,
    db: AsyncSession = Depends(get_db),
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
    
    result = await db.execute(query)
    sources = result.scalars().all()
    
    return sources


@router.post("", response_model=SourceResponse, status_code=status.HTTP_201_CREATED)
async def create_source(
    source_data: SourceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new source"""
    # Verify group exists if provided
    if source_data.group_id:
        group_query = select(SourceGroup).where(SourceGroup.id == source_data.group_id)
        group_result = await db.execute(group_query)
        group = group_result.scalar_one_or_none()
        
        if not group:
            raise HTTPException(status_code=404, detail="Source group not found")
    
    source = Source(**source_data.model_dump())
    db.add(source)
    await db.commit()
    await db.refresh(source)
    
    return source


@router.get("/{source_id}", response_model=SourceResponse)
async def get_source(
    source_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a source by ID"""
    query = select(Source).where(Source.id == source_id)
    result = await db.execute(query)
    source = result.scalar_one_or_none()
    
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    
    return source


@router.put("/{source_id}", response_model=SourceResponse)
async def update_source(
    source_id: int,
    source_data: SourceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a source"""
    query = select(Source).where(Source.id == source_id)
    result = await db.execute(query)
    source = result.scalar_one_or_none()
    
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    
    # Verify group exists if being updated
    if source_data.group_id is not None:
        group_query = select(SourceGroup).where(SourceGroup.id == source_data.group_id)
        group_result = await db.execute(group_query)
        group = group_result.scalar_one_or_none()
        
        if not group:
            raise HTTPException(status_code=404, detail="Source group not found")
    
    # Update fields
    for field, value in source_data.model_dump(exclude_unset=True).items():
        setattr(source, field, value)
    
    await db.commit()
    await db.refresh(source)
    
    return source


@router.delete("/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_source(
    source_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a source"""
    query = select(Source).where(Source.id == source_id)
    result = await db.execute(query)
    source = result.scalar_one_or_none()
    
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    
    await db.delete(source)
    await db.commit()
