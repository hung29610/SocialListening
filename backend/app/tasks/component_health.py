"""Celery tasks that emit typed, broker-backed component evidence."""

from __future__ import annotations

from datetime import datetime, timezone
import json
import os
import socket

from app.services.component_health import BEAT_HEARTBEAT_KEY, _redis_client
from app.workers.celery_app import celery_app


@celery_app.task(name="app.tasks.component_health.record_beat_heartbeat")
def record_beat_heartbeat() -> dict[str, str | None]:
    """Record proof that Celery Beat enqueued its dedicated heartbeat schedule."""
    payload = {
        "component_type": "celery_beat_schedule",
        "schedule_source": "celery_beat",
        "consumer_instance_id": os.getenv("RENDER_INSTANCE_ID"),
        "consumer_hostname": socket.gethostname(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "software_version": os.getenv("RENDER_GIT_COMMIT") or os.getenv("GIT_COMMIT"),
    }
    _redis_client().set(BEAT_HEARTBEAT_KEY, json.dumps(payload), ex=300)
    return payload
