import os
from pathlib import Path
from uuid import uuid4

from alembic import command
from alembic.config import Config
from alembic.migration import MigrationContext
import psycopg2
import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from app.core import free_mvp_maintenance, migration_startup, tenant_readiness
from app.services.tenant_reconciliation import ReconciliationSummary


def _test_database_url() -> str:
    value = os.getenv("TEST_DATABASE_URL", "").strip()
    if not value:
        pytest.skip("TEST_DATABASE_URL is required for the production-sequence proof")
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
def production_sequence_database(tmp_path, monkeypatch, request):
    source = make_url(_test_database_url())
    database_name = f"sl_post_repair_{uuid4().hex[:12]}"
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

    database_url = source.set(database=database_name).render_as_string(
        hide_password=False
    )
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
        versions / "parent.py",
        migration_startup.LEGACY_PARENT_REVISION,
        None,
        "op.create_table('mentions', sa.Column('id', sa.Integer(), primary_key=True))\n"
        "    op.create_table('system_settings', sa.Column('id', sa.Integer(), primary_key=True), sa.Column('key', sa.String(255), nullable=False, unique=True), sa.Column('value', sa.Text()), sa.Column('value_type', sa.String(20)), sa.Column('description', sa.Text()), sa.Column('is_public', sa.Boolean()))",
    )
    _write_revision(
        versions / "legacy.py",
        migration_startup.LEGACY_ANCESTOR_REVISION,
        migration_startup.LEGACY_PARENT_REVISION,
        "op.add_column('mentions', sa.Column('verification_status', sa.String(50), nullable=True))\n"
        "    op.add_column('mentions', sa.Column('verification_error', sa.Text(), nullable=True))\n"
        "    op.add_column('mentions', sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True))\n"
        "    op.add_column('mentions', sa.Column('original_url', sa.Text(), nullable=True))\n"
        "    op.add_column('mentions', sa.Column('canonical_url', sa.Text(), nullable=True))\n"
        "    op.create_index('ix_mentions_verification_status', 'mentions', ['verification_status'], unique=False)",
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
        "op.create_table('branch_probe', sa.Column('id', sa.Integer(), primary_key=True))",
    )
    _write_revision(
        versions / "stranded.py",
        migration_startup.STRANDED_REVISION,
        migration_startup.BRANCHPOINT_REVISION,
        "op.create_table('ai_usage_logs', sa.Column('id', sa.Integer(), primary_key=True))",
    )
    _write_revision(
        versions / "sibling.py",
        migration_startup.MISSING_SIBLING_REVISION,
        migration_startup.BRANCHPOINT_REVISION,
        "op.add_column('branch_probe', sa.Column('sibling_applied', sa.Boolean()))",
    )
    _write_revision(
        versions / "merge.py",
        migration_startup.MERGE_REVISION,
        (migration_startup.MISSING_SIBLING_REVISION, migration_startup.STRANDED_REVISION),
    )
    head_body = (
        "raise RuntimeError('injected bounded migration failure')"
        if "post_branch_failure" in request.node.name
        else "op.create_table('tenant_integrity_audit_state', sa.Column('id', sa.Integer(), primary_key=True), sa.Column('status', sa.String(20), nullable=False), sa.Column('unresolved_count', sa.Integer(), nullable=False), sa.Column('conflict_count', sa.Integer(), nullable=False), sa.Column('details', sa.JSON(), nullable=False), sa.Column('last_run_at', sa.DateTime(timezone=True)), sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))"
    )
    _write_revision(
        versions / "head.py",
        migration_startup.EXPECTED_REVISION,
        migration_startup.MERGE_REVISION,
        head_body,
    )

    config = Config()
    config.set_main_option("script_location", str(script_dir))
    config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
    engine = create_engine(database_url)
    TestSession = sessionmaker(bind=engine, expire_on_commit=False)
    command.upgrade(config, migration_startup.LEGACY_ANCESTOR_REVISION)
    with engine.begin() as connection:
        connection.execute(text("DROP INDEX ix_mentions_verification_status"))
        connection.execute(
            text(
                "ALTER TABLE mentions ALTER COLUMN verification_status "
                "TYPE VARCHAR(100)"
            )
        )

    monkeypatch.setattr(migration_startup, "_config", lambda _backend_dir: config)
    monkeypatch.setattr(migration_startup, "engine", engine)
    monkeypatch.setattr(
        migration_startup,
        "_database_heads",
        lambda: _heads(engine),
    )
    monkeypatch.setattr(free_mvp_maintenance, "engine", engine)
    monkeypatch.setattr(free_mvp_maintenance, "SessionLocal", TestSession)
    monkeypatch.setattr(tenant_readiness, "SessionLocal", TestSession)
    try:
        yield engine
    finally:
        engine.dispose()
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


def _heads(engine) -> tuple[str, ...]:
    with engine.connect() as connection:
        return tuple(sorted(MigrationContext.configure(connection).get_current_heads()))


def _status_contract(engine):
    status = next(
        column
        for column in inspect(engine).get_columns("mentions")
        if column["name"] == "verification_status"
    )
    indexes = [
        index
        for index in inspect(engine).get_indexes("mentions")
        if index["name"] == migration_startup.SCHEMA_CONTRACT_INDEX
    ]
    return migration_startup._normalized_schema_type(status["type"]), indexes


def test_repaired_legacy_sequence_reaches_head_then_readiness(
    production_sequence_database, monkeypatch
):
    engine = production_sequence_database
    assert _heads(engine) == (migration_startup.LEGACY_ANCESTOR_REVISION,)
    assert migration_startup.run_verified_startup_migrations(Path("backend")) == migration_startup.EXPECTED_REVISION
    assert _heads(engine) == (migration_startup.EXPECTED_REVISION,)
    assert _status_contract(engine)[0] == "varchar_50"
    assert len(_status_contract(engine)[1]) == 1
    assert tenant_readiness.check_tenant_integrity_readiness() is False

    clean = ReconciliationSummary(dry_run=True)
    monkeypatch.setenv(free_mvp_maintenance.ENABLED_ENV, "true")
    monkeypatch.setenv(free_mvp_maintenance.OPERATION_ID_ENV, "postgres-sequence-01")
    monkeypatch.setattr(
        free_mvp_maintenance,
        "reconcile_tenant_integrity",
        lambda *_args, **_kwargs: clean,
    )
    evidence = free_mvp_maintenance.run_free_mvp_maintenance_if_enabled()
    assert evidence["passes_match"] is True
    assert tenant_readiness.check_tenant_integrity_readiness() is True


def test_post_branch_failure_rolls_back_upgrade_but_not_prior_schema_repair(
    production_sequence_database,
):
    engine = production_sequence_database
    with pytest.raises(RuntimeError, match="injected bounded migration failure"):
        migration_startup.run_verified_startup_migrations(Path("backend"))
    assert _heads(engine) == (migration_startup.LEGACY_ANCESTOR_REVISION,)
    status_type, indexes = _status_contract(engine)
    assert status_type == "varchar_50"
    assert len(indexes) == 1
    assert "ai_usage_logs" not in inspect(engine).get_table_names()
    assert tenant_readiness.check_tenant_integrity_readiness() is False
