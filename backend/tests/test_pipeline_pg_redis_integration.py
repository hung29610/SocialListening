"""Opt-in PostgreSQL + Redis/Celery gate for issue #220.

CI/staging must provide both TEST_DATABASE_URL (PostgreSQL only) and
TEST_REDIS_URL. The test uses a real Redis broker/result backend and starts two
Celery workers in sequence to prove broker delivery plus restart-safe
idempotency. Worker-loss redelivery is covered by the task's late-ack settings;
forcibly killing the in-process worker is not portable in pytest.
"""

import os
import uuid

import pytest
import redis
from celery.contrib.testing.worker import start_worker
from sqlalchemy import select

from app.core.database import Base, SessionLocal, engine
from app.models.alert import Alert
from app.models.crawl import CrawlJob, CrawlJobStatus
from app.models.mention import AIAnalysis, Mention
from app.models.report import Report
from app.tasks.scan_pipeline import process_scan_pipeline
from app.workers.celery_app import celery_app


TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "")
TEST_REDIS_URL = os.getenv("TEST_REDIS_URL", "")

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL.startswith(("postgresql://", "postgresql+psycopg2://"))
    or not TEST_REDIS_URL,
    reason="real TEST_DATABASE_URL (PostgreSQL) and TEST_REDIS_URL are required",
)


def test_real_queue_delivery_survives_worker_restart_without_duplicates():
    Base.metadata.create_all(engine)
    queue_name = f"pipeline-integration-{uuid.uuid4().hex}"
    content_hash = uuid.uuid4().hex + uuid.uuid4().hex
    redis_client = redis.Redis.from_url(TEST_REDIS_URL, decode_responses=True)

    celery_app.conf.update(
        broker_url=TEST_REDIS_URL,
        result_backend=TEST_REDIS_URL,
        task_always_eager=False,
        task_store_eager_result=False,
    )
    celery_app.loader.import_default_modules()
    assert process_scan_pipeline.acks_late is True
    assert process_scan_pipeline.reject_on_worker_lost is True

    with SessionLocal() as db:
        job = CrawlJob(
            job_type="manual",
            status=CrawlJobStatus.COMPLETED,
            user_id=909,
            meta_data={
                "project_id": 808,
                "organization_id": 707,
                "pipeline": {"status": "queued"},
            },
        )
        db.add(job)
        db.flush()
        mention = Mention(
            job_id=job.id,
            project_id=808,
            organization_id=707,
            user_id=909,
            title="Already analyzed integration mention",
            content="No external provider call is needed.",
            content_hash=content_hash,
        )
        db.add(mention)
        db.flush()
        db.add(AIAnalysis(
            mention_id=mention.id,
            sentiment="negative",
            risk_score=95,
            crisis_level=5,
            summary_vi="Integration alert",
            confidence_score=100,
            ai_provider="integration",
            model_version="fixed",
        ))
        db.commit()
        job_id = job.id
        mention_id = mention.id

    try:
        with start_worker(
            celery_app,
            pool="solo",
            concurrency=1,
            queues=[queue_name],
            perform_ping_check=False,
        ):
            first = process_scan_pipeline.apply_async(args=[job_id], queue=queue_name)
            assert first.get(timeout=30)["success"] is True

        # A new worker receives the same at-least-once delivery after restart.
        with start_worker(
            celery_app,
            pool="solo",
            concurrency=1,
            queues=[queue_name],
            perform_ping_check=False,
        ):
            second = process_scan_pipeline.apply_async(args=[job_id], queue=queue_name)
            assert second.get(timeout=30)["idempotent"] is True

        with SessionLocal() as db:
            assert len(db.execute(select(AIAnalysis).where(AIAnalysis.mention_id == mention_id)).scalars().all()) == 1
            assert len(db.execute(select(Alert).where(Alert.mention_id == mention_id)).scalars().all()) == 1
            reports = db.execute(
                select(Report).where(Report.project_id == 808)
            ).scalars().all()
            assert len([r for r in reports if (r.data or {}).get("crawl_job_id") == job_id]) == 1
    finally:
        with SessionLocal() as db:
            report_ids = [
                report.id for report in db.execute(
                    select(Report).where(Report.project_id == 808)
                ).scalars().all()
                if (report.data or {}).get("crawl_job_id") == job_id
            ]
            db.query(Alert).filter(Alert.mention_id == mention_id).delete()
            if report_ids:
                db.query(Report).filter(Report.id.in_(report_ids)).delete(synchronize_session=False)
            db.query(AIAnalysis).filter(AIAnalysis.mention_id == mention_id).delete()
            db.query(Mention).filter(Mention.id == mention_id).delete()
            db.query(CrawlJob).filter(CrawlJob.id == job_id).delete()
            db.commit()
        redis_client.delete(queue_name)
        redis_client.close()
