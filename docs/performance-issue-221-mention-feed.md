# Issue #221 mention-feed performance evidence

## Measured endpoint benchmark

The repeatable benchmark is `backend/tests/mention_feed_benchmark.py`. Both
runs used the same Python 3.11 environment, in-memory SQLAlchemy database,
100-row fixture, 25 timed requests, and actual authenticated FastAPI endpoint.

| Commit | SELECTs | p95 | median | response bytes |
|---|---:|---:|---:|---:|
| `bb13a9d` before | 104 | 238.77 ms | 154.28 ms | 367,950 |
| issue #221 after (final rerun) | 5 | 68.93 ms | 59.29 ms | 100,896 |

The result is 99 queries removed, approximately 71.1% lower p95, and 72.6%
fewer response bytes. The endpoint-level SQLAlchemy event regression test
creates 100 mentions and fails above five SELECT statements.

Summary aggregation is independently bounded to three SELECT statements:
totals/sentiments, source grouping, and daily grouping.
Chart aggregation is one grouped SELECT for daily, weekly, and monthly
granularity; its endpoint regression verifies statement count and result values.

## Pagination and payload

The endpoint accepts an opaque `cursor` based on the stable
`(collected_at, id)` tuple for `newest` and `oldest` sorting and returns
`next_cursor`. Requests with `page > 1` are rejected; the frontend now uses
previous/next cursor navigation and explicitly requests its existing rich card
payload. Other consumers receive the slim representation by default: full `content`, `metadata`,
`original_url`, and `verification_error` require `expand=true`.

Cursor semantics by sort:

- `newest`, `oldest`, and `engagement_high` paginate with the stable
  `(collected_at,id)` tuple;
- `risk_high`, `risk_low`, and `influence_high` are explicitly single-page,
  return no `next_cursor`, and reject any supplied cursor with HTTP 400;
- searched lists use the same date/id ordering instead of an incomplete
  relevance cursor, so pages cannot overlap or skip due to mismatched keys.

The frontend only enables Next when `next_cursor` exists, making unsupported
single-page sorts safe. Search cache keys are SHA-256 hashes over tenant,
user, pagination, expansion, and every list filter. Regression coverage mutates
each filter independently and proves the key changes.

Legacy null `collected_at` rows are backfilled during migration, the column is
made `NOT NULL`, and the model has the same invariant. List/count queries also
exclude null timestamps defensively during rolling deployment.

## Index evidence

The list query first scopes by `organization_id` (or project), optionally
filters by exact `keyword_id`, and then seeks/orders on `(collected_at, id)`.
The migration adds indexes matching those left-prefix query shapes:

- `(organization_id, collected_at, id)`
- `(project_id, collected_at, id)`
- `(keyword_id, collected_at, id)`

No speculative text index is added. Existing `%keyword_text%` filtering cannot
use a B-tree index; callers that know the keyword use the new exact
`keyword_id` filter.

## PostgreSQL 17.9 migration and EXPLAIN evidence

A disposable local PostgreSQL database was populated with 50,000 mentions,
including 25 legacy null timestamps. Upgrade results:

- all 25 null timestamps backfilled;
- `collected_at` became `NOT NULL`;
- all three concurrent indexes reported `indisvalid=true`;
- downgrade removed all three indexes and restored nullable status;
- re-upgrade completed at Alembic head `d72f8a913b21`.

Representative `EXPLAIN (ANALYZE, BUFFERS)` results:

| Query shape | Plan | Execution |
|---|---|---:|
| organization + cursor date | backward index-only scan on `idx_mentions_org_collected_id` | 0.389 ms |
| project + cursor date | backward index-only scan on `idx_mentions_project_collected_id` | 0.138 ms |
| exact keyword + cursor date | backward index-only scan on `idx_mentions_keyword_collected_id` | 0.087 ms |

The disposable database was dropped after verification.

### Interrupted concurrent index recovery

The migration reads `pg_index.indisvalid` for each expected index. A missing
index is created concurrently, a valid index is retained, and an invalid
leftover is dropped concurrently before recreation. This was tested on
PostgreSQL by intentionally leaving an invalid
`idx_mentions_org_collected_id` after a failed concurrent unique build. Upgrade
recovered it as a valid non-unique three-column index, backfilled the null
timestamp, and downgrade completed successfully.

Operational check before/after migration:

```sql
SELECT c.relname, i.indisvalid, pg_get_indexdef(i.indexrelid)
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
WHERE c.relname IN (
  'idx_mentions_org_collected_id',
  'idx_mentions_project_collected_id',
  'idx_mentions_keyword_collected_id'
);
```

## Human review gate

`backend/alembic/versions/d72f8a913b21_add_mention_feed_cursor_indexes.py` is a
high-risk Alembic change. Index creation/drop uses Alembic autocommit blocks and
PostgreSQL `CONCURRENTLY`; human review of the timestamp backfill and brief
`ALTER COLUMN ... SET NOT NULL` lock remains mandatory before deployment.
