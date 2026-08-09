"""Single authoritative database and tenant-readiness startup path."""

from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
import logging
import os
from pathlib import Path

from sqlalchemy import text

from app.core.database import engine
from app.core.migration_startup import StartupMigrationError, run_verified_startup_migrations
from app.core import startup_state
from app.core.tenant_readiness_bootstrap import establish_tenant_readiness


logger = logging.getLogger(__name__)
_STARTUP_ADVISORY_LOCK_ID = 0x534F4349414C360  # Stable, project-specific signed bigint.


@dataclass(frozen=True)
class StartupOutcome:
    migration_revision: str
    tenant_ready: bool
    reason_code: str


@contextmanager
def _startup_singleton_lock():
    connection = engine.connect()
    locked = False
    try:
        if engine.dialect.name == "postgresql":
            connection.execute(
                text("SELECT pg_advisory_lock(:lock_id)"),
                {"lock_id": _STARTUP_ADVISORY_LOCK_ID},
            )
            locked = True
        yield
    finally:
        if locked:
            try:
                connection.execute(
                    text("SELECT pg_advisory_unlock(:lock_id)"),
                    {"lock_id": _STARTUP_ADVISORY_LOCK_ID},
                )
            except Exception:
                logger.error(
                    "STARTUP_STATE phase=lock status=failed reason=ADVISORY_UNLOCK_FAILED"
                )
        connection.close()


def run_startup_orchestrator(backend_dir: Path, runtime: str) -> StartupOutcome:
    startup_state.reset_for_startup(runtime)
    if (
        os.getenv("ENVIRONMENT", "").lower() == "test"
        and os.getenv("RUN_MIGRATIONS_ON_STARTUP", "true").lower() == "false"
    ):
        # Isolated CORS/Playwright harnesses may use SQLite or a model-created
        # schema. Production can never enter this explicit two-condition path.
        startup_state.set_migration_ready("test-fixture")
        startup_state.set_tenant_readiness(True, "TEST_FIXTURE_READY")
        logger.info(
            "STARTUP_STATE phase=complete status=ready reason=TEST_FIXTURE_READY"
        )
        return StartupOutcome("test-fixture", True, "TEST_FIXTURE_READY")

    logger.info("STARTUP_STATE phase=lock status=waiting reason=STARTUP_SINGLETON")
    try:
        with _startup_singleton_lock():
            logger.info("STARTUP_STATE phase=migration status=running reason=VERIFY_AND_UPGRADE")
            revision = run_verified_startup_migrations(backend_dir)
            startup_state.set_migration_ready(revision)
            logger.info(
                "STARTUP_STATE phase=migration status=ready reason=EXACT_HEAD revision=%s",
                revision,
            )
            result = establish_tenant_readiness()
            startup_state.set_tenant_readiness(result.ready, result.reason_code)
    except StartupMigrationError:
        startup_state.set_migration_failed("MIGRATION_CONTRACT_FAILED")
        logger.critical(
            "STARTUP_STATE phase=migration status=failed reason=MIGRATION_CONTRACT_FAILED"
        )
        raise
    except Exception as exc:
        startup_state.set_migration_failed("MIGRATION_OR_LOCK_FAILED")
        logger.critical(
            "STARTUP_STATE phase=migration status=failed reason=MIGRATION_OR_LOCK_FAILED error_type=%s",
            type(exc).__name__,
        )
        raise StartupMigrationError("startup migration orchestration failed") from exc

    return StartupOutcome(revision, result.ready, result.reason_code)
