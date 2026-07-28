# Issue #220 pipeline repair

## State and delivery

`crawl_jobs.meta_data.pipeline` is the durable state record for a scan:

- `queued` is stored in the same committed transaction as the final scan status
  and newly persisted mentions.
- `running` records the attempt before analysis begins.
- `retrying` retains the failure reason for Celery retry/reconciliation.
- `completed` records timestamps, downstream counts, and the generated report
  ID.

The Celery task uses late acknowledgement, worker-loss rejection, bounded
exponential backoff with jitter, and a five-minute reconciliation task. Every
write is keyed by scan job or mention: analyses are unique by `mention_id`, an
alert is looked up by `mention_id`, and the report ID is persisted on the job.
The alert row is the durable dashboard notification. Email/webhook delivery is
not invoked by this flow because the legacy `app.workers.tasks` module cannot
load against the current synchronous database configuration; repairing that
separate delivery path needs its own credential-reviewed ticket.

## Known deployment handoff

This code intentionally makes no production configuration change. The worker
image must install Celery and run a worker plus beat process connected to
`REDIS_URL`; otherwise queued pipeline state will remain recoverable but will
not advance. This is a release requirement for the human backend/config review.

## Supabase development schema drift evidence

The development dashboard's last-60-minute Postgres log contained 50 records,
dominated by SQLSTATE `42703`; a representative message was
`column worker_status.is_locked does not exist`. Secondary bursts were
`25P02` (aborted transaction), `22P02` (invalid text representation), and
`42P07` (duplicate table). That signature is migration/schema drift, not a
scan-pipeline data failure. No production data or configuration was changed by
this ticket. Reconcile the Supabase development schema separately before using
it as a test environment.
