"""
Standards-based feed auto-discovery for a normal website URL.

A user pastes `https://example.com` and we look for the feeds the page itself
advertises, following the long-standing autodiscovery convention:

    <link rel="alternate" type="application/rss+xml"  href="/feed.xml">
    <link rel="alternate" type="application/atom+xml" href="/atom.xml">

Nothing is persisted here and nothing is activated: the endpoint returns
candidates, the user picks which ones to add. Every fetch goes through
app.services.feed_fetcher, so scheme/SSRF/redirect/size guards and the pinned
destination apply exactly as they do for collection.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from urllib.parse import urljoin, urlparse, urlunparse

import feedparser
from bs4 import BeautifulSoup

from app.services.feed_fetcher import HTML_ACCEPT, fetch_url, message_for, validate_feed_url

logger = logging.getLogger(__name__)

# Feed MIME types advertised via <link rel="alternate">.
FEED_MIME_TYPES = {
    "application/rss+xml": "rss",
    "application/atom+xml": "atom",
    "application/rdf+xml": "rss",
    "application/xml": "xml",
    "text/xml": "xml",
    "application/json": "json",
    "application/feed+json": "json",
}

# JSON Feed is advertised the same way but we only ingest RSS/Atom today.
SUPPORTED_FEED_KINDS = ("rss", "atom", "xml")

MAX_CANDIDATES = 25


@dataclass
class DiscoveredFeed:
    url: str
    title: Optional[str] = None
    kind: str = "rss"
    # "available"  -> passed URL validation, can be added
    # "blocked"    -> rejected by the URL guards (internal address, bad scheme…)
    status: str = "available"
    error_code: str = ""
    error_message: str = ""

    def to_dict(self) -> Dict:
        return {
            "url": self.url,
            "title": self.title,
            "kind": self.kind,
            "status": self.status,
            "error_code": self.error_code,
            "error_message": self.error_message,
        }


@dataclass
class DiscoveryResult:
    ok: bool
    page_url: str = ""
    page_title: Optional[str] = None
    feeds: List[DiscoveredFeed] = field(default_factory=list)
    # Set when the submitted URL was itself a feed.
    input_was_feed: bool = False
    error_code: str = ""
    error_message: str = ""

    def to_dict(self) -> Dict:
        return {
            "ok": self.ok,
            "page_url": self.page_url,
            "page_title": self.page_title,
            "input_was_feed": self.input_was_feed,
            "feeds": [feed.to_dict() for feed in self.feeds],
            "error_code": self.error_code,
            "error_message": self.error_message,
        }


def normalize_feed_url(url: str) -> str:
    """Canonical form used only for de-duplicating candidates."""
    if not url:
        return ""
    try:
        parsed = urlparse(url.strip())
        scheme = parsed.scheme.lower() or "https"
        netloc = parsed.netloc.lower()
        path = parsed.path.rstrip("/") or "/"
        return urlunparse((scheme, netloc, path, "", parsed.query, ""))
    except Exception:
        return url.strip()


def _looks_like_feed(content: bytes, content_type: str) -> bool:
    lowered = (content_type or "").lower()
    if any(mime in lowered for mime in ("rss", "atom", "xml")) and "html" not in lowered:
        return True
    head = content[:2048].decode("utf-8", errors="ignore").lstrip().lower()
    return head.startswith("<?xml") or "<rss" in head or "<feed" in head or "<rdf:rdf" in head


def _feed_title(content: bytes) -> Optional[str]:
    try:
        parsed = feedparser.parse(content)
        title = (parsed.feed or {}).get("title")
        return title.strip() if isinstance(title, str) and title.strip() else None
    except Exception:
        return None


def discover_feeds(url: str, *, max_candidates: int = MAX_CANDIDATES) -> DiscoveryResult:
    """
    Inspect `url` and return the RSS/Atom feeds it advertises.

    The submitted URL may itself be a feed; in that case it is returned as the
    single candidate with `input_was_feed=True`.
    """
    is_valid, code, message = validate_feed_url(url)
    if not is_valid:
        return DiscoveryResult(ok=False, error_code=code, error_message=message)

    fetched = fetch_url(url, accept=HTML_ACCEPT)
    if not fetched.ok:
        return DiscoveryResult(
            ok=False, page_url=url, error_code=fetched.error_code, error_message=fetched.error_message
        )

    final_url = fetched.final_url or url

    # Case 1: the user already gave us a feed.
    if _looks_like_feed(fetched.content, fetched.content_type):
        title = _feed_title(fetched.content)
        return DiscoveryResult(
            ok=True,
            page_url=final_url,
            page_title=title,
            input_was_feed=True,
            feeds=[DiscoveredFeed(url=final_url, title=title, kind="rss", status="available")],
        )

    # Case 2: parse the HTML for autodiscovery links.
    try:
        soup = BeautifulSoup(fetched.content, "html.parser")
    except Exception as exc:
        logger.info("Feed discovery could not parse HTML from %s: %s", final_url, exc)
        return DiscoveryResult(
            ok=False, page_url=final_url, error_code="parse_failed", error_message=message_for("parse_failed")
        )

    page_title = None
    if soup.title and soup.title.string:
        page_title = soup.title.string.strip() or None

    seen = set()
    candidates: List[DiscoveredFeed] = []

    for link in soup.find_all("link"):
        rels = link.get("rel") or []
        if isinstance(rels, str):
            rels = [rels]
        rels_lower = {str(r).lower() for r in rels}
        if not rels_lower & {"alternate", "alternate stylesheet", "feed"}:
            continue

        mime = (link.get("type") or "").split(";")[0].strip().lower()
        kind = FEED_MIME_TYPES.get(mime)
        if kind is None or kind not in SUPPORTED_FEED_KINDS:
            continue

        href = (link.get("href") or "").strip()
        if not href:
            continue

        # Relative hrefs resolve against the page we actually landed on.
        absolute = urljoin(final_url, href)
        key = normalize_feed_url(absolute)
        if not key or key in seen:
            continue
        seen.add(key)

        title = (link.get("title") or "").strip() or None
        feed = DiscoveredFeed(url=absolute, title=title, kind="atom" if kind == "atom" else "rss")

        # Structural + SSRF validation, so the UI never offers a blocked target.
        feed_valid, feed_code, feed_message = validate_feed_url(absolute)
        if not feed_valid:
            feed.status = "blocked"
            feed.error_code = feed_code
            feed.error_message = feed_message

        candidates.append(feed)
        if len(candidates) >= max_candidates:
            break

    return DiscoveryResult(ok=True, page_url=final_url, page_title=page_title, feeds=candidates)
