# Issue #220 pipeline repair and release evidence

## Durable state machine

`crawl_jobs.meta_data.pipeline` is the durable orchestration record. It stores
top-level state, bounded attempt count, lease identity/expiry, retry deadline,
last error, terminal dead-letter timestamp, and per-stage records:

| Stage | Durable states | Timestamp evidence |
|---|---|---|
| scan | completed | started_at, completed_at |
| mention | completed | started_at, completed_at, count |
| analysis | queued, running, retrying, completed, failed | queued_at, started_at, last_attempt_at, completed_at/failed_at |
| alert | pending, blocked, completed | blocked_at or completed_at, count |
| report | pending, blocked, completed | blocked_at or completed_at, report_id |

The scan and mention stages are committed before Celery enqueue. Pipeline
execution acquires and commits a three-minute lease, closes that transaction,
then invokes the external AI provider. Final analysis/alert/report writes occur
in a new transaction only after re-locking the job and matching its lease token.
No database lock is held over an LLM call.

At-least-once deliveries are serialized by the crawl-job lock. `AIAnalysis`
also has a unique `mention_id`; alerts are re-read by `mention_id`; reports are
re-read by the persisted `report_id` and stable scan title. Alerts claim only
the durable `dashboard` channel—no email delivery is claimed or attempted.

`provider_error`, `error`, `failed`, empty provider results, and raised provider
exceptions are retryable. Attempts use bounded exponential delay. Attempt six
is terminal `failed` with `dead_lettered_at`; alert/report stages become
`blocked`. The five-minute reconciler selects at most 100 recoverable records,
queues only stale work, and dead-letters stale records whose budget is already
exhausted.

## Tenant propagation

Manual jobs preserve `CrawlJob.user_id` and metadata `organization_id`. If
organization metadata is absent, the scan resolves the owner's
`current_organization_id`. Scheduled jobs record both fields before scanning.
Mentions copy both identifiers; alerts copy them from their mention; reports
copy organization/project and use the job owner as `generated_by`.

## Render Blueprint diff requiring human review

`backend/render.yaml` now prepares two services sharing the existing
`DATABASE_URL`, `SECRET_KEY`, and `REDIS_URL`:

- `social-listening-pipeline-worker`, consuming the `analysis` queue;
- `social-listening-pipeline-beat`, running stale reconciliation every five
  minutes.

This is a prepared configuration diff only. Do not apply it automatically.
Render service creation and environment wiring remain a production action
requiring human review. The worker also declares the AI provider chain and
provider-key variables so the human can copy the same provider configuration
used by the web service; no credential values are present in the Blueprint.

## Deterministic gates

Local/fallback gate:

```powershell
D:\desktop_file\Project\SocialListening\.audit-venv311\Scripts\python.exe -m pytest tests/test_pipeline_scan_flow.py -q
D:\desktop_file\Project\SocialListening\.audit-venv311\Scripts\python.exe -m pytest -q
```

Real PostgreSQL + Redis queue/restart gate:

```powershell
$env:TEST_DATABASE_URL = '<dedicated PostgreSQL test database URL>'
$env:TEST_REDIS_URL = '<dedicated Redis test database URL>'
D:\desktop_file\Project\SocialListening\.audit-venv311\Scripts\python.exe -m pytest tests/test_pipeline_pg_redis_integration.py -q
```

The test module constructs its own SQLAlchemy engine and session factory from
`TEST_DATABASE_URL`; it never reuses the application's import-time engine.
`TEST_REDIS_URL` is explicitly installed as both Celery broker and result
backend.

The first Redis gate starts a real Celery worker, delivers the real pipeline
task, stops it, starts a second worker, redelivers the same job, and proves
exactly one analysis, alert, and report. The second Redis gate launches a Celery
worker subprocess, waits until an `acks_late` probe is unacknowledged in Redis,
kills the worker process, and proves a second worker receives and completes the
restored message after the visibility timeout.

Local evidence on 2026-07-28:

- PostgreSQL 17.9 accepted passwordless localhost test-administrator access.
- A dedicated `issue220_pipeline_test_20260728` database was created, the
  isolated-engine test passed, and that exact disposable database was dropped.
- Redis/Valkey, Docker, Podman, WSL distributions, and Redis listeners were not
  available, so both real Redis gates remain externally blocked.

## Required staging evidence after human deployment

1. Use a dedicated non-production project/keyword and record its crawl job ID.
2. Verify Render worker and beat both connect to Redis and consume `analysis`.
3. Record one row and timestamps for scan, mention, analysis, alert, and report.
4. Repeat the automated process-kill/redelivery gate against staging Redis,
   then restart the deployed worker after enqueue; verify lease expiry/requeue
   and exactly-one downstream row counts.
5. Inject provider errors through six attempts; verify terminal `failed`,
   `dead_lettered_at`, and no further reconciliation enqueue.
6. Confirm another organization cannot query the mention, alert, or report.

## Supabase development schema drift

The development dashboard's last-60-minute Postgres log contained 50 records,
dominated by SQLSTATE `42703`; the representative message was
`column worker_status.is_locked does not exist`. Secondary bursts were
`25P02`, `22P02`, and `42P07`. This is schema/migration drift, separate from
the pipeline repair. No database or deployed production configuration changed.
