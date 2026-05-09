"""
Celery application for background tasks
"""
from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

# Create Celery app
celery_app = Celery(
    "social_listening",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.workers.tasks"]
)

# Configure Celery
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Ho_Chi_Minh",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 minutes
    task_soft_time_limit=25 * 60,  # 25 minutes
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
)

# Task routes
celery_app.conf.task_routes = {
    "app.workers.tasks.crawl_source": {"queue": "crawl"},
    "app.workers.tasks.analyze_mention": {"queue": "analysis"},
    "app.workers.tasks.send_alert": {"queue": "notifications"},
    "app.workers.tasks.generate_report": {"queue": "reports"},
}

# Celery Beat Schedule - Scheduled tasks
celery_app.conf.beat_schedule = {
    # Check overdue incidents every hour
    "check-overdue-incidents": {
        "task": "app.workers.tasks.check_overdue_incidents",
        "schedule": crontab(minute=0),  # Every hour at minute 0
    },
    # Run scheduled crawls - check every 15 minutes
    "run-scheduled-crawls": {
        "task": "app.workers.tasks.process_scheduled_crawls",
        "schedule": crontab(minute="*/15"),  # Every 15 minutes
    },
    # Daily summary report at 8 AM
    "daily-summary-report": {
        "task": "app.workers.tasks.generate_daily_summary",
        "schedule": crontab(hour=8, minute=0),  # 8:00 AM daily
    },
    # Weekly report on Monday at 9 AM
    "weekly-report": {
        "task": "app.workers.tasks.generate_weekly_report",
        "schedule": crontab(hour=9, minute=0, day_of_week=1),  # Monday 9:00 AM
    },
}
