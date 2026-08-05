"""Fail-closed Alembic startup orchestration.

Production was historically stranded on one side of the c4a1e2f3b5d7
branchpoint.  The repair deliberately executes the missing sibling through
Alembic; it never stamps, guesses, or edits historical revision files.
"""

from __future__ import annotations

import logging
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory

from app.core.config import settings
from app.core.database import engine


logger = logging.getLogger(__name__)

EXPECTED_REVISION = "d72f8a913b21"
STRANDED_REVISION = "7a8e2eb4683b"
MISSING_SIBLING_REVISION = "a1b2c3d4e5f6"
BRANCHPOINT_REVISION = "c4a1e2f3b5d7"
MERGE_REVISION = "914d78ba6c8e"


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
    if stranded is None or sibling is None or merge is None:
        raise StartupMigrationError("required migration lineage is missing")
    if stranded.down_revision != BRANCHPOINT_REVISION:
        raise StartupMigrationError("stranded revision parent is unexpected")
    if sibling.down_revision != BRANCHPOINT_REVISION:
        raise StartupMigrationError("sibling revision parent is unexpected")
    if set(merge.down_revision) != {STRANDED_REVISION, MISSING_SIBLING_REVISION}:
        raise StartupMigrationError("merge revision ancestry is unexpected")

    expected_ancestry = {
        revision.revision
        for revision in script.iterate_revisions(EXPECTED_REVISION, "base")
    }
    if MERGE_REVISION not in expected_ancestry:
        raise StartupMigrationError("repository head does not descend from merge revision")
    return repository_heads


def _prepare_known_lineage(config: Config, script: ScriptDirectory) -> tuple[str, ...]:
    """Repair only the exact supported one-sided branch state."""
    repository_heads = _verify_repository_contract(script)
    database_heads = _database_heads()

    if database_heads == repository_heads:
        logger.info("ALEMBIC_BOOTSTRAP_NOOP revision=%s", EXPECTED_REVISION)
        return repository_heads
    if database_heads != (STRANDED_REVISION,):
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
