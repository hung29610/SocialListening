from datetime import datetime, timezone
from contextlib import contextmanager

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.alert import Alert
from app.models.crawl import CrawlJob, ScanSchedule
from app.models.discovery import DiscoveredSource, DiscoveredSourceStatus
from app.models.keyword import Keyword, KeywordGroup
from app.models.mention import AIAnalysis, Mention
from app.models.organization import Organization, OrganizationMember
from app.models.report import Report, ReportExport, ReportType
from app.models.source import Source, SourceType
from app.models.source_item import SourceItem
from app.models.user import User
from app.core.ownership import TenantScope


@pytest.fixture()
def tenant_db(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'writers.db'}")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False, info={"enforce_tenant_writes": True})
    with factory() as db:
        db.info["enforce_tenant_writes"] = False
        user = User(id=11, email="writer@example.test", hashed_password="x", current_organization_id=21)
        org = Organization(id=21, name="Writer Org", slug="writer-org", status="active")
        db.add_all([user, org])
        db.flush()
        db.add(OrganizationMember(organization_id=21, user_id=11, status="active"))
        project = KeywordGroup(id=31, organization_id=21, user_id=11, name="Writer Project")
        source = Source(
            id=41, organization_id=21, user_id=11, name="Writer RSS",
            source_type=SourceType.RSS, url="https://example.test/rss",
        )
        db.add_all([project, source, Keyword(group_id=31, keyword="nope360")])
        db.commit()
        db.info["enforce_tenant_writes"] = True
        yield db, user, project, source


def _analysis_result(risk=10):
    return {
        "status": "success", "sentiment": "neutral", "risk_score": risk,
        "crisis_level": 1, "summary_vi": "summary", "suggested_action": "monitor",
        "responsible_department": "PR", "confidence_score": 90,
        "ai_provider": "test", "model_version": "test", "processing_time_ms": 1,
    }


def test_rss_writer_stamps_item_mention_analysis_and_alert(monkeypatch, tenant_db):
    db, _, project, source = tenant_db
    from app.services import ai_service, rss_collector

    monkeypatch.setattr(rss_collector, "fetch_and_parse_feed", lambda _: {
        "success": True,
        "items": [{
            "url": "https://example.test/article", "canonical_url": "https://example.test/article",
            "original_url": None, "title": "Nope360 incident", "snippet": "nope360 severe",
            "html_description": "nope360 severe", "author": "Reporter",
            "published_at": datetime.now(timezone.utc), "guid": "writer-1",
            "image_url": None, "media_url": None, "media_thumbnail": None, "domain": "example.test",
        }],
    })
    monkeypatch.setattr(ai_service, "analyze_mention", lambda *_: _analysis_result(90))

    result = rss_collector.run_rss_collector(db, source_ids=[source.id], ad_hoc_project_id=project.id)
    assert result["mentions_created"] == 1
    item = db.execute(select(SourceItem)).scalar_one()
    mention = db.execute(select(Mention)).scalar_one()
    alert = db.execute(select(Alert)).scalar_one()
    assert (item.organization_id, item.user_id) == (21, 11)
    assert (mention.organization_id, mention.user_id, mention.project_id) == (21, 11, 31)
    assert db.execute(select(AIAnalysis).where(AIAnalysis.mention_id == mention.id)).scalar_one()
    assert (alert.organization_id, alert.user_id, alert.project_id) == (21, 11, 31)


def test_direct_source_crawl_uses_job_scope(monkeypatch, tenant_db):
    db, _, project, source = tenant_db
    from app.services import ai_service, crawl_service

    job = CrawlJob(
        organization_id=21, user_id=11, project_id=31, job_type="manual",
        source_ids=[source.id], meta_data={},
    )
    db.add(job)
    db.commit()
    monkeypatch.setattr(crawl_service, "validate_rss_feed", lambda _: (True, "", ""))
    monkeypatch.setattr(crawl_service, "crawl_rss_feed", lambda _: {
        "success": True,
        "articles": [{
            "url": "https://example.test/direct", "title": "Nope360 direct",
            "content": "nope360 direct content", "author": "Reporter",
            "published_at": datetime.now(timezone.utc),
        }],
    })
    monkeypatch.setattr(ai_service, "analyze_mention", lambda *_: _analysis_result())
    result = crawl_service.crawl_source(db, source.id, job_id=job.id)
    assert result["mentions_new"] == 1
    mention = db.execute(select(Mention).where(Mention.job_id == job.id)).scalar_one()
    assert (mention.organization_id, mention.user_id, mention.project_id) == (21, 11, 31)


def test_scheduled_source_scan_creates_scoped_job(monkeypatch, tenant_db):
    db, _, _, source = tenant_db
    from app.services import scheduler_service

    monkeypatch.setattr(scheduler_service, "get_db", lambda: db)
    monkeypatch.setattr(scheduler_service, "has_active_job", lambda *_: False)
    monkeypatch.setattr("app.services.crawl_service.crawl_source", lambda *_args, **_kwargs: {"mentions_new": 0, "mentions_found": 0})
    scheduler_service.execute_scheduled_scan(source.id)
    job = db.execute(select(CrawlJob).where(CrawlJob.job_type == "scheduled")).scalar_one()
    assert (job.organization_id, job.user_id, job.project_id) == (21, 11, 31)


def test_scheduled_discovery_uses_keyword_group_tenant_scope(monkeypatch, tenant_db):
    db, _, project, _ = tenant_db
    from app.models.discovery import DiscoveryJob
    from app.services import discovery_service, scheduler_service

    @contextmanager
    def acquired_lock(*_args, **_kwargs):
        yield True

    monkeypatch.setattr(scheduler_service, "get_db", lambda: db)
    monkeypatch.setattr(scheduler_service, "scheduler_lock", acquired_lock)
    monkeypatch.setattr(discovery_service, "run_discovery_job", lambda *_args: None)

    scheduler_service.run_scheduled_discovery_scans()

    job = db.execute(select(DiscoveryJob).where(DiscoveryJob.project_id == project.id)).scalar_one()
    assert (job.organization_id, job.created_by_user_id, job.project_id) == (21, 11, 31)


def test_scan_schedule_uses_durable_scope_after_user_switches_org(monkeypatch, tenant_db):
    db, user, project, _ = tenant_db
    from app.models.organization import Organization, OrganizationMember
    from app.services import scheduler_service

    db.info["enforce_tenant_writes"] = False
    db.add(Organization(id=22, name="Other Org", slug="other-org", status="active"))
    db.flush()
    db.add(OrganizationMember(organization_id=22, user_id=user.id, status="active"))
    schedule = ScanSchedule(
        organization_id=21,
        user_id=user.id,
        name="Durable schedule",
        cron_expression="*/15 * * * *",
        source_group_ids=[],
        keyword_group_ids=[project.id],
        is_active=True,
    )
    db.add(schedule)
    user.current_organization_id = 22
    db.commit()
    db.info["enforce_tenant_writes"] = True

    monkeypatch.setattr(scheduler_service, "get_db", lambda: db)
    monkeypatch.setattr("app.services.scan_service.execute_scan", lambda **_kwargs: None)
    result = scheduler_service.execute_scan_schedule_job(schedule.id)

    job = db.execute(select(CrawlJob).where(CrawlJob.scan_schedule_id == schedule.id)).scalar_one()
    assert result["success"] is True
    assert (job.organization_id, job.user_id, job.project_id) == (21, 11, 31)


def test_scan_schedule_rejects_cross_tenant_project_before_job_insert(monkeypatch, tenant_db):
    db, user, _, _ = tenant_db
    from app.models.organization import Organization, OrganizationMember
    from app.services import scheduler_service

    db.info["enforce_tenant_writes"] = False
    db.add(Organization(id=22, name="Other Org", slug="other-org", status="active"))
    db.flush()
    db.add(OrganizationMember(organization_id=22, user_id=user.id, status="active"))
    foreign_project = KeywordGroup(id=32, organization_id=22, user_id=user.id, name="Foreign")
    schedule = ScanSchedule(
        organization_id=21,
        user_id=user.id,
        name="Invalid schedule",
        cron_expression="*/15 * * * *",
        source_group_ids=[],
        keyword_group_ids=[foreign_project.id],
        is_active=True,
    )
    db.add_all([foreign_project, schedule])
    db.commit()
    schedule_id = schedule.id
    db.info["enforce_tenant_writes"] = True

    monkeypatch.setattr(scheduler_service, "get_db", lambda: db)
    result = scheduler_service.execute_scan_schedule_job(schedule_id)

    assert result["success"] is False
    assert db.execute(select(CrawlJob).where(CrawlJob.scan_schedule_id == schedule_id)).scalar_one_or_none() is None


def test_collector_adapter_stamps_mention_scope(tenant_db):
    db, _, project, source = tenant_db
    from app.api.collectors import match_and_create_mentions

    item = SourceItem(
        organization_id=21, user_id=11, source_id=source.id, source_type="web",
        url="https://example.test/collector", normalized_url="https://example.test/collector",
        title="Nope360 collector",
        content="nope360 collector content", content_hash="collector-item",
    )
    db.add(item)
    db.flush()
    keywords = db.execute(select(Keyword).where(Keyword.group_id == project.id)).scalars().all()
    assert match_and_create_mentions(db, item, keywords, TenantScope(21, 11, 31)) == 1
    mention = db.execute(select(Mention)).scalar_one()
    assert (mention.organization_id, mention.user_id, mention.project_id) == (21, 11, 31)


def test_source_triggered_adapter_stamps_mention_scope(monkeypatch, tenant_db):
    db, user, _, source = tenant_db
    from app.api.sources import scan_source

    monkeypatch.setattr("app.api.crawl.crawl_source", lambda *_: [{
        "title": "Nope360 source trigger", "content": "nope360 source content",
        "url": "https://example.test/source-trigger", "author": "Reporter",
        "published_at": datetime.now(timezone.utc),
        "matched_keywords": [{"keyword": "nope360"}],
    }])
    result = scan_source(source.id, db, user)
    assert result["new_mentions"] == 1
    mention = db.execute(select(Mention)).scalar_one()
    assert (mention.organization_id, mention.user_id, mention.project_id) == (21, 11, 31)


def test_social_adapter_stamps_mention_and_ai_parent(monkeypatch, tenant_db):
    db, _, _, _ = tenant_db
    from app.services import social_crawl_job

    monkeypatch.setattr(social_crawl_job, "analyze_mention", lambda *_: _analysis_result())
    success_count, error_count, errors, created = social_crawl_job._persist_mentions(db, [{
        "url": "https://example.test/social", "title": "Nope360 social",
        "content": "nope360 social content", "keyword": "nope360",
        "source_type": "web", "platform": "news",
        "timestamp": datetime.now(timezone.utc),
    }], TenantScope(21, 11, 31))
    assert (success_count, error_count, errors, len(created)) == (1, 0, [], 1)
    mention = db.execute(select(Mention)).scalar_one()
    analysis = db.execute(select(AIAnalysis)).scalar_one()
    assert (mention.organization_id, mention.user_id, mention.project_id) == (21, 11, 31)
    assert analysis.mention_id == mention.id


def test_discovery_and_approval_preserve_scope(tenant_db):
    db, user, project, _ = tenant_db
    from app.api.discovery import approve_source_as_website
    from app.services.discovery_service import create_discovery_job

    job = create_discovery_job(db, user.id, {"project_id": project.id, "keywords": ["nope360"]})
    ds = DiscoveredSource(
        organization_id=21, user_id=11, project_id=31, discovery_job_id=job.id,
        source_name="Discovered", domain="discovered.test", homepage_url="https://discovered.test/",
        status=DiscoveredSourceStatus.CANDIDATE,
    )
    db.add(ds)
    db.commit()
    approve_source_as_website(ds.id, None, db, user)
    approved = db.get(Source, ds.approved_source_id)
    assert (job.organization_id, job.created_by_user_id, job.project_id) == (21, 11, 31)
    assert (approved.organization_id, approved.user_id) == (21, 11)


def test_alert_report_writers_stamp_scope_and_on_demand_export_does_not_persist(monkeypatch, tenant_db):
    db, user, project, _ = tenant_db
    from app.api import alerts, reports
    from app.api.alerts import AlertCreateBody
    from app.schemas.report import ReportCreate

    mention = Mention(organization_id=21, user_id=11, project_id=31, content_hash="surface-mention")
    db.add(mention)
    db.commit()
    alerts.create_alert(AlertCreateBody(mention_id=mention.id, title="Risk", severity="high"), db, user)

    monkeypatch.setattr(reports, "_generate_report_inline", lambda *_: None)
    report_data = ReportCreate(
        project_id=project.id, report_type=ReportType.CUSTOM, title="Scoped report",
        start_date=datetime.now(timezone.utc), end_date=datetime.now(timezone.utc),
    )
    reports.create_report(report_data, db, user)
    monkeypatch.setattr(
        reports.ExportService,
        "get_export_data",
        lambda *_: {"raw_mentions": [{"id": mention.id}], "metrics": {}, "comparison": {}},
    )
    monkeypatch.setattr(reports.PDFGenerator, "generate_project_summary", lambda *_: b"%PDF-test")
    response = reports.export_on_demand("pdf", project.id, None, db, user)

    alert = db.execute(select(Alert)).scalar_one()
    report = db.execute(select(Report)).scalar_one()
    exports = db.execute(select(ReportExport)).scalars().all()
    assert (alert.organization_id, alert.user_id, alert.project_id) == (21, 11, 31)
    assert (report.organization_id, report.generated_by, report.project_id) == (21, 11, 31)
    assert response.headers["x-report-retention"] == "none"
    assert exports == []
