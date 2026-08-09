import os
from pathlib import Path
from uuid import uuid4

import psycopg2
import pytest
from alembic import command
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url

from app.core import migration_startup


def _test_database_url() -> str:
    value = os.getenv("TEST_DATABASE_URL", "").strip()
    if not value:
        pytest.skip("TEST_DATABASE_URL is required for PostgreSQL migration proof")
    return value.replace("postgresql+psycopg2://", "postgresql://", 1)


@pytest.fixture
def legacy_database(monkeypatch):
    source = make_url(_test_database_url())
    database_name = f"sl_ai_usage_drift_{uuid4().hex[:12]}"
    admin = psycopg2.connect(
        host=source.host,
        port=source.port,
        dbname="postgres",
        user=source.username,
        password=source.password,
    )
    admin.autocommit = True
    with admin.cursor() as cursor:
        cursor.execute(f'CREATE DATABASE "{database_name}"')
    admin.close()

    database_url = source.set(database=database_name).render_as_string(hide_password=False)
    backend_dir = Path(__file__).parents[1]
    config = Config(str(backend_dir / "alembic.ini"))
    config.set_main_option("script_location", str(backend_dir / "alembic"))
    config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
    test_engine = create_engine(database_url)
    monkeypatch.setattr(migration_startup, "engine", test_engine)
    monkeypatch.setattr(migration_startup, "_config", lambda _backend_dir: config)

    def database_heads():
        with test_engine.connect() as connection:
            return tuple(
                sorted(MigrationContext.configure(connection).get_current_heads())
            )

    monkeypatch.setattr(migration_startup, "_database_heads", database_heads)
    try:
        yield test_engine, config, backend_dir, database_heads
    finally:
        test_engine.dispose()
        admin = psycopg2.connect(
            host=source.host,
            port=source.port,
            dbname="postgres",
            user=source.username,
            password=source.password,
        )
        admin.autocommit = True
        with admin.cursor() as cursor:
            cursor.execute(f'DROP DATABASE IF EXISTS "{database_name}" WITH (FORCE)')
        admin.close()


def _create_proven_legacy_table(engine):
    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE ai_usage_logs ("
                "id SERIAL PRIMARY KEY, "
                "organization_id INTEGER NULL REFERENCES organizations(id) ON DELETE CASCADE, "
                "user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL, "
                "model_config_id INTEGER NULL REFERENCES ai_model_config(id) ON DELETE SET NULL, "
                "provider VARCHAR(50) NOT NULL, model VARCHAR(255) NOT NULL, "
                "request_type VARCHAR(50) NOT NULL, input_tokens INTEGER NULL, "
                "output_tokens INTEGER NULL, total_tokens INTEGER NULL, "
                "estimated_cost DOUBLE PRECISION NULL, success BOOLEAN NOT NULL, "
                "error_message TEXT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())"
            )
        )
        connection.execute(text("CREATE INDEX ix_ai_usage_logs_id ON ai_usage_logs (id)"))
        connection.execute(
            text(
                "CREATE INDEX ix_ai_usage_logs_organization_id "
                "ON ai_usage_logs (organization_id)"
            )
        )
        connection.execute(
            text("CREATE INDEX ix_ai_usage_logs_user_id ON ai_usage_logs (user_id)")
        )
        connection.execute(
            text(
                "INSERT INTO ai_usage_logs "
                "(provider, model, request_type, success) "
                "VALUES ('test-provider', 'test-model', 'test-request', true)"
            )
        )


def test_exact_production_drift_reaches_head_and_is_restart_safe(legacy_database):
    engine, config, backend_dir, database_heads = legacy_database
    command.upgrade(config, migration_startup.LEGACY_ANCESTOR_REVISION)
    _create_proven_legacy_table(engine)
    assert database_heads() == (migration_startup.LEGACY_ANCESTOR_REVISION,)

    assert (
        migration_startup.run_verified_startup_migrations(backend_dir)
        == migration_startup.EXPECTED_REVISION
    )
    assert database_heads() == (migration_startup.EXPECTED_REVISION,)
    assert migration_startup.run_verified_startup_migrations(backend_dir) == (
        migration_startup.EXPECTED_REVISION
    )

    reflected_indexes = {
        item["name"]: (tuple(item["column_names"]), bool(item["unique"]))
        for item in inspect(engine).get_indexes("ai_usage_logs")
    }
    assert reflected_indexes == {
        "ix_ai_usage_logs_id": (("id",), False),
        "ix_ai_usage_logs_model_config_id": (("model_config_id",), False),
        "ix_ai_usage_logs_organization_id": (("organization_id",), False),
        "ix_ai_usage_logs_user_id": (("user_id",), False),
    }
    with engine.connect() as connection:
        assert connection.execute(text("SELECT COUNT(*) FROM ai_usage_logs")).scalar_one() == 1
