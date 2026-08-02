from datetime import datetime, timezone

import pytest
from fastapi import BackgroundTasks
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.alert import Alert
from app.models.crawl import CrawlJob
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


def test_alert_report_and_export_writers_stamp_scope(monkeypatch, tenant_db):
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
    reports.request_async_export("pdf", BackgroundTasks(), project.id, None, db, user)

    alert = db.execute(select(Alert)).scalar_one()
    report = db.execute(select(Report)).scalar_one()
    export = db.execute(select(ReportExport)).scalar_one()
    assert (alert.organization_id, alert.user_id, alert.project_id) == (21, 11, 31)
    assert (report.organization_id, report.generated_by, report.project_id) == (21, 11, 31)
    assert (export.organization_id, export.requested_by, export.project_id) == (21, 11, 31)
