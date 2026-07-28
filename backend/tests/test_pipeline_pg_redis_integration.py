"""Opt-in PostgreSQL + Redis/Celery gates for issue #220.

`TEST_DATABASE_URL` always owns an engine/session created in this module; the
application's import-time engine is never reused. `TEST_REDIS_URL` is used as
both the Celery broker/result backend and the direct verification client.
"""

from contextlib import contextmanager
import os
from pathlib import Path
import subprocess
import sys
import time
import uuid

from celery import Celery
from celery.contrib.testing.worker import start_worker
import pytest
import redis
from sqlalchemy import create_engine, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.alert import Alert
from app.models.crawl import CrawlJob, CrawlJobStatus
from app.models.mention import AIAnalysis, Mention
from app.models.report import Report
from app.tasks import scan_pipeline
from app.tasks.scan_pipeline import process_scan_pipeline
from app.workers.celery_app import celery_app


TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "")
TEST_REDIS_URL = os.getenv("TEST_REDIS_URL", "")
HAS_POSTGRES = TEST_DATABASE_URL.startswith(
    ("postgresql://", "postgresql+psycopg2://")
)
HAS_REDIS = bool(TEST_REDIS_URL)


@pytest.fixture(scope="module")
def pg_runtime():
    if not HAS_POSTGRES:
        pytest.skip("a dedicated PostgreSQL TEST_DATABASE_URL is required")
    engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
    session_factory = sessionmaker(
        bind=engine,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
    try:
        Base.metadata.create_all(engine)
        yield engine, session_factory
    finally:
        engine.dispose()


@pytest.fixture
def redis_client():
    if not HAS_REDIS:
        pytest.skip("TEST_REDIS_URL is required")
    client = redis.Redis.from_url(TEST_REDIS_URL, decode_responses=True)
    client.ping()
    try:
        yield client
    finally:
        client.close()


def test_test_database_url_owns_an_isolated_postgres_engine(pg_runtime):
    """Prove the module-created engine is bound to the requested test DB."""
    engine, session_factory = pg_runtime
    expected_database = make_url(TEST_DATABASE_URL).database
    assert engine.url.database == expected_database
    with session_factory() as db:
        assert db.execute(text("select current_database()")).scalar_one() == expected_database
    assert scan_pipeline.SessionLocal is not session_factory


@pytest.mark.skipif(
    not (HAS_POSTGRES and HAS_REDIS),
    reason="real PostgreSQL TEST_DATABASE_URL and TEST_REDIS_URL are required",
)
def test_real_queue_delivery_survives_worker_restart_without_duplicates(
    pg_runtime,
    redis_client,
    monkeypatch,
):
    """Deliver the real pipeline task through Redis to two worker lifetimes."""
    _, session_factory = pg_runtime
    monkeypatch.setattr(scan_pipeline, "SessionLocal", session_factory)
    queue_name = f"pipeline-integration-{uuid.uuid4().hex}"
    content_hash = uuid.uuid4().hex + uuid.uuid4().hex

    celery_app.conf.update(
        broker_url=TEST_REDIS_URL,
        result_backend=TEST_REDIS_URL,
        task_always_eager=False,
        task_store_eager_result=False,
    )
    celery_app.loader.import_default_modules()
    assert process_scan_pipeline.acks_late is True
    assert process_scan_pipeline.reject_on_worker_lost is True

    with session_factory() as db:
        job = CrawlJob(
            job_type="manual",
            status=CrawlJobStatus.COMPLETED,
            user_id=909,
            meta_data={
                "project_id": 808,
                "organization_id": 707,
                "user_id": 909,
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

        with start_worker(
            celery_app,
            pool="solo",
            concurrency=1,
            queues=[queue_name],
            perform_ping_check=False,
        ):
            second = process_scan_pipeline.apply_async(args=[job_id], queue=queue_name)
            assert second.get(timeout=30)["idempotent"] is True

        with session_factory() as db:
            assert len(db.execute(
                select(AIAnalysis).where(AIAnalysis.mention_id == mention_id)
            ).scalars().all()) == 1
            assert len(db.execute(
                select(Alert).where(Alert.mention_id == mention_id)
            ).scalars().all()) == 1
            reports = db.execute(
                select(Report).where(Report.project_id == 808)
            ).scalars().all()
            assert len([
                report for report in reports
                if (report.data or {}).get("crawl_job_id") == job_id
            ]) == 1
    finally:
        with session_factory() as db:
            report_ids = [
                report.id for report in db.execute(
                    select(Report).where(Report.project_id == 808)
                ).scalars().all()
                if (report.data or {}).get("crawl_job_id") == job_id
            ]
            db.query(Alert).filter(Alert.mention_id == mention_id).delete()
            if report_ids:
                db.query(Report).filter(Report.id.in_(report_ids)).delete(
                    synchronize_session=False
                )
            db.query(AIAnalysis).filter(AIAnalysis.mention_id == mention_id).delete()
            db.query(Mention).filter(Mention.id == mention_id).delete()
            db.query(CrawlJob).filter(CrawlJob.id == job_id).delete()
            db.commit()
        redis_client.delete(queue_name)


@contextmanager
def _worker_process(module_dir: Path, queue_name: str):
    env = dict(os.environ)
    env["PYTHONPATH"] = str(module_dir)
    process = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "celery",
            "-A",
            "worker_loss_app:app",
            "worker",
            "--pool=solo",
            "--concurrency=1",
            "--queues",
            queue_name,
            "--loglevel=WARNING",
            "--without-heartbeat",
            "--without-gossip",
            "--without-mingle",
        ],
        cwd=module_dir,
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        yield process
    finally:
        if process.poll() is None:
            process.kill()
        process.wait(timeout=10)


def _wait_for_redis_key(client, key: str, timeout: float = 20) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if client.exists(key):
            return
        time.sleep(0.1)
    raise AssertionError(f"worker did not set expected Redis key {key!r}")


@pytest.mark.skipif(not HAS_REDIS, reason="real TEST_REDIS_URL is required")
def test_late_ack_message_is_redelivered_after_worker_process_loss(
    redis_client,
    tmp_path,
):
    """Kill a solo worker mid-task and prove another worker receives the message."""
    token = uuid.uuid4().hex
    queue_name = f"worker-loss-{token}"
    started_key = f"issue220:{token}:started"
    attempts_key = f"issue220:{token}:attempts"
    module_path = tmp_path / "worker_loss_app.py"
    module_path.write_text(
        "\n".join(
            [
                "import os",
                "import time",
                "from celery import Celery",
                "import redis",
                "url = os.environ['TEST_REDIS_URL']",
                "app = Celery('worker_loss', broker=url, backend=url)",
                "app.conf.broker_transport_options = {'visibility_timeout': 2, 'polling_interval': 0.1}",
                "@app.task(name='issue220.worker_loss_probe', acks_late=True, reject_on_worker_lost=True)",
                "def worker_loss_probe(token):",
                "    client = redis.Redis.from_url(url, decode_responses=True)",
                "    attempt = client.incr(f'issue220:{token}:attempts')",
                "    client.set(f'issue220:{token}:started', attempt)",
                "    if attempt == 1:",
                "        time.sleep(60)",
                "    return attempt",
            ]
        ),
        encoding="utf-8",
    )
    client_app = Celery("worker_loss_client", broker=TEST_REDIS_URL, backend=TEST_REDIS_URL)
    client_app.conf.broker_transport_options = {
        "visibility_timeout": 2,
        "polling_interval": 0.1,
    }
    task_id = uuid.uuid4().hex

    try:
        with _worker_process(tmp_path, queue_name) as first_worker:
            client_app.send_task(
                "issue220.worker_loss_probe",
                args=[token],
                task_id=task_id,
                queue=queue_name,
            )
            _wait_for_redis_key(redis_client, started_key)
            first_worker.kill()
            first_worker.wait(timeout=10)

        time.sleep(3)
        with _worker_process(tmp_path, queue_name):
            result = client_app.AsyncResult(task_id)
            assert result.get(timeout=30) == 2

        assert int(redis_client.get(attempts_key)) == 2
    finally:
        redis_client.delete(started_key, attempts_key, queue_name)
