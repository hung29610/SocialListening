"""Fail-closed Alembic startup orchestration.

Production has presented two repository-proven historical states. The repair
deliberately executes only normal or explicitly verified Alembic paths; it
never stamps, guesses, or edits historical revision files.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import DateTime, String, Text, inspect

from app.core.config import settings
from app.core.database import engine


logger = logging.getLogger(__name__)

EXPECTED_REVISION = "d72f8a913b21"
STRANDED_REVISION = "7a8e2eb4683b"
MISSING_SIBLING_REVISION = "a1b2c3d4e5f6"
BRANCHPOINT_REVISION = "c4a1e2f3b5d7"
MERGE_REVISION = "914d78ba6c8e"
LEGACY_ANCESTOR_REVISION = "5fe3f0fbfb82"
LEGACY_PARENT_REVISION = "fab61847c68d"
LEGACY_CHILD_REVISION = "a34bcad08e54"
DIAGNOSTIC_REASON_CURRENT = "CURRENT_HEAD"
DIAGNOSTIC_REASON_STRANDED = "SUPPORTED_STRANDED_HEAD"
DIAGNOSTIC_REASON_LEGACY_ANCESTOR = "SUPPORTED_LEGACY_ANCESTOR_HEAD"
DIAGNOSTIC_REASON_SIBLING_SET = "UNSUPPORTED_SIBLING_HEAD_SET"
DIAGNOSTIC_REASON_MERGEPOINT = "UNSUPPORTED_MERGEPOINT_OR_DESCENDANT"
DIAGNOSTIC_REASON_UNKNOWN = "UNKNOWN_REVISION_SET"
REVISION_ID_PATTERN = re.compile(r"^[0-9a-f]{12}$")


class StartupMigrationError(RuntimeError):
    """The checked migration sequence did not reach the repository head."""


def _config(backend_dir: Path) -> Config:
    config = Config(str(backend_dir / "alembic.ini"))
    config.set_main_option("script_location", str(backend_dir / "alembic"))
    if settings.DATABASE_URL:
        config.set_main_option(
            "sqlalchemy.url", settings.DATABASE_URL.replace("%", "%%")
        )
    return config


def _database_heads() -> tuple[str, ...]:
    with engine.connect() as connection:
        return tuple(sorted(MigrationContext.configure(connection).get_current_heads()))


def _verify_repository_contract(script: ScriptDirectory) -> tuple[str, ...]:
    repository_heads = tuple(sorted(script.get_heads()))
    if repository_heads != (EXPECTED_REVISION,):
        raise StartupMigrationError("repository migration head is unexpected")

    stranded = script.get_revision(STRANDED_REVISION)
    sibling = script.get_revision(MISSING_SIBLING_REVISION)
    merge = script.get_revision(MERGE_REVISION)
    legacy = script.get_revision(LEGACY_ANCESTOR_REVISION)
    legacy_child = script.get_revision(LEGACY_CHILD_REVISION)
    if (
        stranded is None
        or sibling is None
        or merge is None
        or legacy is None
        or legacy_child is None
    ):
        raise StartupMigrationError("required migration lineage is missing")
    if stranded.down_revision != BRANCHPOINT_REVISION:
        raise StartupMigrationError("stranded revision parent is unexpected")
    if sibling.down_revision != BRANCHPOINT_REVISION:
        raise StartupMigrationError("sibling revision parent is unexpected")
    if set(merge.down_revision) != {STRANDED_REVISION, MISSING_SIBLING_REVISION}:
        raise StartupMigrationError("merge revision ancestry is unexpected")
    if legacy.down_revision != LEGACY_PARENT_REVISION:
        raise StartupMigrationError("legacy ancestor parent is unexpected")
    if legacy_child.down_revision != LEGACY_ANCESTOR_REVISION:
        raise StartupMigrationError("legacy ancestor child is unexpected")

    expected_ancestry = {
        revision.revision
        for revision in script.iterate_revisions(EXPECTED_REVISION, "base")
    }
    if not {MERGE_REVISION, LEGACY_ANCESTOR_REVISION, LEGACY_CHILD_REVISION}.issubset(
        expected_ancestry
    ):
        raise StartupMigrationError("repository head does not descend from merge revision")
    return repository_heads


def _verify_legacy_ancestor_schema() -> None:
    """Verify only the schema objects created by the historical revision."""
    required_columns = {
        "verification_status",
        "verification_error",
        "verified_at",
        "original_url",
        "canonical_url",
    }
    with engine.connect() as connection:
        inspector = inspect(connection)
        if "mentions" not in inspector.get_table_names():
            raise StartupMigrationError("legacy ancestor schema verification failed")
        columns = {column["name"]: column for column in inspector.get_columns("mentions")}
        if not required_columns.issubset(columns):
            raise StartupMigrationError("legacy ancestor schema verification failed")
        expected_types = {
            "verification_error": Text,
            "verified_at": DateTime,
            "original_url": Text,
            "canonical_url": Text,
        }
        status_type = columns["verification_status"]["type"]
        if (
            not isinstance(status_type, String)
            or status_type.length != 50
            or columns["verification_status"].get("nullable") is not True
        ):
            raise StartupMigrationError("legacy ancestor schema verification failed")
        for name, expected_type in expected_types.items():
            if (
                not isinstance(columns[name]["type"], expected_type)
                or columns[name].get("nullable") is not True
            ):
                raise StartupMigrationError("legacy ancestor schema verification failed")
        if columns["verified_at"]["type"].timezone is not True:
            raise StartupMigrationError("legacy ancestor schema verification failed")
        matching_indexes = [
            index
            for index in inspector.get_indexes("mentions")
            if index.get("name") == "ix_mentions_verification_status"
        ]
        if len(matching_indexes) != 1:
            raise StartupMigrationError("legacy ancestor schema verification failed")
        index = matching_indexes[0]
        if index.get("column_names") != ["verification_status"] or index.get("unique"):
            raise StartupMigrationError("legacy ancestor schema verification failed")


def _revision_ancestry(script: ScriptDirectory, revision: str) -> set[str]:
    """Return repository revision IDs reachable downward from one revision."""
    try:
        return {
            item.revision
            for item in script.iterate_revisions(revision, "base")
        }
    except Exception:  # Alembic raises for IDs absent from the repository graph.
        return set()


def _diagnose_database_heads(
    script: ScriptDirectory,
    database_heads: tuple[str, ...],
    repository_heads: tuple[str, ...],
) -> tuple[str, bool]:
    """Classify a revision set without inferring or broadening repair support."""
    if any(not REVISION_ID_PATTERN.fullmatch(revision) for revision in database_heads):
        return DIAGNOSTIC_REASON_UNKNOWN, False
    current = set(database_heads)
    if database_heads == repository_heads:
        return DIAGNOSTIC_REASON_CURRENT, True
    if database_heads == (STRANDED_REVISION,):
        return DIAGNOSTIC_REASON_STRANDED, True
    if database_heads == (LEGACY_ANCESTOR_REVISION,):
        return DIAGNOSTIC_REASON_LEGACY_ANCESTOR, True
    if current == {STRANDED_REVISION, MISSING_SIBLING_REVISION}:
        return DIAGNOSTIC_REASON_SIBLING_SET, True

    known_ancestry = set().union(
        *(_revision_ancestry(script, revision) for revision in database_heads)
    ) if database_heads else set()
    if MERGE_REVISION in current or MERGE_REVISION in known_ancestry:
        return DIAGNOSTIC_REASON_MERGEPOINT, True
    return DIAGNOSTIC_REASON_UNKNOWN, False


def _log_head_diagnostic(
    script: ScriptDirectory,
    database_heads: tuple[str, ...],
    repository_heads: tuple[str, ...],
) -> None:
    reason, mergepoint_reachable = _diagnose_database_heads(
        script, database_heads, repository_heads
    )
    safe_database_heads = tuple(
        revision for revision in sorted(database_heads)
        if REVISION_ID_PATTERN.fullmatch(revision)
    )
    safe_repository_heads = tuple(
        revision for revision in sorted(repository_heads)
        if REVISION_ID_PATTERN.fullmatch(revision)
    )
    logger.warning(
        "ALEMBIC_BOOTSTRAP_STATE database_revisions=%s repository_heads=%s "
        "stranded_present=%s sibling_present=%s mergepoint_reachable=%s reason=%s",
        ",".join(safe_database_heads) or "none",
        ",".join(safe_repository_heads) or "none",
        str(STRANDED_REVISION in database_heads).lower(),
        str(MISSING_SIBLING_REVISION in database_heads).lower(),
        str(mergepoint_reachable).lower(),
        reason,
    )


def _prepare_known_lineage(config: Config, script: ScriptDirectory) -> tuple[str, ...]:
    """Prepare only exact, repository-proven historical states."""
    repository_heads = _verify_repository_contract(script)
    database_heads = _database_heads()

    if database_heads == repository_heads:
        logger.info("ALEMBIC_BOOTSTRAP_NOOP revision=%s", EXPECTED_REVISION)
        return repository_heads
    if database_heads == (LEGACY_ANCESTOR_REVISION,):
        _verify_legacy_ancestor_schema()
        logger.warning(
            "ALEMBIC_BOOTSTRAP_LEGACY_ANCESTOR_VERIFIED revision=%s child=%s",
            LEGACY_ANCESTOR_REVISION,
            LEGACY_CHILD_REVISION,
        )
        return repository_heads
    if database_heads != (STRANDED_REVISION,):
        _log_head_diagnostic(script, database_heads, repository_heads)
        raise StartupMigrationError("database migration state is not supported by bootstrap")

    logger.warning(
        "ALEMBIC_BOOTSTRAP_REPAIR current=%s sibling=%s",
        STRANDED_REVISION,
        MISSING_SIBLING_REVISION,
    )
    command.upgrade(config, MISSING_SIBLING_REVISION)
    sibling_heads = _database_heads()
    expected_siblings = tuple(sorted((STRANDED_REVISION, MISSING_SIBLING_REVISION)))
    if sibling_heads != expected_siblings:
        raise StartupMigrationError("missing sibling revision did not apply cleanly")
    logger.info(
        "ALEMBIC_BOOTSTRAP_SIBLINGS_VERIFIED revisions=%s,%s",
        expected_siblings[0],
        expected_siblings[1],
    )
    return repository_heads


def run_verified_startup_migrations(backend_dir: Path) -> str:
    """Prepare the known lineage, run normal Alembic, and verify exact head."""
    config = _config(backend_dir)
    script = ScriptDirectory.from_config(config)
    repository_heads = _prepare_known_lineage(config, script)

    command.upgrade(config, "head")
    database_heads = _database_heads()
    if database_heads != repository_heads:
        raise StartupMigrationError("database migration head does not match repository head")

    logger.info("ALEMBIC_HEAD_VERIFIED revision=%s", EXPECTED_REVISION)
    return EXPECTED_REVISION
