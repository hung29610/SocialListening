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
from app.services.scheduler_service import calculate_next_crawl_time

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
    group = SourceGroup(**group_data.dict())
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
    
    return SourceGroupResponse.model_validate(group)


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
    for field, value in group_data.dict(exclude_unset=True).items():
        setattr(group, field, value)
    
    db.commit()
    db.refresh(group)
    
    return SourceGroupResponse.model_validate(group)


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
    
    return [SourceResponse.model_validate(s) for s in sources]


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
    
    source_dict = source_data.dict()

    # Fix field name: schema uses 'metadata' but model column is 'meta_data'
    if 'metadata' in source_dict:
        source_dict['meta_data'] = source_dict.pop('metadata')

    # Calculate next crawl time
    next_crawl_at = calculate_next_crawl_time(
        frequency=source_dict['crawl_frequency'],
        crawl_time=source_dict.get('crawl_time'),
        crawl_day_of_week=source_dict.get('crawl_day_of_week'),
        crawl_day_of_month=source_dict.get('crawl_day_of_month'),
        crawl_month=source_dict.get('crawl_month')
    )
    source_dict['next_crawl_at'] = next_crawl_at
    
    source = Source(**source_dict)
    db.add(source)
    db.commit()
    db.refresh(source)
    
    return SourceResponse.model_validate(source)


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
    
    return SourceResponse.model_validate(source)


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
    update_dict = source_data.dict(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(source, field, value)
    
    # Recalculate next crawl time if schedule-related fields were updated
    schedule_fields = ['crawl_frequency', 'crawl_time', 'crawl_day_of_week', 'crawl_day_of_month', 'crawl_month']
    if any(field in update_dict for field in schedule_fields):
        next_crawl_at = calculate_next_crawl_time(
            frequency=source.crawl_frequency,
            crawl_time=source.crawl_time,
            crawl_day_of_week=source.crawl_day_of_week,
            crawl_day_of_month=source.crawl_day_of_month,
            crawl_month=source.crawl_month
        )
        source.next_crawl_at = next_crawl_at
    
    db.commit()
    db.refresh(source)
    
    return SourceResponse.model_validate(source)


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


@router.post("/{source_id}/test")
def test_source(
    source_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Test if a source URL is reachable"""
    import httpx
    source = db.execute(
        select(Source).where(Source.id == source_id)
    ).scalar_one_or_none()

    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    try:
        resp = httpx.get(source.url, timeout=10, follow_redirects=True)
        return {
            "success": True,
            "status_code": resp.status_code,
            "reachable": resp.status_code < 400,
            "url": source.url
        }
    except Exception as e:
        return {
            "success": False,
            "reachable": False,
            "error": str(e),
            "url": source.url
        }


@router.post("/{source_id}/scan")
def scan_source(
    source_id: int,
    keyword_group_ids: list = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Trigger a scan on a specific source"""
    source = db.execute(
        select(Source).where(Source.id == source_id)
    ).scalar_one_or_none()

    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    # Import and reuse manual scan logic
    from app.api.crawl import ManualScanRequest, manual_scan
    from unittest.mock import MagicMock

    # Use crawl directly
    from app.models.keyword import Keyword, KeywordGroup
    from app.models.mention import Mention, AIAnalysis
    from app.models.alert import Alert, AlertSeverity, AlertStatus
    from app.services.ai_service import analyze_mention_with_dummy_ai
    from app.api.crawl import crawl_source
    import hashlib

    all_keywords = db.execute(
        select(Keyword).where(Keyword.is_active == True)
    ).scalars().all()

    if not all_keywords:
        return {"success": False, "message": "KhÃ´ng cÃ³ tá»« khÃ³a nÃ o Ä‘Æ°á»£c kÃ­ch hoáº¡t"}

    keyword_texts = [kw.keyword.lower() for kw in all_keywords]

    try:
        mentions = crawl_source(source, keyword_texts, all_keywords, db)
        new_count = 0
        for mention_data in mentions:
            content_hash = hashlib.sha256(mention_data['content'].encode()).hexdigest()
            existing = db.execute(
                select(Mention).where(Mention.content_hash == content_hash)
            ).scalar_one_or_none()
            if existing:
                continue
            mention = Mention(
                source_id=source.id,
                title=mention_data.get('title'),
                content=mention_data['content'],
                content_hash=content_hash,
                url=mention_data['url'],
                author=mention_data.get('author'),
                published_at=mention_data.get('published_at'),
                matched_keywords=mention_data.get('matched_keywords', [])
            )
            db.add(mention)
            db.commit()
            db.refresh(mention)
            new_count += 1

        source.last_crawled_at = __import__('datetime').datetime.utcnow()
        source.crawl_count = (source.crawl_count or 0) + 1
        db.commit()

        return {
            "success": True,
            "new_mentions": new_count,
            "source_id": source_id
        }
    except Exception as e:
        source.last_error = str(e)
        source.error_count = (source.error_count or 0) + 1
        db.commit()
        raise HTTPException(status_code=500, detail=f"Lá»—i quÃ©t nguá»“n: {str(e)}")

