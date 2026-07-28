"""Deterministic FastAPI boundary for the Playwright manual-scan smoke."""

from __future__ import annotations

import asyncio
import os
import sys
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"
sys.path.insert(0, str(BACKEND_ROOT))

database_dir = Path(tempfile.mkdtemp(prefix="nope360-playwright-"))
os.environ["DATABASE_URL"] = f"sqlite:///{(database_dir / 'scan.db').as_posix()}"
os.environ["ENVIRONMENT"] = "test"
os.environ["SECRET_KEY"] = "playwright-local-only"
os.environ["SCHEDULER_ENABLED"] = "false"
os.environ["AUTO_DISCOVERY_ENABLED"] = "false"
os.environ["SOCIAL_CRAWL_ENABLED"] = "false"
os.environ["SEARCH_PROVIDER_ORDER"] = "rss"

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import HTMLResponse, Response  # noqa: E402
import uvicorn  # noqa: E402

import app.models  # noqa: E402,F401 - register production SQLAlchemy models
from app.api import crawl  # noqa: E402
from app.core.database import Base, SessionLocal, engine  # noqa: E402
from app.core.security import get_current_active_user  # noqa: E402
from app.models.source import CrawlFrequency, Source, SourceType  # noqa: E402
from app.models.user import User  # noqa: E402
from app.models.crawl import CrawlJob  # noqa: E402
from app.services import scan_service  # noqa: E402
from sqlalchemy.orm.attributes import flag_modified  # noqa: E402


production_execute_scan = scan_service.execute_scan


def deterministic_rss_scan(job_id, project_id, keyword_texts, mode, max_results, source_types=None):
    """Run the production scan service with external adapters disabled."""
    # The UI submits `keywords`; the production service's final metadata step
    # also expects `query`. Normalize the deterministic fixture job so this
    # harness exercises RSS rather than failing on absent optional metadata.
    db = SessionLocal()
    try:
        job = db.get(CrawlJob, job_id)
        meta = dict(job.meta_data or {})
        if not meta.get("query") and keyword_texts:
            meta["query"] = keyword_texts[0]
            job.meta_data = meta
            flag_modified(job, "meta_data")
            db.commit()
    finally:
        db.close()
    return production_execute_scan(
        job_id,
        project_id or 1,
        keyword_texts,
        "ALL_ACTIVE_SOURCES",
        max_results,
        ["rss"],
    )


scan_service.execute_scan = deterministic_rss_scan


def smoke_user() -> User:
    return User(
        id=1,
        email="smoke@example.test",
        hashed_password="not-used",
        full_name="Smoke User",
        is_active=True,
        is_superuser=True,
        current_organization_id=1,
    )


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        db.add(smoke_user())
        db.add(Source(
            id=1,
            user_id=1,
            name="Playwright deterministic RSS",
            source_type=SourceType.RSS,
            url="http://127.0.0.1:8010/fixtures/feed.xml",
            platform="local-fixture",
            crawl_frequency=CrawlFrequency.MANUAL,
            is_active=True,
        ))
        db.commit()
    finally:
        db.close()
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(crawl.router, prefix="/api/crawl")
app.dependency_overrides[get_current_active_user] = smoke_user


@app.get("/health")
def health():
    return {"status": "ready", "fixture": "deterministic-rss"}


@app.get("/fixtures/feed.xml")
async def deterministic_feed():
    # Keep the real RSS collector busy long enough for the UI's 5s poll to
    # observe RUNNING before the production scan service commits COMPLETED.
    await asyncio.sleep(7)
    xml = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Nope360 Playwright Fixture</title>
    <link>http://127.0.0.1:8010/fixtures</link>
    <description>Deterministic local feed</description>
    <item>
      <guid>playwright-scan-9001</guid>
      <title>deterministic smoke keyword signal detected</title>
      <link>http://127.0.0.1:8010/fixtures/article-1</link>
      <description>deterministic smoke keyword appears in this local RSS item.</description>
      <pubDate>Tue, 28 Jul 2026 01:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>"""
    return Response(content=xml, media_type="application/rss+xml")


@app.get("/fixtures/article-1")
def deterministic_article():
    return HTMLResponse("<h1>Deterministic smoke keyword signal detected</h1>")


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8010, log_level="warning")
