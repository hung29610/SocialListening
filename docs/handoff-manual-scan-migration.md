# Handoff: Manual Scan migration chain

## Current state

- PR [#187](https://github.com/nope-chouhi/SocialListening/pull/187) is open and awaiting
  the user's manual merge. Do not merge or enable auto-merge without explicit approval.
- Bug [#188](https://github.com/nope-chouhi/SocialListening/issues/188) tracks the invalid
  PostgreSQL enum syntax in `009_fix_all_tables_schema`.
- Chore [#189](https://github.com/nope-chouhi/SocialListening/issues/189) tracks the corrected
  22-migration historical idempotency audit.
- Chore [#190](https://github.com/nope-chouhi/SocialListening/issues/190) tracks the separate
  LF-normalization proposal.
- The migration verification and corrected audit are in
  `docs/manual-scan-migration-verification.md`.
- Branch `chore/agent-skills-setup` was created from `origin/main`. Its intended 57-file
  setup diff is staged for review but is not committed or pushed.

## Settled facts

- PostgreSQL supports `CREATE TYPE IF NOT EXISTS` in no version.
- `009_fix_all_tables_schema` uses that invalid syntax. Its print-and-continue handling masks
  the first failure until Alembic attempts to update `alembic_version` in an aborted
  transaction.
- The correct idempotent PostgreSQL pattern is a `DO` block with
  `EXCEPTION WHEN duplicate_object`.
- A full migration-chain rebuild from an empty database is currently impossible at revision
  `009`. Production was built incrementally and did not exercise that full clean-build path.
- PR #187 is scope-limited to the overlapping `93a03c74c024` and `98958b6e0e48` migrations
  plus their verification, audit, and handoff documentation.

## Next epic

After PR #187 is manually merged, the next migration epic is issue #189: harden the remaining
22 historical migrations for partially-applied and out-of-band schemas. Issue #188 should be
handled as its own focused bug before claiming that clean database rebuilds work.

## Main worktree state — do not modify without user direction

The primary worktree is on `fix/login-localization-source-coverage-clean`, synchronized with
its remote, and contains unrelated local state:

- Unmerged index entries:
  - `frontend/src/app/dashboard/service-requests/[id]/page.tsx`
  - `frontend/src/app/dashboard/services/page.tsx`
- Unstaged tracked changes:
  - `AGENTS.md`
  - `frontend/src/app/dashboard/mentions/page.tsx`
  - `frontend/src/app/dashboard/projects/new/page.tsx`
  - `frontend/src/app/dashboard/reports/email/page.tsx`
  - `frontend/src/app/dashboard/reports/pdf/PdfPreviewModal.tsx`
- Untracked paths:
  - `.agents/skills/`
  - `docs/agents/`
  - `docs/manual-scan-migration-verification.md`
  - `skills-lock.json`

There is no active merge, rebase, cherry-pick, or revert metadata. Both unmerged paths have
clean working-tree content with no `<<<<<<<`, `=======`, or `>>>>>>>` markers. Both
working-tree blobs differ from `HEAD`; only the index remains unmerged. Do not stage or replace
those working copies until the user reviews their `git diff HEAD -- <file>` output.

The approved scratch artifacts `skills-main/`, `patch.js`, and `patch_scan.py` were deleted
from the primary worktree after their intended skill content was copied to
`chore/agent-skills-setup`.

The repository has no `.gitattributes`; effective `core.autocrlf` is globally `true`. An
isolated simulation of repo-local `core.autocrlf=input` plus `* text=auto eol=lf` changed zero
existing index blobs, but a refreshed checkout would convert 602 of 609 existing tracked
working-tree files from CRLF to LF. Follow issue #190; do not mix that change into other work.

## Suggested skills

- `/handoff` when transferring this state again.
- `/resolving-merge-conflicts` only after the user decides how to handle the orphaned index
  conflicts.
- `/code-review` for the future #188 or #189 implementation branches.
