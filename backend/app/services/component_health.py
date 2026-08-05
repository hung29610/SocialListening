"""Truthful, component-specific health evidence for the worker pipeline.

Celery worker identity comes only from Celery inspect/ping.  APScheduler state
is reported separately and can never make a Celery worker appear online.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
import os
from typing import Any
from urllib.parse import urlsplit

import redis
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.crawl import CrawlJob
from app.workers.celery_app import celery_app


BEAT_HEARTBEAT_KEY = "nope360:health:celery-beat"
WORKER_OBSERVATION_KEY = "nope360:health:celery-worker-observation"
EXPECTED_QUEUES = tuple(
    queue.strip()
    for queue in os.getenv(
        "CELERY_EXPECTED_QUEUES", "analysis,crawl,notifications,reports,celery"
    ).split(",")
    if queue.strip()
)
INSPECT_TIMEOUT_SECONDS = float(os.getenv("CELERY_INSPECT_TIMEOUT_SECONDS", "1.0"))
BEAT_STALE_SECONDS = int(os.getenv("CELERY_BEAT_STALE_SECONDS", "150"))
WORKER_STALE_SECONDS = int(os.getenv("CELERY_WORKER_STALE_SECONDS", "120"))
PIPELINE_STALE_SECONDS = int(os.getenv("PIPELINE_STALE_SECONDS", "300"))
PIPELINE_SUCCESS_STALE_SECONDS = int(
    os.getenv("PIPELINE_SUCCESS_STALE_SECONDS", str(24 * 60 * 60))
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _parse_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        parsed = value
    elif value:
        try:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            return None
    else:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _software_version() -> str | None:
    return (
        os.getenv("RENDER_GIT_COMMIT")
        or os.getenv("GIT_COMMIT")
        or os.getenv("APP_VERSION")
        or None
    )


def _broker_identity() -> str:
    parsed = urlsplit(settings.REDIS_URL)
    host = parsed.hostname or "unknown-host"
    port = f":{parsed.port}" if parsed.port else ""
    database = parsed.path.lstrip("/") or "0"
    return f"{parsed.scheme or 'redis'}://{host}{port}/{database}"


def _redis_client() -> redis.Redis:
    timeout = max(0.1, INSPECT_TIMEOUT_SECONDS)
    return redis.Redis.from_url(
        settings.REDIS_URL,
        socket_connect_timeout=timeout,
        socket_timeout=timeout,
        decode_responses=True,
    )


def _pipeline_health(db: Session, now: datetime) -> dict[str, Any]:
    jobs = db.execute(
        select(CrawlJob).order_by(CrawlJob.created_at.desc()).limit(1000)
    ).scalars().all()
    queued_count = 0
    stale_count = 0
    last_success_at: datetime | None = None

    for job in jobs:
        pipeline = dict((job.meta_data or {}).get("pipeline") or {})
        status = pipeline.get("status")
        if status == "completed":
            completed_at = _parse_datetime(pipeline.get("completed_at")) or _parse_datetime(
                job.completed_at
            )
            if completed_at and (last_success_at is None or completed_at > last_success_at):
                last_success_at = completed_at
        if status not in {"queued", "running", "retrying", "enqueue_failed"}:
            continue
        queued_count += 1
        reference = (
            _parse_datetime(pipeline.get("lease_expires_at"))
            if status == "running"
            else _parse_datetime(pipeline.get("next_retry_at"))
            if status == "retrying"
            else _parse_datetime(pipeline.get("queued_at"))
            or _parse_datetime(pipeline.get("last_failed_at"))
            or _parse_datetime(job.completed_at)
        )
        if reference is None or reference <= now - timedelta(seconds=PIPELINE_STALE_SECONDS):
            stale_count += 1

    if last_success_at is None:
        status = "no_recent_success"
    elif last_success_at <= now - timedelta(seconds=PIPELINE_SUCCESS_STALE_SECONDS):
        status = "stale"
    elif stale_count:
        status = "degraded"
    else:
        status = "healthy"
    return {
        "status": status,
        "last_success_at": last_success_at.isoformat() if last_success_at else None,
        "queued_count": queued_count,
        "stale_count": stale_count,
    }


def collect_component_health(db: Session, now: datetime | None = None) -> dict[str, Any]:
    now = now or _utcnow()
    observed_at = now.isoformat()
    broker_status = "online"
    broker_error = None
    beat_payload: dict[str, Any] | None = None
    worker_observation: dict[str, Any] | None = None

    try:
        client = _redis_client()
        client.ping()
        raw_beat = client.get(BEAT_HEARTBEAT_KEY)
        if raw_beat:
            try:
                beat_payload = json.loads(raw_beat)
            except json.JSONDecodeError:
                beat_payload = {"invalid": True}
        raw_worker = client.get(WORKER_OBSERVATION_KEY)
        if raw_worker:
            try:
                worker_observation = json.loads(raw_worker)
            except json.JSONDecodeError:
                worker_observation = None
    except (redis.RedisError, ValueError) as exc:
        broker_status = "unreachable"
        broker_error = type(exc).__name__

    workers: list[dict[str, Any]] = []
    worker_status = "unknown" if broker_status == "unreachable" else "offline"
    worker_reason = "broker_unreachable" if broker_status == "unreachable" else "no_ping_response"
    queues: list[str] = []
    if broker_status == "online":
        try:
            inspector = celery_app.control.inspect(timeout=INSPECT_TIMEOUT_SECONDS)
            ping = inspector.ping() or {}
            active_queues = inspector.active_queues() or {}
            for worker_id in sorted(ping):
                worker_queues = sorted(
                    {
                        queue.get("name")
                        for queue in (active_queues.get(worker_id) or [])
                        if queue.get("name")
                    }
                )
                queues.extend(worker_queues)
                workers.append(
                    {
                        "instance_id": worker_id,
                        "hostname": worker_id.split("@", 1)[-1] if "@" in worker_id else None,
                        "queues": worker_queues,
                    }
                )
            queues = sorted(set(queues))
            if workers:
                missing = sorted(set(EXPECTED_QUEUES) - set(queues))
                if missing:
                    worker_status = "degraded"
                    worker_reason = "wrong_queue"
                else:
                    worker_status = "online"
                    worker_reason = None
                client.set(
                    WORKER_OBSERVATION_KEY,
                    json.dumps(
                        {
                            "timestamp": observed_at,
                            "queues": queues,
                            "instances": workers,
                            "software_version": _software_version(),
                        }
                    ),
                    ex=24 * 60 * 60,
                )
            else:
                missing = list(EXPECTED_QUEUES)
        except Exception as exc:  # Celery may wrap transport exceptions by backend.
            worker_status = "offline"
            worker_reason = f"inspect_{type(exc).__name__}"
            missing = list(EXPECTED_QUEUES)
    else:
        missing = list(EXPECTED_QUEUES)

    worker_last_heartbeat = observed_at if workers else None
    if not workers and worker_observation:
        cached_at = _parse_datetime(worker_observation.get("timestamp"))
        worker_last_heartbeat = cached_at.isoformat() if cached_at else None
        if broker_status == "online" and cached_at and cached_at <= now - timedelta(
            seconds=WORKER_STALE_SECONDS
        ):
            worker_status = "stale"
            worker_reason = "last_inspect_observation_stale"
            queues = list(worker_observation.get("queues") or [])
            missing = sorted(set(EXPECTED_QUEUES) - set(queues))

    beat_heartbeat = _parse_datetime((beat_payload or {}).get("timestamp"))
    if broker_status == "unreachable":
        beat_status = "unknown"
        beat_reason = "broker_unreachable"
    elif (beat_payload or {}).get("invalid"):
        beat_status = "offline"
        beat_reason = "heartbeat_invalid"
    elif beat_heartbeat is None:
        beat_status = "offline"
        beat_reason = "heartbeat_absent"
    elif beat_heartbeat <= now - timedelta(seconds=BEAT_STALE_SECONDS):
        beat_status = "stale"
        beat_reason = "heartbeat_stale"
    else:
        beat_status = "online"
        beat_reason = None

    try:
        from app.services import scheduler_service

        embedded_running = bool(scheduler_service.scheduler_started and scheduler_service._is_embedded_mode)
    except ImportError:
        embedded_running = False
    free_mvp_embedded = os.getenv("FREE_MVP_RUNTIME_MODE", "").lower() == "embedded"
    embedded_configured = free_mvp_embedded or os.getenv("ENABLE_EMBEDDED_SCHEDULER", "false").lower() == "true"
    embedded_status = "online" if embedded_running else "offline" if embedded_configured else "disabled"

    try:
        pipeline = _pipeline_health(db, now)
    except Exception:
        db.rollback()
        pipeline = {
            "status": "unknown",
            "last_success_at": None,
            "queued_count": 0,
            "stale_count": 0,
        }
    if broker_status == "unreachable" or worker_status in {"offline", "unknown", "stale"}:
        overall_status = "offline"
    elif worker_status != "online" or beat_status != "online" or pipeline["status"] != "healthy":
        overall_status = "degraded"
    else:
        overall_status = "healthy"

    return {
        "web": {"status": "online", "observed_at": observed_at},
        "broker": {
            "status": broker_status,
            "identity": _broker_identity(),
            "error_type": broker_error,
        },
        "celery_worker": {
            "status": worker_status,
            "reason": worker_reason,
            "last_heartbeat_at": worker_last_heartbeat,
            "queues": queues,
            "expected_queues": list(EXPECTED_QUEUES),
            "missing_queues": missing,
            "instances": workers,
            "software_version": _software_version(),
            "last_successful_task_at": pipeline["last_success_at"],
        },
        "celery_beat": {
            "status": beat_status,
            "reason": beat_reason,
            "last_heartbeat_at": beat_heartbeat.isoformat() if beat_heartbeat else None,
            "schedule_evidence": "beat-enqueued-heartbeat-task",
            "software_version": (beat_payload or {}).get("software_version"),
        },
        "embedded_scheduler": {
            "status": embedded_status,
            "label": "free_mvp_embedded" if free_mvp_embedded else "embedded_web_scheduler",
            "explicitly_enabled": embedded_configured,
        },
        "runtime": {
            "mode": "free_mvp_embedded" if free_mvp_embedded else "standard",
            "label": "Free MVP / embedded mode" if free_mvp_embedded else "Standard runtime",
            "reliability": "reduced_web_process_lifecycle" if free_mvp_embedded else "standard",
            "celery_durability_claimed": False if free_mvp_embedded else worker_status == "online",
        },
        "pipeline": pipeline,
        "overall": {"status": overall_status, "observed_at": observed_at},
    }
