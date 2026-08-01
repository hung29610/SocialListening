from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

import redis

from app.api.system import get_worker_status
from app.services import component_health
from app.workers.celery_app import celery_app


NOW = datetime(2026, 8, 1, 12, 0, tzinfo=timezone.utc)
ALL_QUEUES = ["analysis", "crawl", "notifications", "reports", "celery"]


class FakeRedis:
    def __init__(self, values=None):
        self.values = values or {}
        self.writes = {}

    def ping(self):
        return True

    def get(self, key):
        return self.values.get(key)

    def set(self, key, value, **kwargs):
        self.writes[key] = (value, kwargs)
        return True


class FakeInspect:
    def __init__(self, queues=None):
        self.queues = queues

    def ping(self):
        if self.queues is None:
            return None
        return {"worker@node-a": {"ok": "pong"}}

    def active_queues(self):
        if self.queues is None:
            return None
        return {"worker@node-a": [{"name": queue} for queue in self.queues]}


def _db(jobs=None):
    result = MagicMock()
    result.scalars.return_value.all.return_value = jobs or []
    db = MagicMock()
    db.execute.return_value = result
    return db


def _collect(monkeypatch, *, queues=None, redis_values=None, jobs=None):
    fake_redis = FakeRedis(redis_values)
    monkeypatch.setattr(component_health, "_redis_client", lambda: fake_redis)
    monkeypatch.setattr(
        celery_app.control,
        "inspect",
        lambda timeout: FakeInspect(queues),
    )
    return component_health.collect_component_health(_db(jobs), now=NOW)


def test_embedded_web_scheduler_never_makes_celery_online(monkeypatch):
    from app.services import scheduler_service

    monkeypatch.setenv("ENABLE_EMBEDDED_SCHEDULER", "true")
    monkeypatch.setattr(scheduler_service, "scheduler_started", True)
    monkeypatch.setattr(scheduler_service, "_is_embedded_mode", True)

    health = _collect(monkeypatch, queues=None)

    assert health["embedded_scheduler"]["status"] == "online"
    assert health["celery_worker"]["status"] == "offline"
    assert health["overall"]["status"] == "offline"


def test_fresh_celery_ping_is_online_and_exposes_queues(monkeypatch):
    beat = json.dumps({"timestamp": NOW.isoformat(), "software_version": "abc123"})
    health = _collect(
        monkeypatch,
        queues=ALL_QUEUES,
        redis_values={component_health.BEAT_HEARTBEAT_KEY: beat},
    )

    assert health["celery_worker"]["status"] == "online"
    assert health["celery_worker"]["queues"] == sorted(ALL_QUEUES)
    assert health["celery_worker"]["instances"][0]["instance_id"] == "worker@node-a"


def test_stale_worker_observation_is_not_online(monkeypatch):
    stale = json.dumps(
        {
            "timestamp": (NOW - timedelta(minutes=10)).isoformat(),
            "queues": ALL_QUEUES,
            "instances": [{"instance_id": "worker@old", "queues": ALL_QUEUES}],
        }
    )
    health = _collect(
        monkeypatch,
        queues=None,
        redis_values={component_health.WORKER_OBSERVATION_KEY: stale},
    )

    assert health["celery_worker"]["status"] == "stale"
    assert health["overall"]["status"] == "offline"


def test_worker_on_wrong_queue_is_degraded(monkeypatch):
    health = _collect(monkeypatch, queues=["celery"])

    assert health["celery_worker"]["status"] == "degraded"
    assert "analysis" in health["celery_worker"]["missing_queues"]
    assert health["overall"]["status"] == "degraded"


def test_broker_unreachable_is_distinct_from_worker_absence(monkeypatch):
    def unavailable():
        raise redis.ConnectionError("test broker unavailable")

    monkeypatch.setattr(component_health, "_redis_client", unavailable)
    health = component_health.collect_component_health(_db(), now=NOW)

    assert health["broker"]["status"] == "unreachable"
    assert health["celery_worker"]["status"] == "unknown"
    assert health["celery_worker"]["reason"] == "broker_unreachable"


def test_beat_absent_while_worker_online_is_degraded(monkeypatch):
    health = _collect(monkeypatch, queues=ALL_QUEUES)

    assert health["celery_worker"]["status"] == "online"
    assert health["celery_beat"]["status"] == "offline"
    assert health["overall"]["status"] == "degraded"


def test_beat_present_and_one_reconciliation_schedule(monkeypatch):
    beat = json.dumps({"timestamp": NOW.isoformat()})
    health = _collect(
        monkeypatch,
        queues=ALL_QUEUES,
        redis_values={component_health.BEAT_HEARTBEAT_KEY: beat},
    )
    reconcile_entries = [
        entry
        for entry in celery_app.conf.beat_schedule.values()
        if entry["task"] == "app.tasks.scan_pipeline.reconcile_scan_pipelines"
    ]

    assert health["celery_beat"]["status"] == "online"
    assert len(reconcile_entries) == 1


def test_pipeline_exposes_stale_queue_and_no_recent_success(monkeypatch):
    job = SimpleNamespace(
        meta_data={
            "pipeline": {
                "status": "queued",
                "queued_at": (NOW - timedelta(minutes=10)).isoformat(),
            }
        },
        created_at=NOW - timedelta(minutes=10),
        completed_at=NOW - timedelta(minutes=10),
    )

    health = _collect(monkeypatch, queues=ALL_QUEUES, jobs=[job])

    assert health["pipeline"] == {
        "status": "no_recent_success",
        "last_success_at": None,
        "queued_count": 1,
        "stale_count": 1,
    }
    assert health["overall"]["status"] == "degraded"


def test_embedded_scheduler_fails_closed_when_singleton_lock_is_held(monkeypatch):
    from app.services import scheduler_service

    lock = MagicMock()
    lock.acquire.return_value = False
    client = MagicMock()
    client.lock.return_value = lock
    monkeypatch.setattr(scheduler_service.redis.Redis, "from_url", lambda *args, **kwargs: client)
    monkeypatch.setattr(scheduler_service, "scheduler_started", False)
    monkeypatch.setattr(scheduler_service, "_embedded_scheduler_lock", None)

    assert scheduler_service.start_scheduler(is_embedded=True) is False
    assert scheduler_service._embedded_scheduler_lock is None


def test_production_render_disables_embedded_scheduling_and_frontend_is_truthful():
    root = Path(__file__).resolve().parents[2]
    render_yaml = (root / "backend" / "render.yaml").read_text(encoding="utf-8")
    main_source = (root / "backend" / "app" / "main.py").read_text(encoding="utf-8")
    scan_source = (root / "frontend" / "src" / "app" / "dashboard" / "scan" / "page.tsx").read_text(encoding="utf-8")
    layout_source = (root / "frontend" / "src" / "app" / "dashboard" / "layout.tsx").read_text(encoding="utf-8")

    assert 'key: ENABLE_EMBEDDED_SCHEDULER\n        value: "false"' in render_yaml
    assert render_yaml.count("runtime: python") == 3
    assert render_yaml.count("region: singapore") == 3
    assert render_yaml.count("rootDir: backend") == 3
    assert render_yaml.count("numInstances: 1") == 3
    assert 'os.getenv("SCHEDULER_ENABLED", "true")' not in main_source
    assert "SYS.WORKER // ONLINE" not in scan_source
    assert "status.celery_worker.status" in layout_source


def test_system_api_returns_explicit_component_contract(monkeypatch):
    expected = _collect(monkeypatch, queues=ALL_QUEUES)
    monkeypatch.setattr("app.api.system.collect_component_health", lambda db: expected)

    response = get_worker_status(db=_db(), current_user=SimpleNamespace(id=1))

    assert set(response) == {
        "web",
        "broker",
        "celery_worker",
        "celery_beat",
        "embedded_scheduler",
        "pipeline",
        "overall",
    }
