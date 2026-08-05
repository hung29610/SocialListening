"""Fixed-purpose, fail-closed production migration bootstrap.

This module accepts no command input and exposes no HTTP surface. It repairs
only the repository's explicitly supported one-sided Alembic branch state,
runs the ordinary upgrade to head, and verifies the exact approved head.
"""

import logging
from pathlib import Path

from app.core.migration_startup import run_verified_startup_migrations


logger = logging.getLogger(__name__)


def main() -> None:
    backend_dir = Path(__file__).resolve().parents[2]
    try:
        run_verified_startup_migrations(backend_dir)
    except Exception as exc:
        logger.critical(
            "ALEMBIC_BOOTSTRAP_FAILED error_type=%s",
            type(exc).__name__,
        )
        raise SystemExit(3) from None


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
