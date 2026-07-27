# Handoff: Migration 009 PostgreSQL enum syntax

## Current state

- Branch: `fix/188-migration-009-enum-syntax`
- Fix commit: `7398bc9`
- Issue: [#188](https://github.com/nope-chouhi/SocialListening/issues/188)
- Related audit: [#189](https://github.com/nope-chouhi/SocialListening/issues/189)
- Fresh-chain evidence comment:
  [#189 comment](https://github.com/nope-chouhi/SocialListening/issues/189#issuecomment-5086901459)

Revision `009_fix_all_tables_schema` no longer uses PostgreSQL's unsupported
`CREATE TYPE IF NOT EXISTS` syntax. Its eight enum types are created in anonymous `DO`
blocks that ignore only `duplicate_object`. Other errors now propagate through Alembic's
transaction instead of being printed and suppressed. Per-statement `commit()` and
`rollback()` calls were removed.

The migration also guards its two `keyword_groups` repairs with `to_regclass()`.
`keyword_groups` is absent on the fresh `001 -> 008` path, so the old migration only
continued because it swallowed that `ALTER TABLE` error. The explicit guard preserves the
optional repair on incrementally built databases while allowing fail-loud behavior for
required prerequisites.

## PostgreSQL verification

Verification used PostgreSQL 18.3 and fresh UTF-8 test databases.

### Fresh migration chain

`alembic upgrade head` progressed through revision 009 and then failed at the later
`003_add_service_catalog` revision:

```text
INFO  [alembic.runtime.migration] Running upgrade 008_ultimate_sources_fix -> 009_fix_all_tables_schema, Fix all tables schema - comprehensive fix for entire database
INFO  [alembic.runtime.migration] Running upgrade 001_initial -> 002_add_crawl_schedule, Add crawl schedule fields to sources
INFO  [alembic.runtime.migration] Running upgrade 002_add_crawl_schedule -> 003_add_service_catalog, Add service catalog tables
psycopg2.errors.DuplicateObject: type "servicetype" already exists
[SQL: CREATE TYPE servicetype AS ENUM ('crisis_consulting', 'monitoring', 'legal_takedown', 'press_media', 'copyright_protection', 'community_response', 'reputation_management', 'evidence_collection', 'ai_reporting')]
ALEMBIC_EXIT=1
ALEMBIC_VERSION_CONTENTS:
001_initial
```

No change was made to revision 003. It is the next fresh-chain blocker and is recorded on
#189.

### Enum idempotency

After establishing a committed revision-009 baseline, its no-op downgrade moved the stamp
to 008 and the upgrade was run again against the existing enum objects:

```text
DOWNGRADE_EXIT=0
ALEMBIC_VERSION_AFTER_DOWNGRADE:
008_ultimate_sources_fix
RERUN_UPGRADE_EXIT=0
ALEMBIC_VERSION_AFTER_RERUN:
009_fix_all_tables_schema
BASELINE_SHA256=89A1BAE55E06481CE4B1D96313309D8CD4B31E7FD8F60116367197B46295FA97
RERUN_SHA256=89A1BAE55E06481CE4B1D96313309D8CD4B31E7FD8F60116367197B46295FA97
BYTE_IDENTICAL=True
```

Revision 008's existing internal commits initially left `alembic_version` at
`001_initial` despite an exit-zero targeted upgrade, so `alembic stamp
008_ultimate_sources_fix` was used to establish the valid revision-009 baseline. Revision
008 was not changed.

### Fail-loud and atomic rollback

After upgrading and stamping a fresh database at revision 008, the required revision-001
table `keywords` was renamed to `keywords_broken_for_test`. Revision 009 then failed on its
first `keywords` alteration:

```text
psycopg2.errors.UndefinedTable: relation "keywords" does not exist
[SQL: ALTER TABLE keywords ADD COLUMN IF NOT EXISTS group_id INTEGER NOT NULL DEFAULT 1]
FAILURE_TEST_ALEMBIC_EXIT=1
ALEMBIC_VERSION_AFTER_FAILURE:
008_ultimate_sources_fix
ISSUE_188_ENUM_COUNT_AFTER_ROLLBACK:
0
```

The nonzero exit and unchanged revision stamp prove the error was not suppressed. The zero
enum count proves that revision 009's enum DDL rolled back atomically.

## Migration graph ordering

The early migration graph has one root and two sibling paths:

```text
001_initial
├── 008_ultimate_sources_fix -> 009_fix_all_tables_schema
└── 002_add_crawl_schedule  -> 003_add_service_catalog
                                      \
009_fix_all_tables_schema --------------> 010_merge_service_and_schema_heads
```

Alembic completed the 008/009 path before returning to the 002/003 path. Revision 010 merges
the two heads with parents `003_add_service_catalog` and
`009_fix_all_tables_schema`.

## Review and remaining actions

- Protected Alembic diff was explicitly approved.
- Two-axis code review found no hard standards violations and no spec findings.
- Do not fix revision 003 or any other migration on this branch.
- Do not merge automatically; the pull request requires manual maintainer review and merge.

## Suggested skills

- `/code-review` if the branch changes after the recorded review.
- `/resolving-merge-conflicts` if the pull request conflicts with `main`.
- `/handoff` before transferring any follow-up work on the migration audit.
