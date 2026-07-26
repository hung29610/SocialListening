# -*- coding: utf-8 -*-
"""
Offline tests for website feed auto-discovery and OPML import.

No network: app.services.feed_discovery.fetch_url is stubbed with local HTML
fixtures. OPML tests operate on in-memory documents only.
"""
import pytest

from app.services import feed_discovery
from app.services.feed_discovery import DiscoveryResult, discover_feeds, normalize_feed_url
from app.services.feed_fetcher import FeedFetchResult
from app.services.opml_import import MAX_OUTLINES, parse_opml

PUBLIC_IP = "93.184.216.34"


@pytest.fixture(autouse=True)
def public_dns(monkeypatch):
    """Every hostname resolves to a public address unless a test overrides it."""
    monkeypatch.setattr(
        "app.services.feed_fetcher._resolve_host",
        lambda host: [PUBLIC_IP],
    )


def _html(body: str, title: str = "Fixture Site") -> bytes:
    return f"<html><head><title>{title}</title>{body}</head><body></body></html>".encode("utf-8")


def _ok(content: bytes, content_type="text/html; charset=utf-8", final_url="https://fixture.example/"):
    return FeedFetchResult(ok=True, content=content, content_type=content_type, final_url=final_url, status_code=200)


def _stub_fetch(monkeypatch, result):
    monkeypatch.setattr(feed_discovery, "fetch_url", lambda *a, **k: result)


# ─── Discovery ────────────────────────────────────────────────────────────────


class TestDiscoverFeeds:
    def test_finds_rss_and_atom_alternate_links(self, monkeypatch):
        _stub_fetch(
            monkeypatch,
            _ok(
                _html(
                    '<link rel="alternate" type="application/rss+xml" title="Main feed" href="/rss.xml">'
                    '<link rel="alternate" type="application/atom+xml" title="Atom" href="https://fixture.example/atom.xml">'
                )
            ),
        )
        result = discover_feeds("https://fixture.example/")

        assert result.ok is True
        assert result.page_title == "Fixture Site"
        assert [f.url for f in result.feeds] == [
            "https://fixture.example/rss.xml",
            "https://fixture.example/atom.xml",
        ]
        assert [f.kind for f in result.feeds] == ["rss", "atom"]
        assert [f.title for f in result.feeds] == ["Main feed", "Atom"]
        assert all(f.status == "available" for f in result.feeds)

    def test_resolves_relative_urls_against_the_final_url(self, monkeypatch):
        _stub_fetch(
            monkeypatch,
            _ok(
                _html('<link rel="alternate" type="application/rss+xml" href="feed/index.xml">'),
                final_url="https://fixture.example/blog/",
            ),
        )
        result = discover_feeds("https://fixture.example/blog")
        assert [f.url for f in result.feeds] == ["https://fixture.example/blog/feed/index.xml"]

    def test_resolves_root_relative_urls(self, monkeypatch):
        _stub_fetch(
            monkeypatch,
            _ok(
                _html('<link rel="alternate" type="application/rss+xml" href="/feed">'),
                final_url="https://fixture.example/blog/post-1",
            ),
        )
        result = discover_feeds("https://fixture.example/blog/post-1")
        assert [f.url for f in result.feeds] == ["https://fixture.example/feed"]

    def test_deduplicates_equivalent_feed_urls(self, monkeypatch):
        _stub_fetch(
            monkeypatch,
            _ok(
                _html(
                    '<link rel="alternate" type="application/rss+xml" href="/rss.xml">'
                    '<link rel="alternate" type="application/rss+xml" href="/rss.xml/">'
                    '<link rel="alternate" type="application/rss+xml" href="https://fixture.example/rss.xml">'
                )
            ),
        )
        result = discover_feeds("https://fixture.example/")
        assert len(result.feeds) == 1

    def test_ignores_non_feed_alternate_links(self, monkeypatch):
        _stub_fetch(
            monkeypatch,
            _ok(
                _html(
                    '<link rel="stylesheet" href="/style.css">'
                    '<link rel="alternate" hreflang="en" href="/en/">'
                    '<link rel="alternate" type="text/html" href="/amp">'
                    '<link rel="icon" href="/favicon.ico">'
                )
            ),
        )
        result = discover_feeds("https://fixture.example/")
        assert result.ok is True
        assert result.feeds == []

    def test_honest_empty_state_when_no_feed_advertised(self, monkeypatch):
        _stub_fetch(monkeypatch, _ok(_html("")))
        result = discover_feeds("https://fixture.example/")
        assert result.ok is True
        assert result.feeds == []
        assert result.error_code == ""

    def test_marks_internal_feed_targets_as_blocked(self, monkeypatch):
        _stub_fetch(
            monkeypatch,
            _ok(
                _html(
                    '<link rel="alternate" type="application/rss+xml" href="http://169.254.169.254/latest/meta-data/">'
                    '<link rel="alternate" type="application/rss+xml" href="/good.xml">'
                )
            ),
        )
        result = discover_feeds("https://fixture.example/")
        by_status = {f.status for f in result.feeds}
        assert "blocked" in by_status and "available" in by_status
        blocked = next(f for f in result.feeds if f.status == "blocked")
        assert blocked.error_code == "blocked_target"
        # The blocked entry must not leak the internal address in its message.
        assert "169.254" not in blocked.error_message

    def test_detects_when_the_submitted_url_is_itself_a_feed(self, monkeypatch):
        rss = b'<?xml version="1.0"?><rss version="2.0"><channel><title>Direct feed</title></channel></rss>'
        _stub_fetch(monkeypatch, _ok(rss, content_type="application/rss+xml", final_url="https://fixture.example/rss"))
        result = discover_feeds("https://fixture.example/rss")

        assert result.ok is True
        assert result.input_was_feed is True
        assert len(result.feeds) == 1
        assert result.feeds[0].url == "https://fixture.example/rss"
        assert result.feeds[0].title == "Direct feed"

    def test_rejects_invalid_or_internal_input_url_before_fetching(self, monkeypatch):
        def _must_not_fetch(*a, **k):
            raise AssertionError("fetch must not happen for a rejected URL")

        monkeypatch.setattr(feed_discovery, "fetch_url", _must_not_fetch)

        for url, expected in (
            ("file:///etc/passwd", "unsupported_scheme"),
            ("http://127.0.0.1/", "blocked_target"),
            ("http://169.254.169.254/", "blocked_target"),
        ):
            result = discover_feeds(url)
            assert result.ok is False, url
            assert result.error_code == expected

    def test_propagates_fetch_failure_honestly(self, monkeypatch):
        _stub_fetch(
            monkeypatch,
            FeedFetchResult(ok=False, error_code="timeout", error_message="Kết nối hết hạn (timeout). Vui lòng thử lại sau."),
        )
        result = discover_feeds("https://fixture.example/")
        assert result.ok is False
        assert result.error_code == "timeout"
        assert result.feeds == []

    def test_caps_the_number_of_candidates(self, monkeypatch):
        links = "".join(
            f'<link rel="alternate" type="application/rss+xml" href="/feed-{i}.xml">' for i in range(60)
        )
        _stub_fetch(monkeypatch, _ok(_html(links)))
        result = discover_feeds("https://fixture.example/", max_candidates=5)
        assert len(result.feeds) == 5

    def test_uses_the_guarded_fetcher_with_html_accept(self, monkeypatch):
        captured = {}

        def _fetch(url, **kwargs):
            captured["url"] = url
            captured["accept"] = kwargs.get("accept")
            return _ok(_html(""))

        monkeypatch.setattr(feed_discovery, "fetch_url", _fetch)
        discover_feeds("https://fixture.example/")
        assert captured["url"] == "https://fixture.example/"
        assert "text/html" in captured["accept"]


class TestNormalizeFeedUrl:
    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("HTTPS://Example.COM/feed/", "https://example.com/feed"),
            ("https://example.com/feed", "https://example.com/feed"),
            ("https://example.com", "https://example.com/"),
            ("https://example.com/feed?format=rss", "https://example.com/feed?format=rss"),
            ("https://example.com/feed#frag", "https://example.com/feed"),
        ],
    )
    def test_canonical_forms(self, raw, expected):
        assert normalize_feed_url(raw) == expected


# ─── OPML ─────────────────────────────────────────────────────────────────────

VALID_OPML = b"""<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
  <head><title>Danh sach theo doi</title></head>
  <body>
    <outline text="Bao A" type="rss" xmlUrl="https://bao-a.example/rss"/>
    <outline title="Bao B" type="atom" xmlUrl="https://bao-b.example/atom.xml"/>
    <outline text="Nhom tin">
      <outline text="Bao C" type="rss" xmlUrl="https://bao-c.example/feed"/>
    </outline>
  </body>
</opml>"""


class TestParseOpml:
    def test_extracts_feeds_titles_and_kinds(self):
        result = parse_opml(VALID_OPML)
        assert result.ok is True
        assert result.title == "Danh sach theo doi"
        assert [f.url for f in result.feeds] == [
            "https://bao-a.example/rss",
            "https://bao-b.example/atom.xml",
            "https://bao-c.example/feed",
        ]
        assert [f.title for f in result.feeds] == ["Bao A", "Bao B", "Bao C"]
        assert [f.kind for f in result.feeds] == ["rss", "atom", "rss"]
        assert all(f.status == "available" for f in result.feeds)

    def test_finds_nested_outlines(self):
        result = parse_opml(VALID_OPML)
        assert any(f.title == "Bao C" for f in result.feeds)

    def test_deduplicates_within_the_file(self):
        opml = b"""<?xml version="1.0"?><opml><body>
          <outline text="A" xmlUrl="https://a.example/rss"/>
          <outline text="A again" xmlUrl="https://a.example/rss/"/>
          <outline text="A third" xmlUrl="HTTPS://A.EXAMPLE/rss"/>
        </body></opml>"""
        result = parse_opml(opml)
        assert result.ok is True
        assert len(result.feeds) == 1
        assert result.duplicates_in_file == 2

    def test_accepts_case_variant_attribute_names(self):
        opml = b"""<?xml version="1.0"?><opml><body>
          <outline TEXT="Upper" XMLURL="https://upper.example/rss"/>
          <outline text="Mixed" xmlurl="https://mixed.example/rss"/>
        </body></opml>"""
        result = parse_opml(opml)
        assert [f.url for f in result.feeds] == ["https://upper.example/rss", "https://mixed.example/rss"]

    def test_marks_unsafe_feed_urls_as_blocked_without_leaking_them(self):
        opml = b"""<?xml version="1.0"?><opml><body>
          <outline text="ok" xmlUrl="https://good.example/rss"/>
          <outline text="metadata" xmlUrl="http://169.254.169.254/latest/meta-data/"/>
          <outline text="file" xmlUrl="file:///etc/passwd"/>
          <outline text="creds" xmlUrl="https://u:p@bad.example/rss"/>
        </body></opml>"""
        result = parse_opml(opml)
        statuses = {f.title: (f.status, f.error_code) for f in result.feeds}
        assert statuses["ok"][0] == "available"
        assert statuses["metadata"] == ("blocked", "blocked_target")
        assert statuses["file"][0] == "blocked"
        assert statuses["creds"] == ("blocked", "credentials_in_url")
        for feed in result.feeds:
            assert "169.254" not in feed.error_message

    def test_rejects_doctype_and_entity_declarations(self):
        for payload in (
            b'<?xml version="1.0"?><!DOCTYPE opml [<!ENTITY lol "lol">]><opml><body/></opml>',
            b'<?xml version="1.0"?><!DOCTYPE opml SYSTEM "http://evil.example/x.dtd"><opml><body/></opml>',
        ):
            result = parse_opml(payload)
            assert result.ok is False
            assert result.error_code == "doctype_forbidden"

    def test_billion_laughs_payload_is_refused_before_parsing(self):
        payload = (
            b'<?xml version="1.0"?>'
            b'<!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;">]>'
            b"<opml><body><outline xmlUrl=\"&lol2;\"/></body></opml>"
        )
        result = parse_opml(payload)
        assert result.ok is False
        assert result.error_code == "doctype_forbidden"

    def test_rejects_empty_file(self):
        result = parse_opml(b"")
        assert result.ok is False
        assert result.error_code == "empty_file"

    def test_rejects_oversize_file(self):
        result = parse_opml(b"<opml><body/></opml>" + b" " * 100, max_bytes=10)
        assert result.ok is False
        assert result.error_code == "too_large"

    def test_rejects_malformed_xml(self):
        result = parse_opml(b"<opml><body><outline ")
        assert result.ok is False
        assert result.error_code == "invalid_xml"

    def test_rejects_a_non_opml_document(self):
        result = parse_opml(b'<?xml version="1.0"?><rss version="2.0"><channel><title>x</title></channel></rss>')
        assert result.ok is False
        assert result.error_code == "not_opml"

    def test_reports_no_feeds_when_outlines_carry_no_xmlurl(self):
        opml = b'<?xml version="1.0"?><opml><body><outline text="folder only"/></body></opml>'
        result = parse_opml(opml)
        assert result.ok is False
        assert result.error_code == "no_feeds"

    def test_accepts_a_bare_body_export(self):
        opml = b'<body><outline text="A" xmlUrl="https://a.example/rss"/></body>'
        result = parse_opml(opml)
        assert result.ok is True
        assert len(result.feeds) == 1

    def test_truncates_at_the_outline_cap(self):
        outlines = b"".join(
            f'<outline text="f{i}" xmlUrl="https://f{i}.example/rss"/>'.encode() for i in range(12)
        )
        result = parse_opml(b"<opml><body>" + outlines + b"</body></opml>", max_outlines=5)
        assert result.ok is True
        assert len(result.feeds) == 5
        assert result.truncated is True

    def test_preview_does_not_perform_dns_lookups(self, monkeypatch):
        """A 500-entry OPML preview must not fire 500 DNS queries."""
        def _boom(host):
            raise AssertionError("OPML preview must not resolve DNS")

        monkeypatch.setattr("app.services.feed_fetcher._resolve_host", _boom)
        result = parse_opml(VALID_OPML)
        assert result.ok is True
        assert all(f.status == "available" for f in result.feeds)

    def test_default_outline_cap_is_bounded(self):
        assert MAX_OUTLINES <= 1000
