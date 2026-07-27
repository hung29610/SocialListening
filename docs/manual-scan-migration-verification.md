# Manual Scan Migration Verification Report

## Scope & Target
- Target branch: `prep/manual-scan-migration-93a03c74c024-idempotency`
- Base commit: `c55f4a3` (original idempotency guards)
- Local amendment: added `server_default` alignment and explicit `raise` in `upgrade()`
- Purpose: Verify that migrations `93a03c74c024` and `98958b6e0e48` are fully idempotent,
  produce byte-identical schema regardless of execution order, and guard against missing
  prerequisites.

## Verdict: PASS

All tests pass. The two migrations produce identical logical schema regardless of which
executes first, including database-level defaults on boolean columns.

---

## Verification Results

### 1. Forward Order (ORDER_A): `98958b6e0e48` first, then `93a03c74c024`

```
Running upgrade 013_add_schedule_arrays -> 98958b6e0e48  OK
Running upgrade 022 -> 93a03c74c024                      OK
```

Column dump (migration-added columns only):

| Column | Type | Nullable | Default |
|---|---|---|---|
| urgency | character varying | YES | |
| response_type | character varying | YES | |
| recommended_owner | character varying | YES | |
| deadline_suggestion | character varying | YES | |
| escalation_needed | boolean | YES | false |
| why_it_matters | text | YES | |
| vietnamese_context_label | character varying | YES | |
| tone | character varying | YES | |
| sarcasm_possible | boolean | YES | false |
| complaint_type | character varying | YES | |
| sensitive_signal | boolean | YES | false |
| explanation | text | YES | |

### 2. Reverse Order (ORDER_B): `93a03c74c024` first, then `98958b6e0e48`

```
Running upgrade 022 -> 93a03c74c024                        OK
Running upgrade 013_add_schedule_arrays -> 98958b6e0e48    OK
```

Column dump (migration-added columns only):

| Column | Type | Nullable | Default |
|---|---|---|---|
| vietnamese_context_label | character varying | YES | |
| tone | character varying | YES | |
| sarcasm_possible | boolean | YES | false |
| complaint_type | character varying | YES | |
| sensitive_signal | boolean | YES | false |
| explanation | text | YES | |
| urgency | character varying | YES | |
| response_type | character varying | YES | |
| recommended_owner | character varying | YES | |
| deadline_suggestion | character varying | YES | |
| escalation_needed | boolean | YES | false |
| why_it_matters | text | YES | |

**Comparison**: The logical schema (column name, type, nullable, default) is **identical**
between both orders. The only difference is ordinal position (column ordering), which is
expected — PostgreSQL appends columns in the order `ALTER TABLE ADD COLUMN` is called.
The `server_default` values for `sarcasm_possible`, `sensitive_signal`, and
`escalation_needed` are `false` in both orders.

### 3. Idempotency (re-run on ORDER_A database)
- Re-run `93a03c74c024`: OK (no-op)
- Re-run `98958b6e0e48`: OK (no-op)

### 4. Out-of-Band Pre-existing Column
- Pre-added `vietnamese_context_label` manually before running `93a03c74c024`.
- Result: **OK** — migration detected existing column, skipped it, added remaining 5 columns.

### 5. Backend Tests
- `9 passed in 10.47s` (all manual scan and schema regression tests).
- The new `raise RuntimeError` in `upgrade()` did not break any test. The tests use
  SQLAlchemy `Base.metadata.create_all()` which creates `ai_analysis` before migrations
  are relevant, so the guard is never triggered in the test environment.

---

## Changes Made to `93a03c74c024` (relative to `c55f4a3`)

1. **Server default alignment**: `COLUMNS` converted from 2-tuples to 3-tuples with
   `server_default`. `sarcasm_possible` and `sensitive_signal` now carry
   `server_default='false'`, matching `98958b6e0e48`'s definitions exactly.

2. **Explicit raise on missing table**: `upgrade()` now raises `RuntimeError` if
   `ai_analysis` does not exist, instead of silently returning. `downgrade()` remains
   tolerant of a missing table — dropping columns from a table that doesn't exist is
   genuinely a no-op.

---

## Design Decisions & Reasoning

### Why align upward (add server_default) rather than downward (remove it)

1. `98958b6e0e48` has already been applied to real databases, including production, which
   was built incrementally through this chain. Rewriting the semantics of an already-applied
   migration changes nothing on those databases — production keeps `DEFAULT false` — while
   every newly created database would get a different schema. That is precisely the schema
   divergence this PR exists to eliminate. Fixes go forward, not backward.

2. The model's `default=False` is a Python-side default. `server_default='false'` is a
   database-side default. They are additive, not contradictory. Having `server_default`
   does not violate the model; it only adds protection for inserts that bypass the ORM,
   such as raw SQL or bulk loads.

### Autogenerate spurious diff warning

Because the `AIAnalysis` model declares `default=False` (Python-side) but does NOT declare
`server_default`, `alembic revision --autogenerate` may report a spurious diff on
`sarcasm_possible`, `sensitive_signal`, and `escalation_needed` — detecting the database-level
`DEFAULT false` that the model does not explicitly declare. **This is expected and must not
be "fixed"** by generating a migration that drops those defaults, as that would re-introduce
the schema divergence between production and fresh databases.

---

## Accepted Limitations (Out of Scope)

### Duplicated `_reflect_columns()` helper
Both migration files contain an identical `_reflect_columns()` function. This is deliberate.
Alembic migrations must be self-contained — extracting a shared helper into a common module
would create a cross-migration import dependency that breaks when historical migration code
is modified.

### Offline mode (`--sql`) incompatibility
The `_reflect_columns()` guard calls `op.get_bind()` and `sa.inspect(bind)`, which require
an active database connection. Running migrations in offline mode (`alembic upgrade --sql`)
will fail. Grepping the entire repository found **zero** uses of `alembic` with `--sql` or
offline mode in scripts, CI, deploy configs, or documentation. All invocations use
`alembic upgrade head` against a live database. This is documented as a known non-issue.

### SQLite `op.drop_column` in downgrade
SQLite does not natively support `DROP COLUMN` in older versions. Alembic's
`batch_alter_table` is the canonical workaround. Since SQLite is only used in throwaway
test harnesses and downgrades are not run in CI or production, this is documented as a
known limitation and is out of scope for this PR.

---

## Repo Hygiene

- **`pgsql/` directory**: Not tracked by Git. Correctly ignored by `.gitignore` (line 50).
- **`backend/.env`**: Not tracked by Git. Correctly ignored by `.gitignore` (line 30).
- **`gh` CLI**: Not installed on this machine. GitHub API queries require `gh` to be
  installed and authenticated.
- **Temporary artifacts**: The test PostgreSQL cluster at
  `AppData/Local/SocialListening_pgdata` and all temporary worktrees have been deleted.

---

## Migration Chain: From-Scratch Rebuild Is Currently Impossible

Running the entire chain from scratch (`alembic upgrade head` on an empty database) fails
at `009_fix_all_tables_schema` due to the use of `CREATE TYPE IF NOT EXISTS` syntax, which
is invalid on all PostgreSQL versions. This is tracked as a separate issue.
The production database was built incrementally, not via a full chain run.
