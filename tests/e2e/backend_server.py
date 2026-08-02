"""Isolated production-app boundary for authenticated Playwright tests."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"
sys.path.insert(0, str(BACKEND_ROOT))

required = ("DATABASE_URL", "REDIS_URL", "E2E_FIXTURE_KEY", "E2E_REDIS_PREFIX")
missing = [name for name in required if not os.getenv(name)]
if missing:
    raise RuntimeError(f"Missing isolated E2E configuration names: {', '.join(missing)}")

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("RUN_MIGRATIONS_ON_STARTUP", "false")
os.environ.setdefault("ENABLE_EMBEDDED_SCHEDULER", "false")
os.environ.setdefault("SCHEDULER_ENABLED", "false")
os.environ.setdefault("AUTO_DISCOVERY_ENABLED", "false")
os.environ.setdefault("SOCIAL_CRAWL_ENABLED", "false")
os.environ.setdefault("SEARCH_PROVIDER_ORDER", "rss")
os.environ.setdefault("REDIS_ENABLED", "true")
os.environ.setdefault("FRONTEND_URL", "http://127.0.0.1:3000")
os.environ.setdefault("TENANT_INTEGRITY_REQUIRE_READY", "true")

import redis  # noqa: E402
import uvicorn  # noqa: E402
from fastapi import Header, HTTPException  # noqa: E402
from fastapi.responses import HTMLResponse, Response  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app.core.database import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models.alert import Alert  # noqa: E402
from app.models.crawl import CrawlJob  # noqa: E402
from app.models.mention import AIAnalysis, Mention  # noqa: E402
from app.models.report import Report  # noqa: E402
from app.services import scan_service  # noqa: E402
from app.tasks.scan_pipeline import run_scan_pipeline  # noqa: E402


_memory_redelivery: dict[int, dict] = {}
_production_execute_scan = scan_service.execute_scan


def _execute_isolated_rss(job_id, project_id, keyword_texts, mode, max_results, _source_types=None):
    return _production_execute_scan(job_id, project_id, keyword_texts, mode, max_results, ["rss"])


def _fixture_analysis(_content: str, _title: str) -> dict:
    return {
        "status": "success", "sentiment": "negative", "risk_score": 95.0,
        "crisis_level": 5, "summary_vi": "Deterministic isolated E2E analysis",
        "suggested_action": "escalate", "responsible_department": "PR",
        "confidence_score": 0.99, "ai_provider": "e2e_fixture",
        "model_version": "deterministic-v1", "processing_time_ms": 1,
    }


def _run_pipeline_with_redelivery(job_id: int) -> None:
    first = run_scan_pipeline(job_id, analysis_fn=_fixture_analysis)
    second = run_scan_pipeline(job_id, analysis_fn=_fixture_analysis)
    result = {"first": first, "redelivery": second}
    if os.getenv("E2E_MEMORY_REDIS") == "true":
        _memory_redelivery[job_id] = result
        return
    client = redis.Redis.from_url(os.environ["REDIS_URL"], decode_responses=True)
    try:
        key = f"{os.environ['E2E_REDIS_PREFIX']}:pipeline:{job_id}"
        client.set(key, json.dumps(result), ex=900)
    finally:
        client.close()


# Keep the product RSS scan and transaction real. Only the external queue and
# provider boundary is deterministic here; real Celery redelivery is a separate CI gate.
scan_service.enqueue_scan_pipeline = _run_pipeline_with_redelivery
scan_service.execute_scan = _execute_isolated_rss


def _authorize_fixture(value: str | None) -> None:
    if value != os.environ["E2E_FIXTURE_KEY"]:
        raise HTTPException(status_code=404, detail="Not found")


@app.get("/_e2e/feed.xml", include_in_schema=False)
def fixture_feed() -> Response:
    xml = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Nope360 isolated fixture</title>
<link>http://127.0.0.1:8010/_e2e</link><description>Deterministic RSS fixture</description>
<item><guid>wave2c-e2e-risk-signal-v1</guid><title>e2e-risk-signal requires urgent response</title>
<link>http://127.0.0.1:8010/_e2e/article</link>
<description>e2e-risk-signal is a deterministic negative fixture.</description>
<pubDate>Sun, 02 Aug 2026 08:00:00 GMT</pubDate></item></channel></rss>"""
    return Response(content=xml, media_type="application/rss+xml")


@app.get("/_e2e/article", include_in_schema=False)
def fixture_article() -> HTMLResponse:
    return HTMLResponse("<h1>e2e-risk-signal requires urgent response</h1>")


@app.get("/_e2e/proof/{job_id}", include_in_schema=False)
def fixture_proof(job_id: int, x_e2e_fixture_key: str | None = Header(default=None)) -> dict:
    _authorize_fixture(x_e2e_fixture_key)
    db = SessionLocal()
    client = None if os.getenv("E2E_MEMORY_REDIS") == "true" else redis.Redis.from_url(os.environ["REDIS_URL"], decode_responses=True)
    try:
        job = db.get(CrawlJob, job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        mentions = db.execute(select(Mention).where(Mention.job_id == job_id)).scalars().all()
        mention_ids = [row.id for row in mentions]
        analyses = db.execute(select(AIAnalysis).where(AIAnalysis.mention_id.in_(mention_ids))).scalars().all() if mention_ids else []
        alerts = db.execute(select(Alert).where(Alert.mention_id.in_(mention_ids))).scalars().all() if mention_ids else []
        pipeline = dict((job.meta_data or {}).get("pipeline") or {})
        report = db.get(Report, pipeline.get("report_id")) if pipeline.get("report_id") else None
        if client is None:
            redelivery = _memory_redelivery.get(job_id, {})
        else:
            redis_key = f"{os.environ['E2E_REDIS_PREFIX']}:pipeline:{job_id}"
            redelivery = json.loads(client.get(redis_key) or "{}")
        return {
            "job": {"id": job.id, "organization_id": job.organization_id, "project_id": job.project_id},
            "pipeline_status": pipeline.get("status"),
            "mention_ids": mention_ids,
            "analysis_ids": [row.id for row in analyses],
            "alert_ids": [row.id for row in alerts],
            "report_ids": [report.id] if report else [],
            "counts": {"mentions": len(mentions), "analyses": len(analyses), "alerts": len(alerts), "reports": 1 if report else 0},
            "redelivery": redelivery,
        }
    finally:
        if client is not None:
            client.close()
        db.close()


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8010, log_level="warning")
