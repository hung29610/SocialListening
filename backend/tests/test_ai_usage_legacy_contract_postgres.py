import os
from pathlib import Path
import shutil
from uuid import uuid4

import psycopg2
import pytest
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


def _write_revision(path: Path, revision: str, down_revision, body: str = "pass"):
    path.write_text(
        "from alembic import op\n"
        "import sqlalchemy as sa\n"
        f"revision = {revision!r}\n"
        f"down_revision = {down_revision!r}\n"
        "branch_labels = None\n"
        "depends_on = None\n"
        f"def upgrade():\n    {body}\n"
        "def downgrade():\n    pass\n",
        encoding="utf-8",
    )


@pytest.fixture
def legacy_database(tmp_path, monkeypatch):
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
    script_dir = tmp_path / "alembic"
    versions = script_dir / "versions"
    versions.mkdir(parents=True)
    (script_dir / "env.py").write_text(
        "from alembic import context\n"
        "from sqlalchemy import engine_from_config, pool\n"
        "config = context.config\n"
        "with engine_from_config(config.get_section(config.config_ini_section), prefix='sqlalchemy.', poolclass=pool.NullPool).connect() as connection:\n"
        "    context.configure(connection=connection)\n"
        "    with context.begin_transaction():\n"
        "        context.run_migrations()\n",
        encoding="utf-8",
    )
    _write_revision(
        versions / "legacy_parent.py",
        migration_startup.LEGACY_PARENT_REVISION,
        None,
    )
    _write_revision(
        versions / "legacy.py",
        migration_startup.LEGACY_ANCESTOR_REVISION,
        migration_startup.LEGACY_PARENT_REVISION,
    )
    _write_revision(
        versions / "legacy_child.py",
        migration_startup.LEGACY_CHILD_REVISION,
        migration_startup.LEGACY_ANCESTOR_REVISION,
    )
    _write_revision(
        versions / "branchpoint.py",
        migration_startup.BRANCHPOINT_REVISION,
        migration_startup.LEGACY_CHILD_REVISION,
    )
    shutil.copy2(
        backend_dir / "alembic" / "versions" / "7a8e2eb4683b_add_ai_usage_log.py",
        versions / "7a8e2eb4683b_add_ai_usage_log.py",
    )
    shutil.copy2(
        backend_dir / "alembic" / "versions" / "027_add_system_prompt_to_ai_config.py",
        versions / "027_add_system_prompt_to_ai_config.py",
    )
    _write_revision(
        versions / "merge.py",
        migration_startup.MERGE_REVISION,
        (
            migration_startup.MISSING_SIBLING_REVISION,
            migration_startup.STRANDED_REVISION,
        ),
    )
    _write_revision(
        versions / "long_revision.py",
        migration_startup.LONG_REVISION_ID,
        migration_startup.MERGE_REVISION,
    )
    _write_revision(
        versions / "ai_chat_parent.py",
        "33f8bf51df62",
        migration_startup.LONG_REVISION_ID,
    )
    shutil.copy2(
        backend_dir / "alembic" / "versions" / "7c2e4d6b8a91_add_ai_chat_messages.py",
        versions / "7c2e4d6b8a91_add_ai_chat_messages.py",
    )
    _write_revision(
        versions / "head.py",
        migration_startup.EXPECTED_REVISION,
        "7c2e4d6b8a91",
    )
    config = Config()
    config.set_main_option("script_location", str(script_dir))
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
        yield test_engine, backend_dir, database_heads
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


def _create_proven_legacy_state(engine):
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE organizations (id SERIAL PRIMARY KEY)"))
        connection.execute(text("CREATE TABLE users (id SERIAL PRIMARY KEY)"))
        connection.execute(text("CREATE TABLE ai_model_config (id SERIAL PRIMARY KEY)"))
        connection.execute(
            text(
                "CREATE TABLE mentions (id SERIAL PRIMARY KEY, "
                "verification_status VARCHAR(50) NULL, "
                "verification_error TEXT NULL, verified_at TIMESTAMPTZ NULL, "
                "original_url TEXT NULL, canonical_url TEXT NULL)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX ix_mentions_verification_status "
                "ON mentions (verification_status)"
            )
        )
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
        connection.execute(
            text(
                "CREATE TABLE ai_chat_messages ("
                "id SERIAL PRIMARY KEY, organization_id INTEGER NULL "
                "REFERENCES organizations(id) ON DELETE CASCADE, "
                "user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, "
                "role VARCHAR(20) NOT NULL, content TEXT NOT NULL, "
                "provider VARCHAR(50) NULL, model VARCHAR(255) NULL, "
                "used_tools JSON NULL, error_message TEXT NULL, "
                "created_at TIMESTAMPTZ NOT NULL DEFAULT now())"
            )
        )
        connection.execute(text("INSERT INTO users DEFAULT VALUES"))
        for name, columns in {
            "ix_ai_chat_messages_id": "id",
            "ix_ai_chat_messages_organization_id": "organization_id",
            "ix_ai_chat_messages_user_id": "user_id",
            "ix_ai_chat_messages_created_at": "created_at",
            "idx_ai_chat_user_created": "user_id, created_at",
            "idx_ai_chat_org_created": "organization_id, created_at",
        }.items():
            connection.execute(
                text(f"CREATE INDEX {name} ON ai_chat_messages ({columns})")
            )
        connection.execute(
            text(
                "INSERT INTO ai_chat_messages (user_id, role, content) "
                "VALUES (1, 'user', 'preserve-me')"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE alembic_version ("
                "version_num VARCHAR(32) NOT NULL PRIMARY KEY)"
            )
        )
        connection.execute(
            text("INSERT INTO alembic_version (version_num) VALUES (:revision)"),
            {"revision": migration_startup.LEGACY_ANCESTOR_REVISION},
        )


def test_exact_production_drift_reaches_head_and_is_restart_safe(legacy_database):
    engine, backend_dir, database_heads = legacy_database
    _create_proven_legacy_state(engine)
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
        assert connection.execute(text("SELECT COUNT(*) FROM ai_chat_messages")).scalar_one() == 1
