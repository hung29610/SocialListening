from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from pydantic import BaseModel, HttpUrl

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.crawl import CrawlJob, CrawlJobStatus, ScanSchedule
from app.models.source import Source
# from app.workers.tasks import crawl_source, run_scheduled_crawl  # Requires Celery

router = APIRouter()


class ManualCrawlRequest(BaseModel):
    source_ids: List[int]
    keyword_group_ids: List[int]


class ManualCrawlResponse(BaseModel):
    job_id: int
    sources_queued: int
    message: str


@router.post("/manual", response_model=ManualCrawlResponse, status_code=status.HTTP_201_CREATED)
async def trigger_manual_crawl(
    request: ManualCrawlRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Trigger a manual crawl job
    
    NOTE: This is a simplified version that creates the job record.
    For full background processing, Celery workers need to be installed and running.
    
    This will:
    1. Create a crawl job record
    2. Return job ID for tracking
    
    To enable full background processing:
    - Install: pip install celery redis
    - Start Redis: redis-server
    - Start Celery worker: celery -A app.workers.celery_app worker --loglevel=info
    """
    # Verify sources exist
    result = await db.execute(
        select(Source).where(Source.id.in_(request.source_ids), Source.is_active == True)
    )
    sources = result.scalars().all()
    
    if not sources:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active sources found with provided IDs"
        )
    
    # Create crawl job
    crawl_job = CrawlJob(
        job_type="manual",
        source_ids=request.source_ids,
        keyword_group_ids=request.keyword_group_ids,
        status=CrawlJobStatus.PENDING,
        total_sources=len(sources)
    )
    
    db.add(crawl_job)
    await db.commit()
    await db.refresh(crawl_job)
    
    # NOTE: Background task queuing disabled (requires Celery)
    # To enable: uncomment the following lines after installing Celery
    # for source_id in request.source_ids:
    #     crawl_source.delay(source_id, request.keyword_group_ids)
    
    return ManualCrawlResponse(
        job_id=crawl_job.id,
        sources_queued=len(sources),
        message=f"Crawl job created (ID: {crawl_job.id}). Note: Background processing requires Celery workers to be running."
    )


@router.post("/schedule/{schedule_id}/run", response_model=dict)
async def trigger_scheduled_crawl(
    schedule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Manually trigger a scheduled crawl
    
    NOTE: Requires Celery workers to be running for background processing.
    """
    # Verify schedule exists
    result = await db.execute(select(ScanSchedule).where(ScanSchedule.id == schedule_id))
    schedule = result.scalar_one_or_none()
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    if not schedule.is_active:
        raise HTTPException(status_code=400, detail="Schedule is not active")
    
    # NOTE: Background task queuing disabled (requires Celery)
    # To enable: uncomment the following line after installing Celery
    # run_scheduled_crawl.delay(schedule_id)
    
    return {
        "message": f"Scheduled crawl request received for schedule {schedule_id}. Note: Background processing requires Celery workers.",
        "schedule_name": schedule.name
    }


@router.get("/jobs/{job_id}", response_model=dict)
async def get_crawl_job_status(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get status of a crawl job"""
    result = await db.execute(select(CrawlJob).where(CrawlJob.id == job_id))
    job = result.scalar_one_or_none()
    
    if not job:
        raise HTTPException(status_code=404, detail="Crawl job not found")
    
    return {
        "id": job.id,
        "job_type": job.job_type,
        "status": job.status,
        "total_sources": job.total_sources,
        "processed_sources": job.processed_sources,
        "mentions_found": job.mentions_found,
        "error_message": job.error_message,
        "created_at": job.created_at,
        "started_at": job.started_at,
        "completed_at": job.completed_at
    }
