from datetime import datetime, timezone

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.core.ownership import (
    TenantOwnershipError,
    TenantReason,
    TenantScope,
    resolve_actor_scope,
    resolve_mention_scope,
    resolve_source_scope,
    validate_explicit_scope,
    validate_schedule_targets,
)
from app.models.alert import Alert, AlertSeverity, AlertStatus
from app.models.keyword import Keyword, KeywordGroup
from app.models.mention import AIAnalysis, Mention, SentimentScore
from app.models.organization import Organization, OrganizationMember
from app.models.source import Source, SourceType
from app.models.user import User
from app.services.tenant_reconciliation import derive_scope_for_row, reconcile_tenant_integrity


@pytest.fixture()
def db(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'tenant.db'}")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False, info={"enforce_tenant_writes": False})
    with factory() as session:
        yield session


def seed_scope(db, *, second_org=False):
    user = User(email="owner@example.test", hashed_password="x", is_active=True)
    org = Organization(name="Tenant A", slug="tenant-a", status="active")
    db.add_all([user, org])
    db.flush()
    user.current_organization_id = org.id
    db.add(OrganizationMember(organization_id=org.id, user_id=user.id, status="active"))
    project = KeywordGroup(organization_id=org.id, user_id=user.id, name="Project A")
    source = Source(
        organization_id=org.id, user_id=user.id, name="RSS", source_type=SourceType.RSS,
        url="https://example.test/feed.xml",
    )
    db.add_all([project, source])
    db.flush()
    other = None
    if second_org:
        other = Organization(name="Tenant B", slug="tenant-b", status="active")
        db.add(other)
        db.flush()
        db.add(OrganizationMember(organization_id=other.id, user_id=user.id, status="active"))
    db.commit()
    return user, org, project, source, other


def test_actor_scope_requires_active_organization(db):
    user, org, project, _, _ = seed_scope(db)
    assert resolve_actor_scope(db, user, project.id).organization_id == org.id


def test_actor_without_current_organization_is_rejected(db):
    user, _, _, _, _ = seed_scope(db)
    user.current_organization_id = None
    with pytest.raises(TenantOwnershipError) as exc:
        resolve_actor_scope(db, user)
    assert exc.value.reason == TenantReason.NO_PARENT_EVIDENCE


def test_inactive_membership_is_rejected(db):
    user, _, _, _, _ = seed_scope(db)
    db.execute(select(OrganizationMember)).scalar_one().status = "suspended"
    db.flush()
    with pytest.raises(TenantOwnershipError) as exc:
        resolve_actor_scope(db, user)
    assert exc.value.reason == TenantReason.USER_ORGANIZATION_MISMATCH


def test_cross_tenant_project_is_rejected(db):
    user, _, _, _, other = seed_scope(db, second_org=True)
    foreign = KeywordGroup(organization_id=other.id, user_id=user.id, name="Foreign")
    db.add(foreign)
    db.flush()
    with pytest.raises(TenantOwnershipError) as exc:
        resolve_actor_scope(db, user, foreign.id)
    assert exc.value.reason == TenantReason.SCOPE_CONFLICT


def test_explicit_worker_scope_accepts_active_member(db):
    user, org, project, _, _ = seed_scope(db)
    scope = validate_explicit_scope(db, org.id, user.id, project.id)
    assert scope.project_id == project.id


def test_explicit_worker_scope_rejects_cross_tenant(db):
    user, org, project, _, other = seed_scope(db, second_org=True)
    with pytest.raises(TenantOwnershipError) as exc:
        validate_explicit_scope(db, other.id, user.id, project.id)
    assert exc.value.reason == TenantReason.SCOPE_CONFLICT


def test_schedule_rejects_cross_tenant_keyword_group(db):
    user, org, project, _, other = seed_scope(db, second_org=True)
    foreign = KeywordGroup(organization_id=other.id, user_id=user.id, name="Foreign schedule target")
    db.add(foreign)
    db.flush()
    with pytest.raises(TenantOwnershipError) as exc:
        validate_schedule_targets(
            db, TenantScope(org.id, user.id), keyword_group_ids=[project.id, foreign.id]
        )
    assert exc.value.reason == TenantReason.SCOPE_CONFLICT


def test_source_without_scope_is_rejected(db):
    source = Source(name="Legacy", source_type=SourceType.RSS, url="https://legacy.test/rss")
    db.add(source)
    db.flush()
    with pytest.raises(TenantOwnershipError) as exc:
        resolve_source_scope(db, source.id)
    assert exc.value.reason == TenantReason.ORPHAN_PARENT


def test_mention_scope_validates_expected_organization(db):
    user, org, project, _, other = seed_scope(db, second_org=True)
    mention = Mention(organization_id=org.id, user_id=user.id, project_id=project.id, content_hash="m1")
    db.add(mention)
    db.flush()
    with pytest.raises(TenantOwnershipError) as exc:
        resolve_mention_scope(db, mention.id, expected_organization_id=other.id)
    assert exc.value.reason == TenantReason.SCOPE_CONFLICT


def test_write_guard_rejects_unscoped_mention(db):
    db.info["enforce_tenant_writes"] = True
    db.add(Mention(content_hash="unscoped"))
    with pytest.raises(TenantOwnershipError) as exc:
        db.flush()
    assert exc.value.reason == TenantReason.NO_PARENT_EVIDENCE
    db.rollback()


def test_write_guard_accepts_scoped_mention(db):
    user, org, project, _, _ = seed_scope(db)
    db.info["enforce_tenant_writes"] = True
    db.add(Mention(organization_id=org.id, user_id=user.id, project_id=project.id, content_hash="scoped"))
    db.flush()


def test_write_guard_rejects_ai_without_parent(db):
    db.info["enforce_tenant_writes"] = True
    db.add(AIAnalysis(sentiment=SentimentScore.NEUTRAL, risk_score=0, crisis_level=1))
    with pytest.raises(TenantOwnershipError):
        db.flush()
    db.rollback()


@pytest.mark.asyncio
async def test_celery_ai_scope_rejects_unscoped_mention():
    from types import SimpleNamespace
    from app.core.ownership import resolve_async_mention_scope

    class FakeAsyncSession:
        async def get(self, model, key):
            return SimpleNamespace(id=key, organization_id=None, user_id=None, project_id=None)

    with pytest.raises(TenantOwnershipError) as exc:
        await resolve_async_mention_scope(FakeAsyncSession(), 1)
    assert exc.value.reason == TenantReason.ORPHAN_PARENT


def test_deterministic_legacy_mention_is_repairable(db):
    user, org, project, _, _ = seed_scope(db)
    mention = Mention(project_id=project.id, content_hash="legacy-repair")
    db.add(mention)
    db.flush()
    decision = derive_scope_for_row(db, mention)
    assert decision.recoverable
    assert decision.scope.organization_id == org.id
    assert decision.scope.user_id == user.id


def test_multiple_membership_candidates_are_quarantined(db):
    user, _, _, _, _ = seed_scope(db, second_org=True)
    row = KeywordGroup(user_id=user.id, name="Ambiguous")
    db.add(row)
    db.flush()
    decision = derive_scope_for_row(db, row)
    assert decision.reason == TenantReason.MULTIPLE_ORGANIZATION_CANDIDATES


def test_broken_parent_is_quarantined(db):
    row = Keyword(group_id=99999, keyword="orphan")
    db.add(row)
    db.flush()
    assert derive_scope_for_row(db, row).reason == TenantReason.BROKEN_RELATIONSHIP_CHAIN


def test_dry_run_is_idempotent_and_non_mutating(db):
    _, _, project, _, _ = seed_scope(db)
    mention = Mention(project_id=project.id, content_hash="dry-run")
    db.add(mention)
    db.commit()
    first = reconcile_tenant_integrity(db, dry_run=True, batch_size=2)
    second = reconcile_tenant_integrity(db, dry_run=True, batch_size=2)
    db.refresh(mention)
    assert first.__dict__ == second.__dict__
    assert mention.organization_id is None and mention.user_id is None


def test_apply_repairs_once_and_quarantine_is_idempotent(db):
    user, org, project, _, _ = seed_scope(db)
    repairable = Mention(project_id=project.id, content_hash="apply-repair")
    orphan = Keyword(group_id=99999, keyword="apply-orphan")
    db.add_all([repairable, orphan])
    db.commit()
    first = reconcile_tenant_integrity(db, dry_run=False, batch_size=2)
    second = reconcile_tenant_integrity(db, dry_run=False, batch_size=2)
    db.refresh(repairable)
    from app.models.tenant_integrity import TenantIntegrityQuarantine
    quarantine_count = len(db.execute(select(TenantIntegrityQuarantine)).scalars().all())
    assert repairable.organization_id == org.id and repairable.user_id == user.id
    assert first.repaired >= 1 and second.repaired == 0
    assert quarantine_count == 1


def test_ci_audit_fails_loudly_for_repairable_null_scope(db):
    from app.scripts.audit_tenant_integrity import run_audit

    _, _, project, _, _ = seed_scope(db)
    db.add(Mention(project_id=project.id, content_hash="audit-null-scope"))
    db.commit()
    result = run_audit(db)
    assert result["inconsistent"] >= 1
    assert result["tables"]["mentions"]["reasons"]["REPAIR_REQUIRED"] >= 1


def test_startup_readiness_uses_bounded_audit_state(monkeypatch):
    from types import SimpleNamespace
    from app.core import tenant_readiness

    session = SimpleNamespace(
        get=lambda model, key: SimpleNamespace(status="ready", unresolved_count=0, conflict_count=0),
        close=lambda: None,
    )
    monkeypatch.setattr(tenant_readiness, "SessionLocal", lambda: session)
    assert tenant_readiness.check_tenant_integrity_readiness() is True


def test_strict_startup_guard_fails_when_audit_not_ready(monkeypatch):
    from app.core import tenant_readiness

    monkeypatch.setattr(tenant_readiness, "check_tenant_integrity_readiness", lambda: False)
    monkeypatch.setenv("TENANT_INTEGRITY_REQUIRE_READY", "true")
    with pytest.raises(RuntimeError, match="readiness check failed"):
        tenant_readiness.enforce_tenant_integrity_readiness()
