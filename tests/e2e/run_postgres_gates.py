"""Run local isolated PostgreSQL migration, benchmark, and tenant gates."""

from __future__ import annotations

import os
import json
import secrets
import subprocess
import sys
from pathlib import Path

from sqlalchemy import create_engine, text


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
PYTHON = Path(sys.executable)
MIGRATION_DB = "social_wave2c_migration"
GATE_DB = "social_wave2c_gates"


def run(args: list[str], *, cwd: Path, env: dict[str, str]) -> None:
    result = subprocess.run(args, cwd=cwd, env=env, check=False)
    if result.returncode:
        raise SystemExit(result.returncode)


def run_tenant_audit(*, env: dict[str, str]) -> None:
    result = subprocess.run(
        [str(PYTHON), "-m", "app.scripts.audit_tenant_integrity"],
        cwd=BACKEND,
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )
    if result.stderr:
        print(result.stderr, file=sys.stderr, end="")
    print(result.stdout, end="")
    if result.returncode:
        raise SystemExit(result.returncode)
    audit = json.loads(result.stdout.strip().splitlines()[-1])
    if audit["null_ownership"] != 0 or audit["inconsistent"] != 0:
        raise RuntimeError("Tenant audit requires zero NULL and inconsistent rows")


admin = create_engine("postgresql://postgres@127.0.0.1:5432/postgres", isolation_level="AUTOCOMMIT")
with admin.connect() as connection:
    for database in (MIGRATION_DB, GATE_DB):
        connection.execute(text("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = :database AND pid <> pg_backend_pid()"), {"database": database})
        connection.execute(text(f'DROP DATABASE IF EXISTS "{database}"'))
        connection.execute(text(f'CREATE DATABASE "{database}"'))
admin.dispose()

base_env = os.environ.copy()
base_env["PYTHONUTF8"] = "1"
base_env["ENVIRONMENT"] = "test"
base_env["SECRET_KEY"] = secrets.token_urlsafe(32)

migration_url = f"postgresql://postgres@127.0.0.1:5432/{MIGRATION_DB}"
migration_engine = create_engine(migration_url)
existing = {
    "source_items": (), "crawl_jobs": ("user_id",), "scan_schedules": ("user_id",),
    "discovery_jobs": ("project_id", "created_by_user_id"), "discovered_sources": ("project_id",),
    "blocked_domains": ("project_id", "blocked_by_user_id"), "report_exports": ("project_id", "requested_by"),
}
with migration_engine.begin() as connection:
    for table, columns in existing.items():
        column_sql = "".join(f", {column} INTEGER" for column in columns)
        connection.execute(text(f"CREATE TABLE {table} (id SERIAL PRIMARY KEY{column_sql})"))
    connection.execute(text("CREATE TABLE mentions (id SERIAL PRIMARY KEY, organization_id INTEGER, project_id INTEGER, keyword_id INTEGER, collected_at TIMESTAMPTZ)"))
migration_engine.dispose()

migration_env = {**base_env, "DATABASE_URL": migration_url}
run([str(PYTHON), "-m", "alembic", "stamp", "7c2e4d6b8a91"], cwd=BACKEND, env=migration_env)
run([str(PYTHON), "-m", "alembic", "upgrade", "head"], cwd=BACKEND, env=migration_env)
run([str(PYTHON), "-m", "alembic", "downgrade", "-1"], cwd=BACKEND, env=migration_env)
run([str(PYTHON), "-m", "alembic", "upgrade", "head"], cwd=BACKEND, env=migration_env)

gate_url = f"postgresql://postgres@127.0.0.1:5432/{GATE_DB}"
gate_env = {
    **base_env,
    "DATABASE_URL": gate_url,
    "TEST_DATABASE_URL": gate_url,
    "E2E_TENANT_A_PASSWORD": secrets.token_urlsafe(24),
    "E2E_TENANT_B_PASSWORD": secrets.token_urlsafe(24),
}
run([str(PYTHON), "tests/e2e/seed.py"], cwd=ROOT, env=gate_env)
run([str(PYTHON), "-m", "pytest", "backend/tests/test_mentions_feed_postgres.py", "-q", "-rs"], cwd=ROOT, env=gate_env)
run_tenant_audit(env=gate_env)
print("POSTGRES_MIGRATION_ROUNDTRIP=PASS")
print("POSTGRES_MENTION_BENCHMARK=PASS")
print("TENANT_AUDIT=PASS")
