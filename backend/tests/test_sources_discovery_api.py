# -*- coding: utf-8 -*-
"""
API tests for the source discovery / OPML import endpoints.

Verifies the full configuration path that feeds the real ingestion pipeline:
  POST /api/sources/discover-feeds  -> candidates only, nothing persisted
  POST /api/sources/opml/preview    -> parsed feeds with per-feed status
  POST /api/sources/import-feeds    -> creates Source rows, honest per-feed status

Offline: outbound fetching and feed validation are stubbed. SQLite backs the DB.
"""
import io
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("DATABASE_URL", "sqlite:///test_sources_discovery.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-tests")
os.environ.setdefault("ENVIRONMENT", "test")

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.core.security import get_current_active_user
from app.main import app
from app.models.source import Source, SourceType
from app.models.user import User

TEST_DB_URL = "sqlite:///test_sources_discovery.db"
engine = create_engine(TEST_DB_URL, echo=False)
TestSession = sessionmaker(bind=engine, expire_on_commit=False, autocommit=False, autoflush=False)


def _override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


_fake_user = User(id=1, email="tester@example.com", full_name="Tester", is_active=True, is_superuser=True)


def _override_user():
    return _fake_user


client = TestClient(app, raise_server_exceptions=False)


@pytest.fixture(autouse=True)
def dependency_overrides():
    """
    Apply this module's overrides per test and restore them afterwards.

    `app` is a module-level singleton shared by every test file, so setting
    dependency_overrides at import time makes the outcome depend on import order:
    whichever module imported last wins, and this file's tests then talk to
    another module's database. Scoping the overrides to each test keeps the file
    correct both alone and inside the full suite.
    """
    previous = dict(app.dependency_overrides)
    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_active_user] = _override_user
    try:
        yield
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with engine.connect() as conn:
        conn.execute(
            text(
                "INSERT OR IGNORE INTO users (id, email, hashed_password, full_name, is_active) "
                "VALUES (1, 'tester@example.com', 'fakehash', 'Tester', 1)"
            )
        )
        conn.commit()
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture
def public_dns(monkeypatch):
    monkeypatch.setattr("app.services.feed_fetcher._resolve_host", lambda host: ["93.184.216.34"])


HTML_WITH_FEEDS = (
    b"<html><head><title>Trang tin</title>"
    b'<link rel="alternate" type="application/rss+xml" title="Tin moi" href="/rss.xml">'
    b'<link rel="alternate" type="application/atom+xml" href="/atom.xml">'
    b"</head><body></body></html>"
)


def _stub_discovery_fetch(monkeypatch, content=HTML_WITH_FEEDS, content_type="text/html", final_url="https://tin.example/"):
    from app.services import feed_discovery
    from app.services.feed_fetcher import FeedFetchResult

    monkeypatch.setattr(
        feed_discovery,
        "fetch_url",
        lambda *a, **k: FeedFetchResult(
            ok=True, content=content, content_type=content_type, final_url=final_url, status_code=200
        ),
    )


# ─── discover-feeds ───────────────────────────────────────────────────────────


class TestDiscoverFeedsEndpoint:
    def test_returns_candidates_without_persisting_anything(self, monkeypatch, public_dns):
        _stub_discovery_fetch(monkeypatch)
        response = client.post("/api/sources/discover-feeds", json={"url": "https://tin.example/"})

        assert response.status_code == 200, response.text
        body = response.json()
        assert body["ok"] is True
        assert body["page_title"] == "Trang tin"
        assert [f["url"] for f in body["feeds"]] == [
            "https://tin.example/rss.xml",
            "https://tin.example/atom.xml",
        ]
        assert all(f["status"] == "available" for f in body["feeds"])

        session = TestSession()
        try:
            assert session.query(Source).count() == 0, "discovery must not create sources"
        finally:
            session.close()

    def test_reports_blocked_input_url(self, monkeypatch):
        response = client.post("/api/sources/discover-feeds", json={"url": "http://169.254.169.254/"})
        assert response.status_code == 200
        body = response.json()
        assert body["ok"] is False
        assert body["error_code"] == "blocked_target"
        assert body["feeds"] == []

    def test_empty_result_is_not_an_error(self, monkeypatch, public_dns):
        _stub_discovery_fetch(monkeypatch, content=b"<html><head><title>No feeds</title></head><body></body></html>")
        response = client.post("/api/sources/discover-feeds", json={"url": "https://tin.example/"})
        body = response.json()
        assert response.status_code == 200
        assert body["ok"] is True
        assert body["feeds"] == []

    def test_rejects_missing_url(self):
        response = client.post("/api/sources/discover-feeds", json={})
        assert response.status_code == 422


# ─── opml/preview ─────────────────────────────────────────────────────────────

OPML_BYTES = b"""<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
  <head><title>Bo suu tap</title></head>
  <body>
    <outline text="Bao A" type="rss" xmlUrl="https://bao-a.example/rss"/>
    <outline text="Noi bo" type="rss" xmlUrl="http://169.254.169.254/latest/meta-data/"/>
  </body>
</opml>"""


class TestOpmlPreviewEndpoint:
    def test_parses_and_reports_per_feed_status(self):
        response = client.post(
            "/api/sources/opml/preview",
            files={"file": ("subs.opml", io.BytesIO(OPML_BYTES), "text/xml")},
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["ok"] is True
        assert body["title"] == "Bo suu tap"
        statuses = {f["title"]: f["status"] for f in body["feeds"]}
        assert statuses["Bao A"] == "available"
        assert statuses["Noi bo"] == "blocked"

    def test_rejects_wrong_extension(self):
        response = client.post(
            "/api/sources/opml/preview",
            files={"file": ("subs.txt", io.BytesIO(OPML_BYTES), "text/plain")},
        )
        assert response.status_code == 400

    def test_rejects_doctype(self):
        payload = b'<?xml version="1.0"?><!DOCTYPE opml [<!ENTITY x "y">]><opml><body/></opml>'
        response = client.post(
            "/api/sources/opml/preview",
            files={"file": ("bad.opml", io.BytesIO(payload), "text/xml")},
        )
        assert response.status_code == 400
        assert "DOCTYPE" in response.json()["detail"]

    def test_preview_creates_no_sources(self):
        client.post(
            "/api/sources/opml/preview",
            files={"file": ("subs.opml", io.BytesIO(OPML_BYTES), "text/xml")},
        )
        session = TestSession()
        try:
            assert session.query(Source).count() == 0
        finally:
            session.close()


# ─── import-feeds ─────────────────────────────────────────────────────────────


def _stub_validation(monkeypatch, outcomes):
    """Map URL -> (is_valid, code, message) for crawl_service.validate_rss_feed."""
    from app.services import crawl_service

    def _validate(url):
        return outcomes.get(url, (True, "", ""))

    monkeypatch.setattr(crawl_service, "validate_rss_feed", _validate)


class TestImportFeedsEndpoint:
    def test_creates_sources_inactive_by_default(self, monkeypatch, public_dns):
        _stub_validation(monkeypatch, {})
        response = client.post(
            "/api/sources/import-feeds",
            json={"feeds": [{"url": "https://bao-a.example/rss", "name": "Bao A"}]},
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["summary"]["created"] == 1
        assert body["results"][0]["status"] == "created"

        session = TestSession()
        try:
            source = session.query(Source).one()
            assert source.url == "https://bao-a.example/rss"
            assert source.name == "Bao A"
            assert source.source_type == SourceType.RSS
            # Not connected, not collecting, until the user enables it.
            assert source.is_active is False
            assert source.last_success_at is None
        finally:
            session.close()

    def test_activate_flag_is_honoured(self, monkeypatch, public_dns):
        _stub_validation(monkeypatch, {})
        client.post(
            "/api/sources/import-feeds",
            json={"feeds": [{"url": "https://bao-b.example/rss"}], "activate": True},
        )
        session = TestSession()
        try:
            assert session.query(Source).one().is_active is True
        finally:
            session.close()

    def test_reports_duplicate_blocked_invalid_and_failed_independently(self, monkeypatch, public_dns):
        _stub_validation(
            monkeypatch,
            {
                "https://invalid.example/rss": (False, "invalid_xml", "Nội dung nguồn không phải RSS/Atom hợp lệ."),
                "https://timeout.example/rss": (False, "timeout", "Kết nối hết hạn (timeout). Vui lòng thử lại sau."),
            },
        )
        # Pre-existing source to trigger the duplicate branch.
        session = TestSession()
        try:
            session.add(
                Source(
                    user_id=1,
                    name="Existing",
                    source_type=SourceType.RSS,
                    url="https://existing.example/rss",
                    is_active=True,
                )
            )
            session.commit()
        finally:
            session.close()

        response = client.post(
            "/api/sources/import-feeds",
            json={
                "feeds": [
                    {"url": "https://ok.example/rss", "name": "OK"},
                    {"url": "https://existing.example/rss", "name": "Dup"},
                    {"url": "http://169.254.169.254/latest/meta-data/", "name": "Internal"},
                    {"url": "https://invalid.example/rss", "name": "Invalid"},
                    {"url": "https://timeout.example/rss", "name": "Timeout"},
                ]
            },
        )
        assert response.status_code == 200, response.text
        body = response.json()
        statuses = {r["name"]: r["status"] for r in body["results"]}

        assert statuses["OK"] == "created"
        assert statuses["Dup"] == "duplicate"
        assert statuses["Internal"] == "blocked"
        assert statuses["Invalid"] == "invalid"
        assert statuses["Timeout"] == "failed"

        assert body["summary"] == {
            "created": 1,
            "duplicate": 1,
            "blocked": 1,
            "invalid": 1,
            "failed": 1,
            "total": 5,
        }

        # One failing feed must not stop the others.
        session = TestSession()
        try:
            urls = {s.url for s in session.query(Source).all()}
            assert "https://ok.example/rss" in urls
            assert "http://169.254.169.254/latest/meta-data/" not in urls
            assert "https://invalid.example/rss" not in urls
        finally:
            session.close()

    def test_internal_error_details_are_not_echoed(self, monkeypatch, public_dns):
        _stub_validation(
            monkeypatch,
            {"https://leaky.example/rss": (False, "fetch_failed", "Không lấy được dữ liệu từ nguồn.")},
        )
        response = client.post(
            "/api/sources/import-feeds",
            json={"feeds": [{"url": "https://leaky.example/rss"}]},
        )
        message = response.json()["results"][0]["error_message"]
        assert "ConnectionPool" not in message
        assert "5432" not in message

    def test_duplicates_within_the_request_are_reported_once(self, monkeypatch, public_dns):
        _stub_validation(monkeypatch, {})
        response = client.post(
            "/api/sources/import-feeds",
            json={
                "feeds": [
                    {"url": "https://same.example/rss", "name": "First"},
                    {"url": "https://same.example/rss", "name": "Second"},
                ]
            },
        )
        body = response.json()
        assert body["summary"]["created"] == 1
        assert body["summary"]["duplicate"] == 1

    def test_rejects_empty_feed_list(self):
        response = client.post("/api/sources/import-feeds", json={"feeds": []})
        assert response.status_code == 422

    def test_rejects_unknown_group(self, monkeypatch, public_dns):
        _stub_validation(monkeypatch, {})
        response = client.post(
            "/api/sources/import-feeds",
            json={"feeds": [{"url": "https://x.example/rss"}], "group_id": 9999},
        )
        assert response.status_code == 404
