from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from typing import List
from math import ceil

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.mention import Mention, AIAnalysis
from app.schemas.mention import (
    MentionResponse, MentionWithAnalysis, MentionFilter, MentionListResponse
)

router = APIRouter()


@router.get("", response_model=MentionListResponse)
async def list_mentions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    source_id: int | None = None,
    sentiment: str | None = None,
    min_risk_score: float | None = Query(None, ge=0, le=100),
    max_risk_score: float | None = Query(None, ge=0, le=100),
    crisis_level: int | None = Query(None, ge=1, le=5),
    search_query: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List mentions with filtering and pagination"""
    # Base query
    query = select(Mention).options(selectinload(Mention.ai_analysis))
    
    # Apply filters
    if source_id:
        query = query.where(Mention.source_id == source_id)
    
    if search_query:
        search_pattern = f"%{search_query}%"
        query = query.where(
            or_(
                Mention.title.ilike(search_pattern),
                Mention.content.ilike(search_pattern)
            )
        )
    
    # Join with AI analysis for sentiment/risk filtering
    if sentiment or min_risk_score or max_risk_score or crisis_level:
        query = query.join(AIAnalysis, Mention.id == AIAnalysis.mention_id)
        
        if sentiment:
            query = query.where(AIAnalysis.sentiment == sentiment)
        
        if min_risk_score is not None:
            query = query.where(AIAnalysis.risk_score >= min_risk_score)
        
        if max_risk_score is not None:
            query = query.where(AIAnalysis.risk_score <= max_risk_score)
        
        if crisis_level is not None:
            query = query.where(AIAnalysis.crisis_level == crisis_level)
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(Mention.collected_at.desc())
    
    # Execute query
    result = await db.execute(query)
    mentions = result.scalars().all()
    
    # Calculate total pages
    total_pages = ceil(total / page_size) if total > 0 else 1
    
    return MentionListResponse(
        items=[MentionWithAnalysis.model_validate(m) for m in mentions],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/{mention_id}", response_model=MentionWithAnalysis)
async def get_mention(
    mention_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a mention by ID"""
    query = select(Mention).where(Mention.id == mention_id).options(selectinload(Mention.ai_analysis))
    result = await db.execute(query)
    mention = result.scalar_one_or_none()
    
    if not mention:
        raise HTTPException(status_code=404, detail="Mention not found")
    
    return mention


@router.delete("/{mention_id}", status_code=204)
async def delete_mention(
    mention_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a mention"""
    query = select(Mention).where(Mention.id == mention_id)
    result = await db.execute(query)
    mention = result.scalar_one_or_none()
    
    if not mention:
        raise HTTPException(status_code=404, detail="Mention not found")
    
    await db.delete(mention)
    await db.commit()
