"""Seed two isolated tenants for authenticated browser tests."""

from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "backend"))

if not os.getenv("DATABASE_URL"):
    raise RuntimeError("DATABASE_URL is required for isolated E2E seeding")
for name in ("E2E_TENANT_A_PASSWORD", "E2E_TENANT_B_PASSWORD"):
    if not os.getenv(name):
        raise RuntimeError(f"{name} is required for isolated E2E seeding")

import app.models  # noqa: E402,F401
from app.core.database import Base, SessionLocal, engine  # noqa: E402
from app.core.security import get_password_hash  # noqa: E402
from app.models.keyword import Keyword, KeywordGroup  # noqa: E402
from app.models.mention import Mention  # noqa: E402
from app.models.organization import Organization, OrganizationMember  # noqa: E402
from app.models.report import ExportStatus, ReportExport  # noqa: E402
from app.models.source import CrawlFrequency, Source, SourceGroup, SourceType  # noqa: E402
from app.models.tenant_integrity import TenantIntegrityAuditState  # noqa: E402
from app.models.user import User  # noqa: E402


IDS = {"organization_a": 71001, "organization_b": 71002, "user_a": 72001, "user_b": 72002,
       "project_a": 73001, "project_b": 73002, "source_group_a": 73501, "source_group_b": 73502,
       "source_a": 74001, "source_b": 74002, "export_a": 77001}


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.get(User, IDS["user_a"]):
            return
        db.add_all([
            TenantIntegrityAuditState(id=1, status="ready", unresolved_count=0, conflict_count=0, details={"fixture": True}),
            User(id=IDS["user_a"], email="tenant-a@e2e.invalid", hashed_password=get_password_hash(os.environ["E2E_TENANT_A_PASSWORD"]), full_name="E2E Tenant A", is_active=True, is_superuser=False, role="viewer", current_organization_id=IDS["organization_a"]),
            User(id=IDS["user_b"], email="tenant-b@e2e.invalid", hashed_password=get_password_hash(os.environ["E2E_TENANT_B_PASSWORD"]), full_name="E2E Tenant B", is_active=True, is_superuser=False, role="viewer", current_organization_id=IDS["organization_b"]),
        ])
        db.flush()
        db.add_all([
            Organization(id=IDS["organization_a"], name="E2E Tenant A", slug="e2e-tenant-a", status="active", owner_user_id=IDS["user_a"]),
            Organization(id=IDS["organization_b"], name="E2E Tenant B", slug="e2e-tenant-b", status="active", owner_user_id=IDS["user_b"]),
        ])
        db.flush()
        db.add_all([
            OrganizationMember(organization_id=IDS["organization_a"], user_id=IDS["user_a"], role="owner", status="active"),
            OrganizationMember(organization_id=IDS["organization_b"], user_id=IDS["user_b"], role="owner", status="active"),
            KeywordGroup(id=IDS["project_a"], organization_id=IDS["organization_a"], user_id=IDS["user_a"], name="E2E Project A", alert_threshold=70, is_active=True),
            KeywordGroup(id=IDS["project_b"], organization_id=IDS["organization_b"], user_id=IDS["user_b"], name="E2E Project B", alert_threshold=70, is_active=True),
            SourceGroup(id=IDS["source_group_a"], organization_id=IDS["organization_a"], user_id=IDS["user_a"], name="E2E Sources A", is_active=True),
            SourceGroup(id=IDS["source_group_b"], organization_id=IDS["organization_b"], user_id=IDS["user_b"], name="E2E Sources B", is_active=True),
        ])
        db.flush()
        db.add_all([
            Keyword(group_id=IDS["project_a"], keyword="e2e-risk-signal", is_active=True),
            Source(id=IDS["source_a"], organization_id=IDS["organization_a"], user_id=IDS["user_a"], group_id=IDS["source_group_a"], name="E2E RSS A", source_type=SourceType.RSS, url="http://127.0.0.1:8010/_e2e/feed.xml", platform="local-fixture", crawl_frequency=CrawlFrequency.MANUAL, is_active=True),
            Source(id=IDS["source_b"], organization_id=IDS["organization_b"], user_id=IDS["user_b"], group_id=IDS["source_group_b"], name="E2E RSS B", source_type=SourceType.RSS, url="http://127.0.0.1:8010/_e2e/feed.xml?tenant=b", platform="local-fixture", crawl_frequency=CrawlFrequency.MANUAL, is_active=False),
            ReportExport(id=IDS["export_a"], organization_id=IDS["organization_a"], project_id=IDS["project_a"], requested_by=IDS["user_a"], report_type="pdf", status=ExportStatus.SUCCESS, file_path=None, builder_config={"fixture": True}),
        ])
        now = datetime.now(timezone.utc)
        for offset in range(25):
            db.add(Mention(id=75001 + offset, organization_id=IDS["organization_a"], user_id=IDS["user_a"], project_id=IDS["project_a"], source_id=IDS["source_a"], source_type="rss", platform="local-fixture", domain="e2e.invalid", title=f"Cursor fixture mention {offset + 1:02d}", content=f"Cursor fixture content {offset + 1:02d}", snippet=f"Cursor fixture snippet {offset + 1:02d}", content_hash=f"e2e-cursor-{offset + 1:02d}", url=f"https://e2e.invalid/mentions/{offset + 1}", canonical_url=f"https://e2e.invalid/mentions/{offset + 1}", keyword_text="cursor-fixture", sentiment="neutral", published_at=now - timedelta(minutes=offset), collected_at=now - timedelta(minutes=offset), is_muted=False, is_deleted=False, verification_status="verified"))
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
    print("E2E_SEED_COMPLETE")
