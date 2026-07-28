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
    include=["app.tasks.scan_pipeline"]
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
    "app.tasks.scan_pipeline.process_scan_pipeline": {"queue": "analysis"},
    "app.tasks.scan_pipeline.reconcile_scan_pipelines": {"queue": "analysis"},
}

# Celery Beat Schedule - Scheduled tasks
celery_app.conf.beat_schedule = {
    "reconcile-scan-pipelines": {
        "task": "app.tasks.scan_pipeline.reconcile_scan_pipelines",
        "schedule": crontab(minute="*/5"),
    },
}
