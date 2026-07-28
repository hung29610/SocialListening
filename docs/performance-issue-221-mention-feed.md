# Issue #221 mention-feed performance evidence

## SQL statement count

The pre-change endpoint executed 104 statements for a full 100-row page:

- 1 total-count statement
- 1 page statement
- 1 batched source statement
- 1 batched visit statement
- 100 `AIAnalysis` statements, one per mention

The regression test now proves a maximum of 5 statements:

- 1 total-count statement
- 1 page statement
- 1 batched source statement
- 1 batched visit statement
- 1 batched `AIAnalysis` statement

`backend/tests/test_mentions_feed_performance.py` preserves both the 104-statement
baseline and the 5-statement ceiling.

## Pagination and payload

The endpoint accepts an opaque `cursor` based on the stable
`(collected_at, id)` tuple for `newest` and `oldest` sorting and returns
`next_cursor`. Offset pagination remains compatible when no cursor is supplied.
The list response is slim by default: full `content`, `metadata`,
`original_url`, and `verification_error` require `expand=true`.

## Index evidence

The list query first scopes by `organization_id` (or project), optionally
filters by exact `keyword_id`, and then seeks/orders on `(collected_at, id)`.
The migration adds indexes matching those left-prefix query shapes:

- `(organization_id, collected_at, id)`
- `(project_id, collected_at, id)`
- `(keyword_id, collected_at, id)`

No speculative text index is added. Existing `%keyword_text%` filtering cannot
use a B-tree index; callers that know the keyword use the new exact
`keyword_id` filter. PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)` must be captured
against production-like cardinality during the human migration review because
this worktree has no approved production database access.

## Human review gate

`backend/alembic/versions/d72f8a913b21_add_mention_feed_cursor_indexes.py` is a
high-risk Alembic change. Review lock duration, index size, upgrade, downgrade,
and production-like `EXPLAIN (ANALYZE, BUFFERS)` before deployment.
