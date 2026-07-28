"""Integration coverage for the durable scan -> analysis -> alert -> report flow."""

from datetime import datetime, timezone

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.alert import Alert
from app.models.crawl import CrawlJob, CrawlJobStatus
from app.models.mention import AIAnalysis, Mention
from app.models.report import Report


def test_pipeline_tasks_register_without_legacy_async_task_import():
    """The worker can start without importing the incompatible legacy task module."""
    from app.workers.celery_app import celery_app

    celery_app.loader.import_default_modules()
    assert "app.tasks.scan_pipeline.process_scan_pipeline" in celery_app.tasks
    assert "app.tasks.scan_pipeline.reconcile_scan_pipelines" in celery_app.tasks


def test_scan_creates_exactly_once_downstream_records(monkeypatch, tmp_path):
    """A high-risk search result becomes one mention, analysis, alert, and report."""
    from app.services import scan_service
    from app.tasks import scan_pipeline
    from app.services import search_providers

    engine = create_engine(f"sqlite:///{tmp_path / 'pipeline.db'}")
    session_factory = sessionmaker(bind=engine, expire_on_commit=False)
    Base.metadata.create_all(engine)

    with session_factory() as db:
        job = CrawlJob(
            job_type="manual",
            status=CrawlJobStatus.PENDING,
            meta_data={"query": "Nope360", "project_id": 41, "alert_threshold": 70},
        )
        db.add(job)
        db.commit()
        job_id = job.id

    monkeypatch.setattr(scan_service, "SessionLocal", session_factory)
    monkeypatch.setattr(scan_pipeline, "SessionLocal", session_factory)
    monkeypatch.setattr(
        search_providers,
        "run_provider_chain",
        lambda **_: (
            [{
                "url": "https://example.test/nope360-risk",
                "title": "Nope360 outage causes severe customer harm",
                "snippet": "Customers report an urgent outage.",
                "matched_keyword": "Nope360",
                "provider": "test",
            }],
            {"test": {"raw_results": 1, "duplicate_skipped": 0, "invalid_url_skipped": 0}},
        ),
    )

    def fake_analysis(content, title):
        assert "urgent outage" in content
        assert "severe" in title
        return {
            "status": "success",
            "sentiment": "negative",
            "risk_score": 92,
            "crisis_level": 5,
            "summary_vi": "High-risk outage report",
            "suggested_action": "escalate",
            "responsible_department": "PR",
            "confidence_score": 99,
            "ai_provider": "test",
            "model_version": "test-v1",
            "processing_time_ms": 1,
        }

    monkeypatch.setattr(
        scan_service,
        "enqueue_scan_pipeline",
        lambda queued_job_id: scan_pipeline.run_scan_pipeline(queued_job_id, analysis_fn=fake_analysis),
        raising=False,
    )

    scan_service.execute_scan(
        job_id=job_id,
        project_id=41,
        keyword_texts=["Nope360"],
        mode="MANUAL",
        max_results=1,
        source_types=["search_chain"],
    )

    with session_factory() as db:
        assert len(db.execute(select(Mention).where(Mention.job_id == job_id)).scalars().all()) == 1
        assert len(db.execute(select(AIAnalysis)).scalars().all()) == 1
        assert len(db.execute(select(Alert)).scalars().all()) == 1
        assert len(db.execute(select(Report)).scalars().all()) == 1
        completed_job = db.get(CrawlJob, job_id)
        assert completed_job.meta_data["pipeline"]["status"] == "completed"

    # At-least-once delivery must not duplicate any downstream record.
    scan_pipeline.run_scan_pipeline(job_id, analysis_fn=fake_analysis)
    with session_factory() as db:
        assert len(db.execute(select(AIAnalysis)).scalars().all()) == 1
        assert len(db.execute(select(Alert)).scalars().all()) == 1
        assert len(db.execute(select(Report)).scalars().all()) == 1


def test_pipeline_records_transient_failure_then_recovers(monkeypatch, tmp_path):
    """A failed AI call remains retryable and creates no partial downstream rows."""
    from app.tasks import scan_pipeline

    engine = create_engine(f"sqlite:///{tmp_path / 'pipeline-retry.db'}")
    session_factory = sessionmaker(bind=engine, expire_on_commit=False)
    Base.metadata.create_all(engine)
    monkeypatch.setattr(scan_pipeline, "SessionLocal", session_factory)

    with session_factory() as db:
        job = CrawlJob(
            job_type="manual",
            status=CrawlJobStatus.COMPLETED,
            meta_data={"project_id": 41, "pipeline": {"status": "queued"}},
        )
        db.add(job)
        db.flush()
        db.add(Mention(
            job_id=job.id,
            project_id=41,
            title="Risky post",
            content="transient failure test",
            content_hash="a" * 64,
        ))
        db.commit()
        job_id = job.id

    def transient_failure(*_):
        raise TimeoutError("provider timeout")

    try:
        scan_pipeline.run_scan_pipeline(job_id, analysis_fn=transient_failure)
    except TimeoutError:
        pass
    else:
        raise AssertionError("The transient provider error must be retried")

    with session_factory() as db:
        assert db.get(CrawlJob, job_id).meta_data["pipeline"]["status"] == "retrying"
        assert len(db.execute(select(AIAnalysis)).scalars().all()) == 0
        assert len(db.execute(select(Alert)).scalars().all()) == 0
        assert len(db.execute(select(Report)).scalars().all()) == 0

    result = scan_pipeline.run_scan_pipeline(
        job_id,
        analysis_fn=lambda *_: {
            "status": "success", "sentiment": "neutral", "risk_score": 0,
            "crisis_level": 1, "summary_vi": "recovered", "confidence_score": 90,
        },
    )
    assert result["success"] is True
    with session_factory() as db:
        assert db.get(CrawlJob, job_id).meta_data["pipeline"]["status"] == "completed"
        assert len(db.execute(select(AIAnalysis)).scalars().all()) == 1
        assert len(db.execute(select(Alert)).scalars().all()) == 0
        assert len(db.execute(select(Report)).scalars().all()) == 1
