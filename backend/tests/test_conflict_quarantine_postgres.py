"""Real PostgreSQL proof for the fixed conflict-quarantine transaction."""

from datetime import datetime, timezone
import json
import os
from uuid import uuid4

import psycopg2
import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from app.core import conflict_quarantine_maintenance as maintenance
from app.core.database import Base
from app.models.discovery import (
    DiscoveredSource,
    DiscoveredSourceStatus,
    DiscoveryJob,
    DiscoveryJobStatus,
)
from app.models.keyword import KeywordGroup
from app.models.organization import Organization, OrganizationMember
from app.models.report import SystemSettings
from app.models.user import User


def _test_database_url() -> str:
    value = os.getenv("TEST_DATABASE_URL", "").strip()
    if not value:
        pytest.skip("TEST_DATABASE_URL is required for the PostgreSQL quarantine proof")
    return value.replace("postgresql+psycopg2://", "postgresql://", 1)


@pytest.fixture()
def postgres_quarantine_database(monkeypatch):
    source = make_url(_test_database_url())
    database_name = f"sl_conflict_quarantine_{uuid4().hex[:12]}"
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
    database_url = source.set(database=database_name).render_as_string(hide_password=False)
    database_engine = create_engine(database_url, pool_pre_ping=True)
    Base.metadata.create_all(database_engine)
    factory = sessionmaker(
        bind=database_engine,
        expire_on_commit=False,
        info={"enforce_tenant_writes": False},
    )
    monkeypatch.setattr(maintenance, "engine", database_engine)
    monkeypatch.setattr(maintenance, "SessionLocal", factory)
    monkeypatch.setattr(maintenance, "_current_heads", lambda: (maintenance.EXPECTED_REVISION,))
    commit = "1" * 40
    monkeypatch.setenv(maintenance.ENABLED_ENV, "true")
    monkeypatch.setenv(maintenance.EXPECTED_COMMIT_ENV, commit)
    monkeypatch.setenv(maintenance.RENDER_COMMIT_ENV, commit)
    try:
        yield factory
    finally:
        database_engine.dispose()
        with admin.cursor() as cursor:
            cursor.execute(
                "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                "WHERE datname = %s AND pid <> pg_backend_pid()",
                (database_name,),
            )
            cursor.execute(f'DROP DATABASE "{database_name}"')
        admin.close()


def _seed_conflict(factory):
    with factory() as db:
        organization = Organization(name="Tenant", slug="tenant", status="active")
        user = User(email="owner@example.test", hashed_password="x", is_active=True)
        db.add_all([organization, user])
        db.flush()
        user.current_organization_id = organization.id
        db.add(OrganizationMember(organization_id=organization.id, user_id=user.id, status="active"))
        first = KeywordGroup(organization_id=organization.id, user_id=user.id, name="First")
        second = KeywordGroup(organization_id=organization.id, user_id=user.id, name="Second")
        db.add_all([first, second])
        db.flush()
        job = DiscoveryJob(
            organization_id=organization.id,
            created_by_user_id=user.id,
            project_id=first.id,
            status=DiscoveryJobStatus.COMPLETED,
        )
        db.add(job)
        db.flush()
        row = DiscoveredSource(
            organization_id=organization.id,
            user_id=user.id,
            project_id=second.id,
            discovery_job_id=job.id,
            domain="example.test",
            status=DiscoveredSourceStatus.CANDIDATE,
            created_at=datetime(2026, 7, 1, tzinfo=timezone.utc),
        )
        db.add(row)
        db.commit()
        return row.id, organization.id, user.id


def test_postgres_failure_rolls_back_then_new_operation_commits_once(
    postgres_quarantine_database, monkeypatch
):
    factory = postgres_quarantine_database
    row_id, organization_id, user_id = _seed_conflict(factory)
    original_post_audit = maintenance._require_post_audit
    monkeypatch.setenv(maintenance.OPERATION_ID_ENV, "conflict-quarantine-pg-rollback")
    monkeypatch.setattr(
        maintenance,
        "_require_post_audit",
        lambda *_args: (_ for _ in ()).throw(
            maintenance.ConflictQuarantineError("forced post-audit failure")
        ),
    )
    with pytest.raises(maintenance.ConflictQuarantineError):
        maintenance.run_conflict_quarantine_if_enabled()
    with factory() as db:
        row = db.get(DiscoveredSource, row_id)
        assert (row.organization_id, row.user_id) == (organization_id, user_id)

    monkeypatch.setattr(maintenance, "_require_post_audit", original_post_audit)
    monkeypatch.setenv(maintenance.OPERATION_ID_ENV, "conflict-quarantine-pg-success")
    evidence = maintenance.run_conflict_quarantine_if_enabled()
    assert evidence["passes_match"] is True
    with factory() as db:
        row = db.get(DiscoveredSource, row_id)
        assert (row.organization_id, row.user_id) == (None, None)
        operations = db.execute(
            select(SystemSettings).where(
                SystemSettings.key.like("conflict_quarantine_maintenance:%")
            )
        ).scalars().all()
        states = sorted(json.loads(operation.value)["status"] for operation in operations)
        assert states == ["completed", "failed"]
