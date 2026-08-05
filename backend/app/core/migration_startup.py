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


def run_verified_startup_migrations(backend_dir: Path) -> str:
    """Upgrade, repair the one known split lineage, and verify exact head."""
    config = _config(backend_dir)
    repository_heads = tuple(sorted(ScriptDirectory.from_config(config).get_heads()))
    if repository_heads != (EXPECTED_REVISION,):
        raise StartupMigrationError("repository migration head is unexpected")

    command.upgrade(config, "head")
    database_heads = _database_heads()

    if database_heads == (STRANDED_REVISION,):
        logger.warning(
            "ALEMBIC_LINEAGE_REPAIR_REQUIRED current=%s sibling=%s",
            STRANDED_REVISION,
            MISSING_SIBLING_REVISION,
        )
        command.upgrade(config, MISSING_SIBLING_REVISION)
        sibling_heads = _database_heads()
        if sibling_heads != tuple(
            sorted((STRANDED_REVISION, MISSING_SIBLING_REVISION))
        ):
            raise StartupMigrationError("missing sibling revision did not apply cleanly")
        command.upgrade(config, "head")
        database_heads = _database_heads()

    if database_heads != repository_heads:
        raise StartupMigrationError("database migration head does not match repository head")

    logger.info("ALEMBIC_HEAD_VERIFIED revision=%s", EXPECTED_REVISION)
    return EXPECTED_REVISION
