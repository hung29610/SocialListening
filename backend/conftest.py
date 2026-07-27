"""Repository-wide pytest bootstrap.

The application constructs its SQLAlchemy engine during import, so the test
database must be selected before pytest imports any test module.
"""

import os
import shutil
import tempfile
from pathlib import Path

import pytest


_test_db_dir = Path(tempfile.mkdtemp(prefix="nope360-pytest-"))
_default_test_db = f"sqlite:///{(_test_db_dir / 'suite.db').as_posix()}"

os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", _default_test_db)
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("SECRET_KEY", "pytest-only-secret")
os.environ.setdefault("RUN_MIGRATIONS_ON_STARTUP", "false")
os.environ.setdefault("SCHEDULER_ENABLED", "false")
os.environ.setdefault("ENABLE_EMBEDDED_SCHEDULER", "false")
os.environ.setdefault("AUTO_SCAN_ENABLED", "false")
os.environ.setdefault("AUTO_DISCOVERY_ENABLED", "false")
os.environ.setdefault("SOCIAL_CRAWL_ENABLED", "false")
os.environ.setdefault("SMTP_ENABLED", "false")
os.environ.setdefault("WEBHOOK_NOTIFICATIONS_ENABLED", "false")
os.environ.setdefault("ADMIN_SEED_EMAIL", "")


@pytest.fixture(autouse=True)
def isolate_app_dependency_overrides(request):
    """Restore the current test module's FastAPI overrides before each test.

    Several legacy modules register overrides during collection. Without
    resetting them here, the last collected module wins for the whole suite,
    even though each module passes when run alone.
    """

    try:
        from app.core.database import get_db
        from app.core.security import get_current_active_user
        from app.main import app
    except ImportError:
        yield
        return

    app.dependency_overrides.clear()

    for name in ("override_get_db", "_override_get_db"):
        override = getattr(request.module, name, None)
        if callable(override):
            app.dependency_overrides[get_db] = override
            break

    for name in (
        "_override_get_current_active_user",
        "override_get_superuser",
        "override_get_user",
        "_override_get_user",
        "mock_get_current_active_user",
    ):
        override = getattr(request.module, name, None)
        if callable(override):
            app.dependency_overrides[get_current_active_user] = override
            break

    yield
    app.dependency_overrides.clear()


def pytest_sessionfinish() -> None:
    """Remove only the temporary SQLite fallback created for this test run."""

    if "TEST_DATABASE_URL" not in os.environ:
        shutil.rmtree(_test_db_dir, ignore_errors=True)
