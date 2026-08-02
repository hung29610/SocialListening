# Issue #221 mention-feed performance evidence

## Measured endpoint benchmark

The repeatable benchmark is `backend/tests/mention_feed_benchmark.py`. Both
runs used the same Python 3.11 environment, in-memory SQLAlchemy database,
100-row fixture, 25 timed requests, and actual authenticated FastAPI endpoint.

| Commit | SELECTs | p95 | median | response bytes |
|---|---:|---:|---:|---:|
| merged `origin/main` `3f8396c` before | 104 | 88.74 ms | 76.54 ms | 367,950 |
| Wave 2A working tree after | 5 | 73.38 ms | 56.14 ms | 100,896 |

The final isolated paired run removed 99 queries, reduced p95 by approximately
17.3%, reduced median latency by approximately 26.7%, and returned 72.6% fewer
response bytes. An earlier same-day reproduction measured `150.09 -> 56.64 ms`
p95; that more favorable but variable latency result is retained only as
supporting evidence, not the final claim. The endpoint-level SQLAlchemy event regression test
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
payload. Existing clients retain the expanded representation by default. The
slim representation is opt-in with `expand=false`; it omits full `content`,
`metadata`, `original_url`, and `verification_error` values while preserving
the response keys.

Cursor semantics by sort:

- `newest` and `oldest` use `(collected_at,id)`;
- `risk_high` and `risk_low` use `(risk_score,collected_at,id)`;
- `influence_high` uses `(influence_score,collected_at,id)`;
- `engagement_high` uses
  `(views+comments+likes+shares,collected_at,id)`.

Every score/value sort applies `NULLS LAST`. Once a cursor reaches the null
partition, subsequent pages remain inside that partition and continue by
descending `(collected_at,id)`. Cursors embed and validate the requested sort,
preventing accidental reuse across incompatible orderings. Multi-page endpoint
tests traverse all 100 rows for every value sort and assert exact ordering,
zero duplicates, and zero gaps.

Searched lists use the same composite/date ordering instead of an incomplete
relevance cursor, so pages cannot overlap or skip due to mismatched keys.
Search cache keys are SHA-256 hashes over tenant,
user, pagination, expansion, and every list filter. Regression coverage mutates
each filter independently and proves the key changes.

Legacy null `collected_at` rows are not guessed or rewritten by this migration.
List/count queries exclude null timestamps defensively, while the migration is
limited to indexes for the three measured query shapes.

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

## PostgreSQL 17.6 migration and EXPLAIN evidence

Blocking CI provisions isolated PostgreSQL, rehearses
`c1a2b3d4e5f6 -> d72f8a913b21 -> downgrade -> re-upgrade`, verifies the
organization cursor index is valid and selected by `EXPLAIN (ANALYZE, BUFFERS)`,
and runs a real 100-row endpoint benchmark. The gate requires exactly two
PostgreSQL benchmark tests with zero skips.

### Interrupted concurrent index recovery

The migration reads `pg_index.indisvalid` for each expected index. A missing
index is created concurrently, a valid index is retained, and an invalid
leftover is dropped concurrently before recreation. This was tested on
PostgreSQL by intentionally leaving an invalid
`idx_mentions_org_collected_id` after a failed concurrent unique build. Upgrade
recovers it as a valid non-unique three-column index without modifying legacy
timestamps; downgrade removes only the indexes.

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
PostgreSQL `CONCURRENTLY`; human review and the isolated round-trip gate remain
mandatory before deployment.
