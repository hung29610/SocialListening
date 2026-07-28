"""Idempotent post-scan pipeline work.

The crawl job JSON metadata is the durable state record for this pipeline.  A
Celery delivery may be repeated, so every downstream write is looked up by its
stable job/mention identity before it is created.
"""

from datetime import datetime, timezone
import logging
from typing import Callable

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.alert import Alert, AlertSeverity, AlertStatus
from app.models.crawl import CrawlJob
from app.models.mention import AIAnalysis, Mention, SentimentScore
from app.models.report import Report, ReportStatus, ReportType
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)

RECOVERABLE_PIPELINE_STATUSES = {"queued", "running", "retrying", "enqueue_failed"}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _value(value):
    return value.value if hasattr(value, "value") else value


def _pipeline(job: CrawlJob) -> dict:
    meta = dict(job.meta_data or {})
    pipeline = dict(meta.get("pipeline") or {})
    meta["pipeline"] = pipeline
    job.meta_data = meta
    return pipeline


def _save_pipeline(job: CrawlJob, pipeline: dict) -> None:
    """Assign a new JSON value so SQLAlchemy persists state transitions."""
    meta = dict(job.meta_data or {})
    meta["pipeline"] = dict(pipeline)
    job.meta_data = meta


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


def run_scan_pipeline(job_id: int, analysis_fn: Callable | None = None) -> dict:
    """Process every mention from one completed scan exactly once.

    This function is deliberately synchronous so its transaction can lock the
    CrawlJob state record and it can be directly exercised by integration tests.
    Celery retries the wrapper around it on a transient provider or database
    failure.
    """
    if analysis_fn is None:
        from app.services.ai_service import analyze_mention

        analysis_fn = analyze_mention

    db = SessionLocal()
    alert_ids: list[int] = []
    try:
        job = db.execute(
            select(CrawlJob).where(CrawlJob.id == job_id).with_for_update()
        ).scalar_one_or_none()
        if not job:
            return {"success": False, "reason": "job_not_found", "job_id": job_id}

        pipeline = _pipeline(job)
        if pipeline.get("status") == "completed":
            return {"success": True, "idempotent": True, "job_id": job_id}

        now = _utcnow()
        pipeline.update(
            {
                "status": "running",
                "started_at": pipeline.get("started_at") or now.isoformat(),
                "last_attempt_at": now.isoformat(),
                "attempts": int(pipeline.get("attempts", 0)) + 1,
            }
        )
        _save_pipeline(job, pipeline)
        db.flush()

        mentions = db.execute(
            select(Mention).where(Mention.job_id == job_id).order_by(Mention.id)
        ).scalars().all()
        threshold = float((job.meta_data or {}).get("alert_threshold", 70))
        analyses_created = 0
        alerts_created = 0

        for mention in mentions:
            analysis = db.execute(
                select(AIAnalysis).where(AIAnalysis.mention_id == mention.id)
            ).scalar_one_or_none()
            if analysis is None:
                result = analysis_fn(mention.content or mention.snippet or "", mention.title or "")
                if not result or result.get("status") in {"error", "failed"}:
                    raise RuntimeError(f"AI analysis was not successful for mention {mention.id}")
                analysis = _analysis_for(mention, result)
                db.add(analysis)
                db.flush()
                analyses_created += 1

            if _should_alert(analysis, threshold):
                alert = db.execute(
                    select(Alert).where(Alert.mention_id == mention.id)
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
                            f"Risk score: {analysis.risk_score}, crisis level: {analysis.crisis_level}\n"
                            f"{analysis.summary_vi or ''}"
                        ),
                        notification_channels="dashboard,email",
                    )
                    db.add(alert)
                    db.flush()
                    alerts_created += 1
                alert_ids.append(alert.id)

        report_id = pipeline.get("report_id")
        report = db.get(Report, report_id) if report_id else None
        if report is None:
            report = Report(
                organization_id=(job.meta_data or {}).get("organization_id"),
                project_id=(job.meta_data or {}).get("project_id"),
                report_type=ReportType.CUSTOM,
                title=f"Scan pipeline report #{job.id}",
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

        pipeline.update(
            {
                "status": "completed",
                "completed_at": now.isoformat(),
                "mention_count": len(mentions),
                "analysis_count": len(mentions),
                "alerts_created": alerts_created,
                "report_id": report.id,
                "last_error": None,
            }
        )
        _save_pipeline(job, pipeline)
        db.commit()
    except Exception as exc:
        db.rollback()
        try:
            job = db.get(CrawlJob, job_id)
            if job:
                pipeline = _pipeline(job)
                pipeline.update({"status": "retrying", "last_error": str(exc)[:500]})
                _save_pipeline(job, pipeline)
                db.commit()
        except Exception:
            db.rollback()
        raise
    finally:
        db.close()

    return {
        "success": True,
        "job_id": job_id,
        "mentions": len(mentions),
        "analyses_created": analyses_created,
        "alerts_created": alerts_created,
        "report_id": report.id,
    }


@celery_app.task(
    name="app.tasks.scan_pipeline.process_scan_pipeline",
    bind=True,
    acks_late=True,
    reject_on_worker_lost=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    retry_kwargs={"max_retries": 5},
)
def process_scan_pipeline(self, job_id: int) -> dict:
    return run_scan_pipeline(job_id)


@celery_app.task(name="app.tasks.scan_pipeline.reconcile_scan_pipelines")
def reconcile_scan_pipelines() -> dict:
    """Re-enqueue interrupted pipelines recorded on completed crawl jobs."""
    db = SessionLocal()
    queued = 0
    try:
        jobs = db.execute(select(CrawlJob)).scalars().all()
        for job in jobs:
            status = ((job.meta_data or {}).get("pipeline") or {}).get("status")
            if status in RECOVERABLE_PIPELINE_STATUSES:
                process_scan_pipeline.delay(job.id)
                queued += 1
        return {"success": True, "queued": queued}
    finally:
        db.close()
