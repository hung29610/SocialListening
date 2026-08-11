from datetime import datetime, timezone
import json

import pytest
from sqlalchemy import create_engine, select
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
from app.models.tenant_integrity import TenantIntegrityQuarantine
from app.models.user import User


@pytest.fixture()
def isolated_database(tmp_path, monkeypatch):
    database_engine = create_engine(f"sqlite:///{tmp_path / 'quarantine.db'}")
    Base.metadata.create_all(database_engine)
    factory = sessionmaker(
        bind=database_engine,
        expire_on_commit=False,
        info={"enforce_tenant_writes": False},
    )
    monkeypatch.setattr(maintenance, "engine", database_engine)
    monkeypatch.setattr(maintenance, "SessionLocal", factory)
    monkeypatch.setattr(
        maintenance,
        "_current_heads",
        lambda: (maintenance.EXPECTED_REVISION,),
    )
    return factory


def _seed_scope_conflict(factory, *, created_at=None):
    with factory() as db:
        organization = Organization(name="Tenant", slug="tenant", status="active")
        first_user = User(email="first@example.test", hashed_password="x", is_active=True)
        second_user = User(email="second@example.test", hashed_password="x", is_active=True)
        db.add_all([organization, first_user, second_user])
        db.flush()
        first_user.current_organization_id = organization.id
        second_user.current_organization_id = organization.id
        db.add_all(
            [
                OrganizationMember(
                    organization_id=organization.id,
                    user_id=first_user.id,
                    status="active",
                ),
                OrganizationMember(
                    organization_id=organization.id,
                    user_id=second_user.id,
                    status="active",
                ),
            ]
        )
        project = KeywordGroup(
            organization_id=organization.id,
            user_id=first_user.id,
            name="Project",
        )
        second_project = KeywordGroup(
            organization_id=organization.id,
            user_id=first_user.id,
            name="Second project",
        )
        db.add_all([project, second_project])
        db.flush()
        discovery_job = DiscoveryJob(
            organization_id=organization.id,
            created_by_user_id=first_user.id,
            project_id=project.id,
            status=DiscoveryJobStatus.COMPLETED,
        )
        db.add(discovery_job)
        db.flush()
        discovered_source = DiscoveredSource(
            organization_id=organization.id,
            user_id=first_user.id,
            project_id=second_project.id,
            discovery_job_id=discovery_job.id,
            domain="example.test",
            status=DiscoveredSourceStatus.CANDIDATE,
            created_at=created_at or datetime(2026, 7, 1, tzinfo=timezone.utc),
        )
        db.add(discovered_source)
        db.commit()
        return discovered_source.id, organization.id, first_user.id, second_project.id


def _enable(monkeypatch, operation_id="conflict-quarantine-test-01"):
    monkeypatch.setenv(maintenance.ENABLED_ENV, "true")
    monkeypatch.setenv(maintenance.OPERATION_ID_ENV, operation_id)
    commit = "1" * 40
    monkeypatch.setenv(maintenance.EXPECTED_COMMIT_ENV, commit)
    monkeypatch.setenv(maintenance.RENDER_COMMIT_ENV, commit)


def test_flag_absent_is_a_noop_without_database_access(monkeypatch):
    monkeypatch.delenv(maintenance.ENABLED_ENV, raising=False)
    monkeypatch.setattr(
        maintenance,
        "SessionLocal",
        lambda: pytest.fail("disabled maintenance must not open the database"),
    )

    assert maintenance.run_conflict_quarantine_if_enabled() is None


def test_one_time_apply_changes_only_direct_owner_fields_and_is_idempotent(
    isolated_database, monkeypatch, caplog
):
    factory = isolated_database
    row_id, organization_id, user_id, project_id = _seed_scope_conflict(factory)
    _enable(monkeypatch)

    evidence = maintenance.run_conflict_quarantine_if_enabled()

    assert evidence["revision"] == maintenance.EXPECTED_REVISION
    assert evidence["passes_match"] is True
    assert evidence["preflight"]["candidate_groups"] == {
        "discovered_sources:SCOPE_CONFLICT": 1
    }
    assert evidence["preflight"]["unsafe_groups"] == {}
    assert evidence["post_audit"]["ownership_conflicts"] == 0
    assert "operation_id" not in json.dumps(evidence).lower()
    assert "conflict-quarantine-test-01" not in caplog.text
    assert "owner@example.test" not in caplog.text
    assert "example.test" not in caplog.text

    with factory() as db:
        row = db.get(DiscoveredSource, row_id)
        assert row.organization_id is None
        assert row.user_id is None
        assert row.project_id == project_id
        assert row.status == DiscoveredSourceStatus.CANDIDATE
        quarantine = db.execute(select(TenantIntegrityQuarantine)).scalar_one()
        private = quarantine.evidence["conflict_quarantine_apply"]
        assert private["owner_before"] == {
            "organization_id": organization_id,
            "user_id": user_id,
        }
        assert private["owner_after"] == {
            "organization_id": None,
            "user_id": None,
        }
        operation = db.execute(
            select(SystemSettings).where(
                SystemSettings.key
                == "conflict_quarantine_maintenance:conflict-quarantine-test-01"
            )
        ).scalar_one()
        assert json.loads(operation.value)["status"] == "completed"

    assert maintenance.run_conflict_quarantine_if_enabled() == evidence
    with factory() as db:
        assert len(db.execute(select(TenantIntegrityQuarantine)).scalars().all()) == 1


def test_newer_rows_are_not_allowlisted_and_operation_rolls_back(
    isolated_database, monkeypatch
):
    factory = isolated_database
    row_id, organization_id, user_id, _ = _seed_scope_conflict(
        factory,
        created_at=datetime(2026, 8, 3, tzinfo=timezone.utc),
    )
    _enable(monkeypatch, "conflict-quarantine-test-02")

    with pytest.raises(maintenance.ConflictQuarantineError):
        maintenance.run_conflict_quarantine_if_enabled()

    with factory() as db:
        row = db.get(DiscoveredSource, row_id)
        assert (row.organization_id, row.user_id) == (organization_id, user_id)
        assert db.execute(select(TenantIntegrityQuarantine)).scalars().all() == []
        operation = db.execute(select(SystemSettings)).scalar_one()
        assert json.loads(operation.value)["status"] == "failed"


def test_post_audit_failure_rolls_back_source_and_before_image(
    isolated_database, monkeypatch
):
    factory = isolated_database
    row_id, organization_id, user_id, _ = _seed_scope_conflict(factory)
    _enable(monkeypatch, "conflict-quarantine-test-03")
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
        assert db.execute(select(TenantIntegrityQuarantine)).scalars().all() == []


def test_wrong_revision_fails_before_operation_claim(isolated_database, monkeypatch):
    factory = isolated_database
    _enable(monkeypatch, "conflict-quarantine-test-04")
    monkeypatch.setattr(maintenance, "_current_heads", lambda: ("unexpected",))

    with pytest.raises(maintenance.ConflictQuarantineError):
        maintenance.run_conflict_quarantine_if_enabled()

    with factory() as db:
        assert db.execute(select(SystemSettings)).scalars().all() == []


def test_commit_mismatch_fails_before_database_access(monkeypatch):
    _enable(monkeypatch, "conflict-quarantine-test-05")
    monkeypatch.setenv(maintenance.RENDER_COMMIT_ENV, "2" * 40)
    monkeypatch.setattr(
        maintenance,
        "SessionLocal",
        lambda: pytest.fail("commit mismatch must fail before database access"),
    )

    with pytest.raises(maintenance.ConflictQuarantineError):
        maintenance.run_conflict_quarantine_if_enabled()


def test_fixed_purpose_module_has_no_apply_or_http_command_surface():
    source = __import__("pathlib").Path(maintenance.__file__).read_text(encoding="utf-8")
    assert "dry_run=False" not in source
    assert "--apply" not in source
    assert "@router" not in source
    assert "subprocess" not in source
