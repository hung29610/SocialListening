"""Integration coverage for the durable scan -> analysis -> alert -> report flow."""

from datetime import datetime, timedelta, timezone

import pytest
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


@pytest.mark.parametrize("job_type", ["manual", "scheduled"])
def test_scan_creates_exactly_once_downstream_records(monkeypatch, tmp_path, job_type):
    """A high-risk search result becomes one mention, analysis, alert, and report."""
    from app.services import scan_service
    from app.tasks import scan_pipeline
    from app.services import search_providers

    engine = create_engine(f"sqlite:///{tmp_path / 'pipeline.db'}")
    session_factory = sessionmaker(bind=engine, expire_on_commit=False)
    Base.metadata.create_all(engine)

    with session_factory() as db:
        job = CrawlJob(
            job_type=job_type,
            status=CrawlJobStatus.PENDING,
            user_id=9,
            meta_data={
                "query": "Nope360",
                "project_id": 41,
                "organization_id": 17,
                "user_id": 9,
                "alert_threshold": 70,
            },
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
        mention = db.execute(select(Mention).where(Mention.job_id == job_id)).scalar_one()
        assert mention.organization_id == 17
        assert mention.user_id == 9
        assert len(db.execute(select(AIAnalysis)).scalars().all()) == 1
        alert = db.execute(select(Alert)).scalar_one()
        assert alert.organization_id == 17
        assert alert.user_id == 9
        assert alert.notification_channels == "dashboard"
        report = db.execute(select(Report)).scalar_one()
        assert report.organization_id == 17
        assert report.generated_by == 9
        assert len(db.execute(select(Mention).where(Mention.organization_id == 17)).scalars().all()) == 1
        assert len(db.execute(select(Mention).where(Mention.organization_id == 18)).scalars().all()) == 0
        assert len(db.execute(select(Alert).where(Alert.organization_id == 17)).scalars().all()) == 1
        assert len(db.execute(select(Alert).where(Alert.organization_id == 18)).scalars().all()) == 0
        assert len(db.execute(select(Report).where(Report.organization_id == 17)).scalars().all()) == 1
        assert len(db.execute(select(Report).where(Report.organization_id == 18)).scalars().all()) == 0
        completed_job = db.get(CrawlJob, job_id)
        pipeline = completed_job.meta_data["pipeline"]
        assert pipeline["status"] == "completed"
        for stage in ("scan", "mention", "analysis", "alert", "report"):
            assert pipeline["stages"][stage]["status"] == "completed"
            assert pipeline["stages"][stage]["completed_at"]

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


def test_provider_error_is_retryable_and_llm_call_holds_no_db_transaction(monkeypatch, tmp_path):
    """Provider calls run outside the lease transaction and provider_error retries."""
    from app.tasks import scan_pipeline

    engine = create_engine(f"sqlite:///{tmp_path / 'pipeline-provider.db'}")
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
            title="Provider test",
            content="provider error",
            content_hash="b" * 64,
        ))
        db.commit()
        job_id = job.id

    def provider_error(*_):
        # This commit would fail with SQLite "database is locked" if the
        # pipeline held its FOR UPDATE transaction across the provider call.
        with session_factory() as concurrent_db:
            concurrent_job = concurrent_db.get(CrawlJob, job_id)
            meta = dict(concurrent_job.meta_data or {})
            meta["provider_call_observed"] = True
            concurrent_job.meta_data = meta
            concurrent_db.commit()
        return {"status": "provider_error"}

    try:
        scan_pipeline.run_scan_pipeline(job_id, analysis_fn=provider_error)
    except RuntimeError:
        pass
    else:
        raise AssertionError("provider_error must remain retryable")

    with session_factory() as db:
        job = db.get(CrawlJob, job_id)
        assert job.meta_data["provider_call_observed"] is True
        assert job.meta_data["pipeline"]["status"] == "retrying"
        assert job.meta_data["pipeline"]["stages"]["analysis"]["status"] == "retrying"


def test_retry_exhaustion_enters_terminal_dead_letter_state(monkeypatch, tmp_path):
    from app.tasks import scan_pipeline

    engine = create_engine(f"sqlite:///{tmp_path / 'pipeline-dead-letter.db'}")
    session_factory = sessionmaker(bind=engine, expire_on_commit=False)
    Base.metadata.create_all(engine)
    monkeypatch.setattr(scan_pipeline, "SessionLocal", session_factory)

    with session_factory() as db:
        job = CrawlJob(
            job_type="manual",
            status=CrawlJobStatus.COMPLETED,
            meta_data={
                "project_id": 41,
                "pipeline": {
                    "status": "retrying",
                    "attempts": scan_pipeline.MAX_PIPELINE_ATTEMPTS - 1,
                },
            },
        )
        db.add(job)
        db.flush()
        db.add(Mention(
            job_id=job.id,
            project_id=41,
            title="Permanent failure",
            content="permanent failure",
            content_hash="c" * 64,
        ))
        db.commit()
        job_id = job.id

    try:
        scan_pipeline.run_scan_pipeline(
            job_id,
            analysis_fn=lambda *_: {"status": "provider_error"},
        )
    except RuntimeError:
        pass

    with session_factory() as db:
        pipeline = db.get(CrawlJob, job_id).meta_data["pipeline"]
        assert pipeline["status"] == "failed"
        assert pipeline["dead_lettered_at"]
        assert pipeline["attempts"] == scan_pipeline.MAX_PIPELINE_ATTEMPTS
        assert pipeline["stages"]["analysis"]["status"] == "failed"
        assert pipeline["stages"]["alert"]["status"] == "blocked"
        assert pipeline["stages"]["report"]["status"] == "blocked"


def test_reconciliation_only_enqueues_stale_bounded_work(monkeypatch, tmp_path):
    from app.tasks import scan_pipeline

    engine = create_engine(f"sqlite:///{tmp_path / 'pipeline-reconcile.db'}")
    session_factory = sessionmaker(bind=engine, expire_on_commit=False)
    Base.metadata.create_all(engine)
    monkeypatch.setattr(scan_pipeline, "SessionLocal", session_factory)
    now = datetime(2026, 7, 28, 1, 0, tzinfo=timezone.utc)

    def add_job(db, status, attempts, **pipeline_fields):
        pipeline = {"status": status, "attempts": attempts, **pipeline_fields}
        job = CrawlJob(
            job_type="manual",
            status=CrawlJobStatus.COMPLETED,
            completed_at=now - timedelta(hours=1),
            meta_data={"project_id": 41, "pipeline": pipeline},
        )
        db.add(job)
        db.flush()
        return job.id

    with session_factory() as db:
        fresh_id = add_job(
            db, "queued", 0, queued_at=(now - timedelta(seconds=10)).isoformat()
        )
        stale_id = add_job(
            db, "queued", 0, queued_at=(now - timedelta(minutes=10)).isoformat()
        )
        expired_lease_id = add_job(
            db, "running", 1, lease_expires_at=(now - timedelta(seconds=1)).isoformat()
        )
        exhausted_id = add_job(
            db,
            "retrying",
            scan_pipeline.MAX_PIPELINE_ATTEMPTS,
            next_retry_at=(now - timedelta(minutes=1)).isoformat(),
        )
        db.commit()

    enqueued = []
    result = scan_pipeline.reconcile_stale_scan_pipelines(
        now=now,
        enqueue_fn=enqueued.append,
    )
    assert set(enqueued) == {stale_id, expired_lease_id}
    assert fresh_id not in enqueued
    assert exhausted_id not in enqueued
    assert result["queued"] == 2
    assert result["failed"] == 1
    assert result["examined"] <= scan_pipeline.RECONCILE_BATCH_SIZE

    with session_factory() as db:
        exhausted = db.get(CrawlJob, exhausted_id).meta_data["pipeline"]
        assert exhausted["status"] == "failed"
        assert exhausted["dead_lettered_at"]
