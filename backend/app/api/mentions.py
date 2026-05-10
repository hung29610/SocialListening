from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func, or_
from typing import List
from math import ceil

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.mention import Mention, AIAnalysis

router = APIRouter()


@router.get("")
def list_mentions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    source_id: int | None = None,
    sentiment: str | None = None,
    min_risk_score: float | None = Query(None, ge=0, le=100),
    search_query: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List mentions with filtering and pagination"""
    query = select(Mention)
    
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
    
    # Get total count
    total = db.execute(select(func.count()).select_from(query.subquery())).scalar()
    
    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(Mention.collected_at.desc())
    
    mentions = db.execute(query).scalars().all()
    
    # Get AI analysis for each mention
    result_items = []
    for m in mentions:
        analysis = db.execute(
            select(AIAnalysis).where(AIAnalysis.mention_id == m.id)
        ).scalar_one_or_none()
        
        result_items.append({
            "id": m.id,
            "source_id": m.source_id,
            "title": m.title,
            "content": m.content,
            "url": m.url,
            "author": m.author,
            "published_at": m.published_at.isoformat() if m.published_at else None,
            "collected_at": m.collected_at.isoformat() if m.collected_at else None,
            "matched_keywords": m.matched_keywords,
            "ai_analysis": {
                "sentiment": analysis.sentiment if analysis else None,
                "risk_score": analysis.risk_score if analysis else None,
                "crisis_level": analysis.crisis_level if analysis else None,
                "summary_vi": analysis.summary_vi if analysis else None,
                "suggested_action": analysis.suggested_action if analysis else None
            } if analysis else None
        })
    
    total_pages = ceil(total / page_size) if total > 0 else 1
    
    return {
        "items": result_items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }


@router.get("/{mention_id}")
def get_mention(
    mention_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a mention by ID with AI analysis"""
    mention = db.execute(
        select(Mention).where(Mention.id == mention_id)
    ).scalar_one_or_none()
    
    if not mention:
        raise HTTPException(status_code=404, detail="Mention not found")
    
    analysis = db.execute(
        select(AIAnalysis).where(AIAnalysis.mention_id == mention.id)
    ).scalar_one_or_none()
    
    return {
        "id": mention.id,
        "source_id": mention.source_id,
        "title": mention.title,
        "content": mention.content,
        "url": mention.url,
        "author": mention.author,
        "published_at": mention.published_at.isoformat() if mention.published_at else None,
        "collected_at": mention.collected_at.isoformat() if mention.collected_at else None,
        "matched_keywords": mention.matched_keywords,
        "platform_post_id": mention.platform_post_id,
        "metadata": mention.meta_data,
        "ai_analysis": {
            "id": analysis.id,
            "sentiment": analysis.sentiment,
            "risk_score": analysis.risk_score,
            "crisis_level": analysis.crisis_level,
            "summary_vi": analysis.summary_vi,
            "suggested_action": analysis.suggested_action,
            "responsible_department": analysis.responsible_department,
            "confidence_score": analysis.confidence_score,
            "ai_provider": analysis.ai_provider,
            "analyzed_at": analysis.analyzed_at.isoformat() if analysis.analyzed_at else None
        } if analysis else None
    }


@router.delete("/{mention_id}", status_code=204)
def delete_mention(
    mention_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a mention"""
    mention = db.execute(
        select(Mention).where(Mention.id == mention_id)
    ).scalar_one_or_none()
    
    if not mention:
        raise HTTPException(status_code=404, detail="Mention not found")
    
    db.delete(mention)
    db.commit()
