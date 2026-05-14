"""
Background Scheduler Service for Automated Scanning
Uses APScheduler to run scheduled scans based on source configurations
"""
import os
from datetime import datetime, timedelta
from typing import List
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.source import Source
from app.models.crawl import CrawlJob, CrawlJobStatus


# Global scheduler instance
scheduler = BackgroundScheduler()
scheduler_started = False


def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        return db
    finally:
        pass  # Don't close here, will close after use


def execute_scheduled_scan(source_id: int):
    """
    Execute a scheduled scan for a specific source
    
    Args:
        source_id: ID of the source to scan
    """
    db = get_db()
    try:
        # Get source
        source = db.execute(
            select(Source).where(Source.id == source_id)
        ).scalar_one_or_none()
        
        if not source or not source.is_active:
            print(f"[Scheduler] Source {source_id} not found or inactive, skipping")
            return
        
        print(f"[Scheduler] Starting scheduled scan for source: {source.name} (ID: {source_id})")
        
        # Create crawl job
        job = CrawlJob(
            source_ids=[source_id],
            job_type='scheduled',
            status=CrawlJobStatus.PENDING,
            created_at=datetime.utcnow()
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        
        # Update job status to running
        job.status = CrawlJobStatus.RUNNING
        job.started_at = datetime.utcnow()
        db.commit()
        
        # Import here to avoid circular dependency
        from app.services.crawl_service import crawl_source
        
        # Execute crawl
        try:
            result = crawl_source(db, source_id, job_id=job.id)
            
            # Update job status
            job.status = CrawlJobStatus.COMPLETED
            job.completed_at = datetime.utcnow()
            job.mentions_found = result.get('mentions_found', 0)
            job.error_message = None
            
            # Update source statistics
            source.last_crawled_at = datetime.utcnow()
            source.last_success_at = datetime.utcnow()
            source.total_mentions = (source.total_mentions or 0) + result.get('mentions_new', 0)
            source.error_count = 0
            
            db.commit()
            
            print(f"[Scheduler] ✅ Scan completed: {result.get('mentions_new', 0)} new mentions")
            
        except Exception as e:
            # Update job status to failed
            job.status = CrawlJobStatus.FAILED
            job.completed_at = datetime.utcnow()
            job.error_message = str(e)
            
            # Update source error count
            source.last_crawled_at = datetime.utcnow()
            source.error_count = (source.error_count or 0) + 1
            
            db.commit()
            
            print(f"[Scheduler] ❌ Scan failed: {e}")
            
    except Exception as e:
        print(f"[Scheduler] ❌ Error executing scheduled scan: {e}")
    finally:
        db.close()


def should_run_now(source: Source) -> bool:
    """
    Check if a source should run now based on its schedule
    
    Args:
        source: Source object with schedule configuration
        
    Returns:
        True if should run now, False otherwise
    """
    if not source.is_active:
        return False
    
    now = datetime.utcnow()
    
    # Check if enough time has passed since last crawl
    if source.last_crawled_at:
        if source.crawl_frequency == 'hourly':
            min_interval = timedelta(hours=1)
        elif source.crawl_frequency == 'daily':
            min_interval = timedelta(days=1)
        elif source.crawl_frequency == 'weekly':
            min_interval = timedelta(weeks=1)
        else:
            min_interval = timedelta(hours=1)
        
        if now - source.last_crawled_at < min_interval:
            return False
    
    # Check schedule_hours (if specified)
    if source.schedule_hours:
        current_hour = now.hour
        if current_hour not in source.schedule_hours:
            return False
    
    # Check schedule_days_of_week (if specified)
    if source.schedule_days_of_week:
        current_day = now.weekday()  # 0 = Monday, 6 = Sunday
        if current_day not in source.schedule_days_of_week:
            return False
    
    return True


def scan_all_scheduled_sources():
    """
    Check all active sources and run scans for those that should run now
    This function is called every hour by the scheduler
    """
    db = get_db()
    try:
        print(f"[Scheduler] Checking scheduled sources at {datetime.utcnow()}")
        
        # Get all active sources
        sources = db.execute(
            select(Source).where(Source.is_active == True)
        ).scalars().all()
        
        scans_triggered = 0
        for source in sources:
            if should_run_now(source):
                print(f"[Scheduler] Triggering scan for: {source.name}")
                execute_scheduled_scan(source.id)
                scans_triggered += 1
        
        print(f"[Scheduler] Triggered {scans_triggered} scans")
        
    except Exception as e:
        print(f"[Scheduler] ❌ Error in scan_all_scheduled_sources: {e}")
    finally:
        db.close()


def start_scheduler():
    """
    Start the background scheduler
    Should be called once when the application starts
    """
    global scheduler_started
    
    if scheduler_started:
        print("[Scheduler] Already started, skipping")
        return
    
    # Check if scheduler is enabled
    scheduler_enabled = os.getenv("SCHEDULER_ENABLED", "true").lower() == "true"
    
    if not scheduler_enabled:
        print("[Scheduler] Disabled by environment variable")
        return
    
    try:
        # Add job to check sources every hour
        scheduler.add_job(
            scan_all_scheduled_sources,
            CronTrigger(minute=0),  # Run at the start of every hour
            id='scan_scheduled_sources',
            name='Scan Scheduled Sources',
            replace_existing=True
        )
        
        # Start scheduler
        scheduler.start()
        scheduler_started = True
        
        print("[Scheduler] ✅ Background scheduler started")
        print("[Scheduler] Will check for scheduled scans every hour")
        
    except Exception as e:
        print(f"[Scheduler] ❌ Failed to start scheduler: {e}")


def stop_scheduler():
    """
    Stop the background scheduler
    Should be called when the application shuts down
    """
    global scheduler_started
    
    if not scheduler_started:
        return
    
    try:
        scheduler.shutdown(wait=False)
        scheduler_started = False
        print("[Scheduler] ✅ Background scheduler stopped")
    except Exception as e:
        print(f"[Scheduler] ❌ Error stopping scheduler: {e}")


def get_scheduler_status():
    """
    Get the current status of the scheduler
    
    Returns:
        dict with scheduler status information
    """
    return {
        "running": scheduler_started,
        "jobs": [
            {
                "id": job.id,
                "name": job.name,
                "next_run": job.next_run_time.isoformat() if job.next_run_time else None
            }
            for job in scheduler.get_jobs()
        ] if scheduler_started else []
    }


def calculate_next_crawl_time(source):
    """
    Calculate next crawl time for a source based on its schedule
    
    Args:
        source: Source object with schedule configuration
        
    Returns:
        datetime of next crawl or None
    """
    from datetime import datetime, timedelta
    
    if not source.is_active:
        return None
    
    now = datetime.utcnow()
    
    # Calculate interval based on frequency
    if source.crawl_frequency == 'hourly':
        interval = timedelta(hours=1)
    elif source.crawl_frequency == 'daily':
        interval = timedelta(days=1)
    elif source.crawl_frequency == 'weekly':
        interval = timedelta(weeks=1)
    else:
        interval = timedelta(hours=1)
    
    # If never crawled, next time is now
    if not source.last_crawled_at:
        return now
    
    # Calculate next time
    next_time = source.last_crawled_at + interval
    
    # If next time is in the past, return now
    if next_time < now:
        return now
    
    return next_time
