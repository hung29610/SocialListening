from datetime import datetime, timezone

import pytest
from sqlalchemy import create_engine, event, select
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
from app.models.crawl import CrawlJob, CrawlJobStatus
from app.models.keyword import Keyword, KeywordGroup
from app.models.mention import AIAnalysis, Mention, SentimentScore
from app.models.report import Report, ReportStatus, ReportType
from app.models.organization import Organization, OrganizationMember
from app.models.source import Source, SourceType
from app.models.user import User
from app.services.tenant_reconciliation import derive_scope_for_row, reconcile_tenant_integrity
from app.core.tenant import apply_tenant_filter
from app.services.ai_assistant_service import _tenant_filters
from app.services.export_service import ExportService


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


def test_reconciliation_parent_and_membership_queries_are_bounded(db):
    _, _, project, _, _ = seed_scope(db)
    db.add_all(
        [Mention(project_id=project.id, content_hash=f"cached-{index}") for index in range(100)]
    )
    db.commit()
    statements = []

    def record_statement(_conn, _cursor, statement, _params, _context, _many):
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement)

    event.listen(db.get_bind(), "before_cursor_execute", record_statement)
    try:
        summary = reconcile_tenant_integrity(db, dry_run=True, batch_size=100)
    finally:
        event.remove(db.get_bind(), "before_cursor_execute", record_statement)

    assert summary.inspected >= 100
    assert summary.repairable >= 100
    assert len(statements) <= 60


def test_ownerless_legacy_mentions_are_invisible_to_tenant_queries(db):
    user, org, project, _, _ = seed_scope(db)
    visible = Mention(
        organization_id=org.id,
        user_id=user.id,
        project_id=project.id,
        content_hash="tenant-visible",
    )
    quarantined = Mention(content_hash="legacy-ownerless")
    db.add_all([visible, quarantined])
    db.commit()

    api_rows = db.execute(
        apply_tenant_filter(select(Mention), Mention, user, include_unverifiable=True)
    ).scalars().all()
    assistant_rows = db.execute(
        select(Mention).where(*_tenant_filters(Mention, user))
    ).scalars().all()

    assert [row.id for row in api_rows] == [visible.id]
    assert [row.id for row in assistant_rows] == [visible.id]
    db.refresh(quarantined)
    assert quarantined.organization_id is None
    assert quarantined.user_id is None
    summary = reconcile_tenant_integrity(db, dry_run=True)
    assert summary.quarantined_legacy == 1
    assert summary.active_integrity_violations == 0


def test_inherited_analysis_is_quarantine_safe_only_with_ownerless_parent(db):
    ownerless = Mention(content_hash="ownerless-parent")
    db.add(ownerless)
    db.flush()
    analysis = AIAnalysis(
        mention_id=ownerless.id,
        sentiment=SentimentScore.NEUTRAL,
        risk_score=0,
        crisis_level=1,
    )
    db.add(analysis)
    db.commit()

    summary = reconcile_tenant_integrity(db, dry_run=True)

    assert summary.quarantined_legacy == 2
    assert summary.active_integrity_violations == 0


def test_inherited_analysis_without_parent_is_not_quarantine_safe(db):
    db.add(
        AIAnalysis(
            mention_id=999999,
            sentiment=SentimentScore.NEUTRAL,
            risk_score=0,
            crisis_level=1,
        )
    )
    db.commit()

    summary = reconcile_tenant_integrity(db, dry_run=True)

    assert summary.quarantined_legacy == 0
    assert summary.active_integrity_violations >= 1


def test_directly_scoped_no_parent_row_is_not_safe_legacy_quarantine(db):
    _, org, _, _, _ = seed_scope(db)
    row = Source(
        organization_id=org.id,
        user_id=None,
        name="Incomplete direct scope",
        source_type=SourceType.RSS,
        url="https://incomplete.test/feed.xml",
    )
    db.add(row)
    db.commit()

    summary = reconcile_tenant_integrity(db, dry_run=True)

    assert summary.active_integrity_violations >= 1
    assert summary.quarantined_legacy == 0


def test_fully_ownerless_true_ambiguity_is_quarantine_safe_and_unchanged(db):
    user, org, project, _, other = seed_scope(db, second_org=True)
    foreign = KeywordGroup(organization_id=other.id, user_id=user.id, name="Foreign")
    db.add(foreign)
    db.flush()
    foreign_job = CrawlJob(
        organization_id=other.id,
        user_id=user.id,
        project_id=foreign.id,
        job_type="legacy",
        status=CrawlJobStatus.COMPLETED,
    )
    ambiguous = Mention(
        organization_id=None,
        user_id=None,
        project_id=project.id,
        job_id=None,
        content_hash="ambiguous-ownerless",
        title="legacy ambiguity",
    )
    db.add_all([foreign_job, ambiguous])
    db.flush()
    ambiguous.job_id = foreign_job.id
    db.commit()

    before = {
        "organization_id": ambiguous.organization_id,
        "user_id": ambiguous.user_id,
        "project_id": ambiguous.project_id,
        "job_id": ambiguous.job_id,
        "content_hash": ambiguous.content_hash,
        "title": ambiguous.title,
    }
    decision = derive_scope_for_row(db, ambiguous)
    first = reconcile_tenant_integrity(db, dry_run=True)
    second = reconcile_tenant_integrity(db, dry_run=True)
    db.refresh(ambiguous)

    assert decision.reason == TenantReason.MULTIPLE_ORGANIZATION_CANDIDATES
    assert first.__dict__ == second.__dict__
    assert first.quarantined_legacy >= 1
    assert first.ownership_conflicts == 0
    assert first.blocking_reason_classes == []
    assert first.conflicting_owner_fields_present is False
    assert {
        "organization_id": ambiguous.organization_id,
        "user_id": ambiguous.user_id,
        "project_id": ambiguous.project_id,
        "job_id": ambiguous.job_id,
        "content_hash": ambiguous.content_hash,
        "title": ambiguous.title,
    } == before


def test_partially_owned_conflict_remains_readiness_blocker(db):
    user, org, project, _, other = seed_scope(db, second_org=True)
    foreign = KeywordGroup(organization_id=other.id, user_id=user.id, name="Foreign")
    db.add(foreign)
    db.flush()
    foreign_job = CrawlJob(
        organization_id=other.id,
        user_id=user.id,
        project_id=foreign.id,
        job_type="legacy",
        status=CrawlJobStatus.COMPLETED,
    )
    row = Mention(
        organization_id=org.id,
        user_id=None,
        project_id=project.id,
        content_hash="unsafe-partial-conflict",
    )
    db.add_all([foreign_job, row])
    db.flush()
    row.job_id = foreign_job.id
    db.commit()

    summary = reconcile_tenant_integrity(db, dry_run=True)

    assert summary.ownership_conflicts >= 1
    assert summary.quarantined_legacy == 0
    assert "MULTIPLE_ORGANIZATION_CANDIDATES" in summary.blocking_reason_classes
    assert summary.conflicting_owner_fields_present is True


def test_ownerless_ambiguity_is_hidden_from_superadmin_and_exports(db):
    user, org, project, _, _ = seed_scope(db)
    user.is_superuser = True
    visible = Mention(
        organization_id=org.id,
        user_id=user.id,
        project_id=project.id,
        content_hash="visible-export",
        title="visible export row",
        url="https://visible.example.test/item",
    )
    hidden = Mention(
        organization_id=None,
        user_id=None,
        project_id=project.id,
        content_hash="hidden-export",
        title="hidden ambiguous row",
        url="https://hidden.example.test/item",
    )
    db.add_all([visible, hidden])
    db.flush()
    visible_alert = Alert(
        organization_id=org.id,
        user_id=user.id,
        project_id=project.id,
        mention_id=visible.id,
        title="visible alert",
        severity=AlertSeverity.LOW,
        status=AlertStatus.NEW,
    )
    hidden_alert = Alert(
        organization_id=None,
        user_id=None,
        project_id=project.id,
        mention_id=hidden.id,
        title="hidden alert",
        severity=AlertSeverity.LOW,
        status=AlertStatus.NEW,
    )
    visible_report = Report(
        organization_id=org.id,
        generated_by=user.id,
        project_id=project.id,
        report_type=ReportType.CUSTOM,
        title="visible report",
        start_date=datetime.now(timezone.utc),
        end_date=datetime.now(timezone.utc),
        status=ReportStatus.COMPLETED,
    )
    hidden_report = Report(
        organization_id=None,
        generated_by=None,
        project_id=project.id,
        report_type=ReportType.CUSTOM,
        title="hidden report",
        start_date=datetime.now(timezone.utc),
        end_date=datetime.now(timezone.utc),
        status=ReportStatus.COMPLETED,
    )
    db.add_all([visible_alert, hidden_alert, visible_report, hidden_report])
    db.commit()

    mention_rows = db.execute(
        apply_tenant_filter(select(Mention), Mention, user, include_unverifiable=True)
    ).scalars().all()
    alert_rows = db.execute(
        apply_tenant_filter(select(Alert), Alert, user)
    ).scalars().all()
    report_rows = db.execute(
        apply_tenant_filter(select(Report), Report, user, "generated_by")
    ).scalars().all()
    csv_text = "".join(ExportService.export_mentions_csv(db, user, {}))
    alert_csv = "".join(ExportService.export_alerts_csv(db, user, {}))

    assert [row.id for row in mention_rows] == [visible.id]
    assert [row.id for row in alert_rows] == [visible_alert.id]
    assert [row.id for row in report_rows] == [visible_report.id]
    assert "visible export row" in csv_text
    assert "hidden ambiguous row" not in csv_text
    assert "visible alert" in alert_csv
    assert "hidden alert" not in alert_csv


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
