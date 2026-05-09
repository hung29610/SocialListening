from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from sqlalchemy.orm import selectinload
from typing import List

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.keyword import Keyword, KeywordGroup
from app.schemas.keyword import (
    KeywordCreate, KeywordUpdate, KeywordResponse,
    KeywordGroupCreate, KeywordGroupUpdate, KeywordGroupResponse, KeywordGroupListResponse
)

router = APIRouter()


# Keyword Group Endpoints
@router.get("/groups", response_model=List[KeywordGroupListResponse])
async def list_keyword_groups(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    is_active: bool | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List all keyword groups"""
    query = select(KeywordGroup)
    
    if is_active is not None:
        query = query.where(KeywordGroup.is_active == is_active)
    
    query = query.offset(skip).limit(limit).order_by(KeywordGroup.created_at.desc())
    
    result = await db.execute(query)
    groups = result.scalars().all()
    
    # Get keyword counts
    response = []
    for group in groups:
        count_query = select(func.count(Keyword.id)).where(Keyword.group_id == group.id)
        count_result = await db.execute(count_query)
        keyword_count = count_result.scalar()
        
        response.append(KeywordGroupListResponse(
            **group.__dict__,
            keyword_count=keyword_count
        ))
    
    return response


@router.post("/groups", response_model=KeywordGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_keyword_group(
    group_data: KeywordGroupCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new keyword group"""
    group = KeywordGroup(**group_data.model_dump())
    db.add(group)
    await db.commit()
    await db.refresh(group)
    
    return KeywordGroupResponse(**group.__dict__, keywords=[])


@router.get("/groups/{group_id}", response_model=KeywordGroupResponse)
async def get_keyword_group(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a keyword group by ID"""
    query = select(KeywordGroup).where(KeywordGroup.id == group_id).options(selectinload(KeywordGroup.keywords))
    result = await db.execute(query)
    group = result.scalar_one_or_none()
    
    if not group:
        raise HTTPException(status_code=404, detail="Keyword group not found")
    
    return group


@router.put("/groups/{group_id}", response_model=KeywordGroupResponse)
async def update_keyword_group(
    group_id: int,
    group_data: KeywordGroupUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a keyword group"""
    query = select(KeywordGroup).where(KeywordGroup.id == group_id)
    result = await db.execute(query)
    group = result.scalar_one_or_none()
    
    if not group:
        raise HTTPException(status_code=404, detail="Keyword group not found")
    
    # Update fields
    for field, value in group_data.model_dump(exclude_unset=True).items():
        setattr(group, field, value)
    
    await db.commit()
    await db.refresh(group, ["keywords"])
    
    return group


@router.delete("/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_keyword_group(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a keyword group"""
    query = select(KeywordGroup).where(KeywordGroup.id == group_id)
    result = await db.execute(query)
    group = result.scalar_one_or_none()
    
    if not group:
        raise HTTPException(status_code=404, detail="Keyword group not found")
    
    await db.delete(group)
    await db.commit()


# Keyword Endpoints
@router.get("/groups/{group_id}/keywords", response_model=List[KeywordResponse])
async def list_keywords_in_group(
    group_id: int,
    is_active: bool | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List all keywords in a group"""
    query = select(Keyword).where(Keyword.group_id == group_id)
    
    if is_active is not None:
        query = query.where(Keyword.is_active == is_active)
    
    query = query.order_by(Keyword.created_at.desc())
    
    result = await db.execute(query)
    keywords = result.scalars().all()
    
    return keywords


@router.post("/keywords", response_model=KeywordResponse, status_code=status.HTTP_201_CREATED)
async def create_keyword(
    keyword_data: KeywordCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new keyword"""
    # Verify group exists
    group_query = select(KeywordGroup).where(KeywordGroup.id == keyword_data.group_id)
    group_result = await db.execute(group_query)
    group = group_result.scalar_one_or_none()
    
    if not group:
        raise HTTPException(status_code=404, detail="Keyword group not found")
    
    keyword = Keyword(**keyword_data.model_dump())
    db.add(keyword)
    await db.commit()
    await db.refresh(keyword)
    
    return keyword


@router.get("/keywords/{keyword_id}", response_model=KeywordResponse)
async def get_keyword(
    keyword_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a keyword by ID"""
    query = select(Keyword).where(Keyword.id == keyword_id)
    result = await db.execute(query)
    keyword = result.scalar_one_or_none()
    
    if not keyword:
        raise HTTPException(status_code=404, detail="Keyword not found")
    
    return keyword


@router.put("/keywords/{keyword_id}", response_model=KeywordResponse)
async def update_keyword(
    keyword_id: int,
    keyword_data: KeywordUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a keyword"""
    query = select(Keyword).where(Keyword.id == keyword_id)
    result = await db.execute(query)
    keyword = result.scalar_one_or_none()
    
    if not keyword:
        raise HTTPException(status_code=404, detail="Keyword not found")
    
    # Update fields
    for field, value in keyword_data.model_dump(exclude_unset=True).items():
        setattr(keyword, field, value)
    
    await db.commit()
    await db.refresh(keyword)
    
    return keyword


@router.delete("/keywords/{keyword_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_keyword(
    keyword_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a keyword"""
    query = select(Keyword).where(Keyword.id == keyword_id)
    result = await db.execute(query)
    keyword = result.scalar_one_or_none()
    
    if not keyword:
        raise HTTPException(status_code=404, detail="Keyword not found")
    
    await db.delete(keyword)
    await db.commit()


@router.delete("/groups/{group_id}/keywords", status_code=status.HTTP_204_NO_CONTENT)
async def delete_all_keywords_in_group(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete all keywords in a group"""
    # Verify group exists
    group_query = select(KeywordGroup).where(KeywordGroup.id == group_id)
    group_result = await db.execute(group_query)
    group = group_result.scalar_one_or_none()
    
    if not group:
        raise HTTPException(status_code=404, detail="Keyword group not found")
    
    # Delete all keywords
    await db.execute(delete(Keyword).where(Keyword.group_id == group_id))
    await db.commit()
