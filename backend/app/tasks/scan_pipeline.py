"""Durable, leased scan -> analysis -> alert -> report orchestration.

The crawl job's JSON metadata is the state record. Database transactions are
kept short: a task acquires a bounded lease, releases the transaction before
calling an external AI provider, and opens a fresh transaction to atomically
finalize idempotent downstream rows.
"""

# Runtime release contract: startup-state-machine-v1.

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import logging
from typing import Callable
from uuid import uuid4

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.alert import Alert, AlertSeverity, AlertStatus
from app.models.crawl import CrawlJob, CrawlJobStatus
from app.models.mention import AIAnalysis, Mention, SentimentScore
from app.models.report import Report, ReportStatus, ReportType
from app.core.ownership import direct_scope_predicates
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)

MAX_PIPELINE_ATTEMPTS = 6
PIPELINE_LEASE_SECONDS = 180
STALE_QUEUE_SECONDS = 300
RECONCILE_BATCH_SIZE = 100
MAX_RETRY_DELAY_SECONDS = 300
RECOVERABLE_PIPELINE_STATUSES = {"queued", "running", "retrying", "enqueue_failed"}
TERMINAL_PIPELINE_STATUSES = {"completed", "failed"}
STAGE_NAMES = ("scan", "mention", "analysis", "alert", "report")


class PipelineLeaseLost(RuntimeError):
    """Another worker owns the current durable lease."""


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _parse_timestamp(value) -> datetime | None:
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


def _value(value):
    return value.value if hasattr(value, "value") else value


def _pipeline(job: CrawlJob) -> dict:
    return dict((job.meta_data or {}).get("pipeline") or {})


def _stages(pipeline: dict) -> dict:
    stages = {name: dict((pipeline.get("stages") or {}).get(name) or {}) for name in STAGE_NAMES}
    pipeline["stages"] = stages
    return stages


def _save_pipeline(job: CrawlJob, pipeline: dict) -> None:
    """Assign a fresh JSON object so SQLAlchemy always persists transitions."""
    meta = dict(job.meta_data or {})
    meta["pipeline"] = dict(pipeline)
    job.meta_data = meta


def _retry_delay(attempts: int) -> int:
    return min(MAX_RETRY_DELAY_SECONDS, 5 * (2 ** max(0, attempts - 1)))


def _mark_terminal_failure(pipeline: dict, now: datetime, error: str) -> None:
    stages = _stages(pipeline)
    pipeline.update(
        {
            "status": "failed",
            "failed_at": now.isoformat(),
            "dead_lettered_at": now.isoformat(),
            "last_error": error[:500],
            "lease_token": None,
            "lease_expires_at": None,
            "next_retry_at": None,
        }
    )
    stages["analysis"].update({"status": "failed", "failed_at": now.isoformat()})
    for stage_name in ("alert", "report"):
        if stages[stage_name].get("status") != "completed":
            stages[stage_name].update(
                {"status": "blocked", "blocked_at": now.isoformat(), "blocked_by": "analysis"}
            )


def _analysis_for(mention: Mention, result: dict) -> AIAnalysis:
    return AIAnalysis(
        mention_id=mention.id,
        sentiment=_value(result.get("sentiment", SentimentScore.NEUTRAL)),
        risk_score=float(result.get("risk_score", 0)),
        crisis_level=int(result.get("crisis_level", 1)),
        summary_vi=result.get("summary_vi", ""),
        suggested_action=result.get("suggested_action", "monitor"),
        responsible_department=result.get("responsible_department", ""),
        confidence_score=float(result.get("confidence_score", 0)),
        reasoning="Status: " + str(result.get("status", "success")),
        ai_provider=result.get("ai_provider", "unknown"),
        model_version=result.get("model_version", "unknown"),
        processing_time_ms=int(result.get("processing_time_ms", 0) or 0),
    )


def _alert_severity(analysis: AIAnalysis) -> AlertSeverity:
    if analysis.crisis_level >= 5 or analysis.risk_score >= 90:
        return AlertSeverity.CRITICAL
    if analysis.crisis_level >= 4 or analysis.risk_score >= 70:
        return AlertSeverity.HIGH
    if analysis.risk_score >= 50:
        return AlertSeverity.MEDIUM
    return AlertSeverity.LOW


def _should_alert(analysis: AIAnalysis, threshold: float) -> bool:
    return (
        analysis.risk_score >= threshold
        or analysis.crisis_level >= 4
        or _value(analysis.sentiment) == SentimentScore.NEGATIVE.value
    )


def _acquire_pipeline_lease(job_id: int, now: datetime) -> dict:
    """Acquire a short durable lease and commit before any provider call."""
    db = SessionLocal()
    try:
        job = db.execute(
            select(CrawlJob).where(CrawlJob.id == job_id).with_for_update()
        ).scalar_one_or_none()
        if not job:
            return {"status": "missing", "job_id": job_id}
        if not job.organization_id or not job.user_id or not job.project_id:
            # Legacy ownerless jobs are quarantine candidates. A worker must
            # never adopt or mutate them without deterministic tenant scope.
            return {"status": "tenant_scope_blocked", "job_id": job_id}

        pipeline = _pipeline(job)
        status = pipeline.get("status", "queued")
        if status in TERMINAL_PIPELINE_STATUSES:
            return {"status": status, "job_id": job_id}

        lease_expires_at = _parse_timestamp(pipeline.get("lease_expires_at"))
        if status == "running" and lease_expires_at and lease_expires_at > now:
            return {"status": "leased", "job_id": job_id}

        attempts = int(pipeline.get("attempts", 0))
        if attempts >= MAX_PIPELINE_ATTEMPTS:
            _mark_terminal_failure(pipeline, now, pipeline.get("last_error") or "retry budget exhausted")
            _save_pipeline(job, pipeline)
            db.commit()
            return {"status": "failed", "job_id": job_id}

        attempts += 1
        lease_token = uuid4().hex
        stages = _stages(pipeline)
        stages["analysis"].update(
            {
                "status": "running",
                "started_at": stages["analysis"].get("started_at") or now.isoformat(),
                "last_attempt_at": now.isoformat(),
            }
        )
        pipeline.update(
            {
                "status": "running",
                "started_at": pipeline.get("started_at") or now.isoformat(),
                "last_attempt_at": now.isoformat(),
                "attempts": attempts,
                "lease_token": lease_token,
                "lease_acquired_at": now.isoformat(),
                "lease_expires_at": (
                    now + timedelta(seconds=PIPELINE_LEASE_SECONDS)
                ).isoformat(),
                "next_retry_at": None,
            }
        )
        _save_pipeline(job, pipeline)
        db.commit()
        return {
            "status": "acquired",
            "job_id": job_id,
            "lease_token": lease_token,
            "attempts": attempts,
        }
    finally:
        db.close()


def _load_analysis_work(job_id: int) -> tuple[list[Mention], set[int]]:
    """Read and detach work items; closing this session ends its transaction."""
    db = SessionLocal()
    try:
        mentions = db.execute(
            select(Mention)
            .where(Mention.job_id == job_id, *direct_scope_predicates(Mention))
            .order_by(Mention.id)
        ).scalars().all()
        mention_ids = [mention.id for mention in mentions]
        analyzed_ids = set()
        if mention_ids:
            analyzed_ids = set(
                db.execute(
                    select(AIAnalysis.mention_id).where(AIAnalysis.mention_id.in_(mention_ids))
                ).scalars().all()
            )
        db.expunge_all()
        return mentions, analyzed_ids
    finally:
        db.close()


def _record_pipeline_failure(
    job_id: int,
    lease_token: str,
    exc: Exception,
    now: datetime,
) -> str:
    db = SessionLocal()
    try:
        job = db.execute(
            select(CrawlJob).where(CrawlJob.id == job_id).with_for_update()
        ).scalar_one_or_none()
        if not job:
            return "missing"
        pipeline = _pipeline(job)
        if pipeline.get("lease_token") != lease_token:
            return pipeline.get("status", "lease_lost")

        attempts = int(pipeline.get("attempts", 0))
        error = str(exc)
        stages = _stages(pipeline)
        if attempts >= MAX_PIPELINE_ATTEMPTS:
            _mark_terminal_failure(pipeline, now, error)
        else:
            next_retry_at = now + timedelta(seconds=_retry_delay(attempts))
            pipeline.update(
                {
                    "status": "retrying",
                    "last_error": error[:500],
                    "last_failed_at": now.isoformat(),
                    "next_retry_at": next_retry_at.isoformat(),
                    "lease_token": None,
                    "lease_expires_at": None,
                }
            )
            stages["analysis"].update(
                {
                    "status": "retrying",
                    "last_failed_at": now.isoformat(),
                    "next_retry_at": next_retry_at.isoformat(),
                }
            )
            for stage_name in ("alert", "report"):
                if stages[stage_name].get("status") != "completed":
                    stages[stage_name]["status"] = "blocked"
                    stages[stage_name]["blocked_by"] = "analysis"
                    stages[stage_name]["blocked_at"] = now.isoformat()
        _save_pipeline(job, pipeline)
        db.commit()
        return pipeline["status"]
    finally:
        db.close()


def _finalize_pipeline(
    job_id: int,
    lease_token: str,
    analysis_results: dict[int, dict],
    now: datetime,
) -> dict:
    """Atomically create downstream rows after re-validating the lease."""
    db = SessionLocal()
    try:
        job = db.execute(
            select(CrawlJob).where(CrawlJob.id == job_id).with_for_update()
        ).scalar_one_or_none()
        if not job:
            return {"success": False, "reason": "job_not_found", "job_id": job_id}
        from app.core.ownership import validate_explicit_scope
        validate_explicit_scope(db, job.organization_id, job.user_id, job.project_id)
        pipeline = _pipeline(job)
        if pipeline.get("status") == "completed":
            return {"success": True, "idempotent": True, "job_id": job_id}
        if pipeline.get("lease_token") != lease_token:
            raise PipelineLeaseLost(f"pipeline lease lost for job {job_id}")

        mentions = db.execute(
            select(Mention)
            .where(Mention.job_id == job_id, *direct_scope_predicates(Mention))
            .order_by(Mention.id)
        ).scalars().all()
        threshold = float((job.meta_data or {}).get("alert_threshold", 70))
        analyses_created = 0
        alert_ids: list[int] = []

        for mention in mentions:
            from app.core.ownership import resolve_mention_scope
            mention_scope = resolve_mention_scope(
                db, mention.id, expected_organization_id=job.organization_id
            )
            if mention_scope.project_id != job.project_id:
                raise RuntimeError("Pipeline mention belongs to a different project")
            analysis = db.execute(
                select(AIAnalysis).where(AIAnalysis.mention_id == mention.id)
            ).scalar_one_or_none()
            if analysis is None:
                result = analysis_results.get(mention.id)
                if result is None:
                    raise RuntimeError(f"analysis payload missing for mention {mention.id}")
                analysis = _analysis_for(mention, result)
                db.add(analysis)
                db.flush()
                analyses_created += 1

            if _should_alert(analysis, threshold):
                # The CrawlJob row lock serializes all pipeline deliveries.
                # Re-query in this final transaction before creating the row.
                alert = db.execute(
                    select(Alert)
                    .where(Alert.mention_id == mention.id)
                    .order_by(Alert.id.asc())
                    .limit(1)
                ).scalar_one_or_none()
                if alert is None:
                    alert = Alert(
                        organization_id=mention.organization_id,
                        project_id=mention.project_id,
                        user_id=mention.user_id,
                        mention_id=mention.id,
                        severity=_alert_severity(analysis),
                        status=AlertStatus.NEW,
                        title=f"High-risk mention: {(mention.title or 'untitled')[:100]}",
                        message=(
                            f"Risk score: {analysis.risk_score}, crisis level: "
                            f"{analysis.crisis_level}\n{analysis.summary_vi or ''}"
                        ),
                        notification_channels="dashboard",
                    )
                    db.add(alert)
                    db.flush()
                alert_ids.append(alert.id)

        report_id = pipeline.get("report_id")
        report = db.get(Report, report_id) if report_id else None
        if report is None:
            stable_title = f"Scan pipeline report #{job.id}"
            report = db.execute(
                select(Report).where(
                    Report.project_id == job.project_id,
                    Report.title == stable_title,
                ).order_by(Report.id.asc()).limit(1)
            ).scalar_one_or_none()
            if report is None:
                report = Report(
                    organization_id=job.organization_id,
                    project_id=job.project_id,
                    report_type=ReportType.CUSTOM,
                    title=stable_title,
                    description="Automatically generated scan analysis summary.",
                    start_date=job.started_at or now,
                    end_date=now,
                    status=ReportStatus.COMPLETED,
                    data={
                        "crawl_job_id": job.id,
                        "mentions": len(mentions),
                        "analyses": len(mentions),
                        "alerts": len(alert_ids),
                    },
                    generated_by=job.user_id,
                    completed_at=now,
                )
                db.add(report)
                db.flush()

        stages = _stages(pipeline)
        stages["analysis"].update(
            {"status": "completed", "completed_at": now.isoformat(), "count": len(mentions)}
        )
        stages["alert"].update(
            {"status": "completed", "completed_at": now.isoformat(), "count": len(alert_ids)}
        )
        stages["report"].update(
            {"status": "completed", "completed_at": now.isoformat(), "report_id": report.id}
        )
        pipeline.update(
            {
                "status": "completed",
                "completed_at": now.isoformat(),
                "mention_count": len(mentions),
                "analysis_count": len(mentions),
                "alert_count": len(alert_ids),
                "report_id": report.id,
                "last_error": None,
                "lease_token": None,
                "lease_expires_at": None,
                "next_retry_at": None,
            }
        )
        _save_pipeline(job, pipeline)
        db.commit()
        return {
            "success": True,
            "job_id": job_id,
            "mentions": len(mentions),
            "analyses_created": analyses_created,
            "alerts_created": len(alert_ids),
            "report_id": report.id,
        }
    finally:
        db.close()


def run_scan_pipeline(
    job_id: int,
    analysis_fn: Callable | None = None,
    *,
    now_fn: Callable[[], datetime] = _utcnow,
) -> dict:
    """Run one delivery without holding a DB transaction over provider calls."""
    if analysis_fn is None:
        from app.services.ai_service import analyze_mention

        analysis_fn = analyze_mention

    now = now_fn()
    lease = _acquire_pipeline_lease(job_id, now)
    if lease["status"] == "completed":
        return {"success": True, "idempotent": True, "job_id": job_id}
    if lease["status"] in {"failed", "missing", "leased"}:
        return {
            "success": lease["status"] == "leased",
            "reason": lease["status"],
            "job_id": job_id,
        }

    lease_token = lease["lease_token"]
    try:
        mentions, analyzed_ids = _load_analysis_work(job_id)
        analysis_results: dict[int, dict] = {}
        for mention in mentions:
            if mention.id in analyzed_ids:
                continue
            result = analysis_fn(
                mention.content or mention.snippet or "",
                mention.title or "",
            )
            if not result or result.get("status") in {
                "error",
                "failed",
                "provider_error",
            }:
                raise RuntimeError(
                    f"AI analysis was not successful for mention {mention.id}: "
                    f"{(result or {}).get('status', 'empty_result')}"
                )
            analysis_results[mention.id] = result
        return _finalize_pipeline(job_id, lease_token, analysis_results, now_fn())
    except Exception as exc:
        _record_pipeline_failure(job_id, lease_token, exc, now_fn())
        raise


def _is_stale(job: CrawlJob, pipeline: dict, now: datetime) -> bool:
    status = pipeline.get("status")
    if status in {"queued", "enqueue_failed"}:
        reference = (
            _parse_timestamp(pipeline.get("queued_at"))
            or _parse_timestamp(pipeline.get("last_failed_at"))
            or _parse_timestamp(job.completed_at)
        )
        return reference is not None and reference <= now - timedelta(seconds=STALE_QUEUE_SECONDS)
    if status == "running":
        lease_expires = _parse_timestamp(pipeline.get("lease_expires_at"))
        return lease_expires is None or lease_expires <= now
    if status == "retrying":
        next_retry = _parse_timestamp(pipeline.get("next_retry_at"))
        return next_retry is None or next_retry <= now
    return False


def reconcile_stale_scan_pipelines(
    *,
    now: datetime | None = None,
    enqueue_fn: Callable[[int], object] | None = None,
) -> dict:
    """Bounded stale-only reconciliation; broker calls happen after DB commit."""
    now = now or _utcnow()
    enqueue_fn = enqueue_fn or (lambda job_id: process_scan_pipeline.delay(job_id))
    db = SessionLocal()
    stale_ids: list[int] = []
    failed = 0
    examined = 0
    try:
        status_expr = CrawlJob.meta_data["pipeline"]["status"].as_string()
        jobs = db.execute(
            select(CrawlJob)
            .where(
                status_expr.in_(RECOVERABLE_PIPELINE_STATUSES),
                *direct_scope_predicates(CrawlJob),
            )
            .order_by(CrawlJob.completed_at.asc(), CrawlJob.id.asc())
            .limit(RECONCILE_BATCH_SIZE)
            .with_for_update(skip_locked=True)
        ).scalars().all()
        examined = len(jobs)
        for job in jobs:
            pipeline = _pipeline(job)
            if not _is_stale(job, pipeline, now):
                continue
            if int(pipeline.get("attempts", 0)) >= MAX_PIPELINE_ATTEMPTS:
                _mark_terminal_failure(
                    pipeline,
                    now,
                    pipeline.get("last_error") or "retry budget exhausted during reconciliation",
                )
                _save_pipeline(job, pipeline)
                failed += 1
                continue
            pipeline.update(
                {
                    "status": "queued",
                    "reconciled_at": now.isoformat(),
                    "queued_at": now.isoformat(),
                    "lease_token": None,
                    "lease_expires_at": None,
                }
            )
            stages = _stages(pipeline)
            stages["analysis"].update(
                {"status": "queued", "queued_at": now.isoformat()}
            )
            _save_pipeline(job, pipeline)
            stale_ids.append(job.id)
        db.commit()
    finally:
        db.close()

    queued = 0
    for job_id in stale_ids:
        try:
            enqueue_fn(job_id)
            queued += 1
        except Exception as exc:
            logger.exception("PIPELINE_RECONCILE_ENQUEUE_FAILED job_id=%s", job_id)
            failure_db = SessionLocal()
            try:
                job = failure_db.get(CrawlJob, job_id)
                if job:
                    pipeline = _pipeline(job)
                    pipeline.update(
                        {
                            "status": "enqueue_failed",
                            "last_error": str(exc)[:500],
                            "last_failed_at": now.isoformat(),
                        }
                    )
                    _save_pipeline(job, pipeline)
                    failure_db.commit()
            finally:
                failure_db.close()
    return {"success": True, "examined": examined, "queued": queued, "failed": failed}


@celery_app.task(
    name="app.tasks.scan_pipeline.process_scan_pipeline",
    bind=True,
    acks_late=True,
    reject_on_worker_lost=True,
    max_retries=MAX_PIPELINE_ATTEMPTS - 1,
)
def process_scan_pipeline(self, job_id: int) -> dict:
    try:
        return run_scan_pipeline(job_id)
    except Exception as exc:
        db = SessionLocal()
        try:
            job = db.get(CrawlJob, job_id)
            pipeline = _pipeline(job) if job else {}
            if pipeline.get("status") == "failed":
                return {"success": False, "reason": "failed", "job_id": job_id}
            countdown = max(
                1,
                int(
                    (
                        (_parse_timestamp(pipeline.get("next_retry_at")) or _utcnow())
                        - _utcnow()
                    ).total_seconds()
                ),
            )
        finally:
            db.close()
        raise self.retry(
            exc=exc,
            countdown=min(MAX_RETRY_DELAY_SECONDS, countdown),
            max_retries=MAX_PIPELINE_ATTEMPTS - 1,
        )


@celery_app.task(name="app.tasks.scan_pipeline.reconcile_scan_pipelines")
def reconcile_scan_pipelines() -> dict:
    return reconcile_stale_scan_pipelines()
