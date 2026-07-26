"""
OPML subscription-list import.

OPML is the standard export format of every feed reader, so importing it is the
cheapest way for a user to bring an existing set of real subscriptions into
Nope360. This module only *parses and validates*; persistence happens in the
sources API after the user confirms the preview.

Parsing is deliberately defensive:
- size ceiling before parsing
- `<!DOCTYPE ...>` rejected outright, which removes entity-expansion
  (billion-laughs / XXE) attacks at the source
- lxml parser configured with resolve_entities=False, load_dtd=False,
  no_network=True and huge_tree=False
- outline count capped
- feed URLs validated with the same guards used for collection, so an OPML file
  cannot smuggle in an internal address
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from app.services.feed_fetcher import validate_feed_url_structure

logger = logging.getLogger(__name__)

MAX_OPML_BYTES = 2 * 1024 * 1024  # 2 MB
MAX_OUTLINES = 500

DOCTYPE_RE = re.compile(rb"<!\s*DOCTYPE", re.IGNORECASE)
ENTITY_DECL_RE = re.compile(rb"<!\s*ENTITY", re.IGNORECASE)

ERROR_MESSAGES = {
    "empty_file": "Tệp OPML rỗng.",
    "too_large": "Tệp OPML vượt quá giới hạn 2 MB.",
    "doctype_forbidden": "Tệp OPML chứa khai báo DOCTYPE nên bị từ chối.",
    "invalid_xml": "Tệp không phải XML/OPML hợp lệ.",
    "not_opml": "Tệp không có cấu trúc OPML (thiếu thẻ <opml> hoặc <body>).",
    "no_feeds": "Không tìm thấy feed nào trong tệp OPML.",
}


def message_for(code: str) -> str:
    return ERROR_MESSAGES.get(code, ERROR_MESSAGES["invalid_xml"])


@dataclass
class OpmlFeed:
    url: str
    title: Optional[str] = None
    kind: str = "rss"
    # "available" -> can be imported, "blocked" -> rejected by the URL guards
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
class OpmlParseResult:
    ok: bool
    title: Optional[str] = None
    feeds: List[OpmlFeed] = field(default_factory=list)
    duplicates_in_file: int = 0
    truncated: bool = False
    error_code: str = ""
    error_message: str = ""

    def to_dict(self) -> Dict:
        return {
            "ok": self.ok,
            "title": self.title,
            "feeds": [feed.to_dict() for feed in self.feeds],
            "duplicates_in_file": self.duplicates_in_file,
            "truncated": self.truncated,
            "error_code": self.error_code,
            "error_message": self.error_message,
        }


def _fail(code: str) -> OpmlParseResult:
    return OpmlParseResult(ok=False, error_code=code, error_message=message_for(code))


def _normalize(url: str) -> str:
    from app.services.feed_discovery import normalize_feed_url

    return normalize_feed_url(url)


def _kind_for(outline_type: str, url: str) -> str:
    lowered = (outline_type or "").lower()
    if "atom" in lowered:
        return "atom"
    if "atom" in (url or "").lower():
        return "atom"
    return "rss"


def parse_opml(content: bytes, *, max_bytes: int = MAX_OPML_BYTES, max_outlines: int = MAX_OUTLINES) -> OpmlParseResult:
    """Parse an OPML document into validated feed candidates."""
    if not content:
        return _fail("empty_file")
    if len(content) > max_bytes:
        return _fail("too_large")

    # Reject DTDs before handing anything to a parser. With no DOCTYPE there is
    # no internal entity table, so entity-expansion attacks cannot start.
    if DOCTYPE_RE.search(content) or ENTITY_DECL_RE.search(content):
        return _fail("doctype_forbidden")

    try:
        from lxml import etree

        parser = etree.XMLParser(
            resolve_entities=False,
            load_dtd=False,
            dtd_validation=False,
            no_network=True,
            huge_tree=False,
            recover=False,
        )
        root = etree.fromstring(content, parser=parser)
    except Exception as exc:
        logger.info("OPML parse failed: %s", exc)
        return _fail("invalid_xml")

    tag = etree.QName(root).localname.lower() if root is not None else ""
    if tag != "opml":
        # Some readers export a bare <body>/<outline> tree; accept that, reject
        # anything else (e.g. an RSS file uploaded by mistake).
        if tag not in ("body", "outline"):
            return _fail("not_opml")

    head_title = None
    for node in root.iter():
        if etree.QName(node).localname.lower() == "title" and node.text and node.text.strip():
            head_title = node.text.strip()
            break

    seen = set()
    feeds: List[OpmlFeed] = []
    duplicates = 0
    truncated = False

    for node in root.iter():
        if etree.QName(node).localname.lower() != "outline":
            continue

        # xmlUrl is the OPML attribute carrying the feed address; readers differ
        # in capitalisation, so match case-insensitively.
        xml_url = None
        outline_type = ""
        title = None
        for attr, value in node.attrib.items():
            lowered_attr = str(attr).lower()
            if lowered_attr == "xmlurl":
                xml_url = (value or "").strip()
            elif lowered_attr == "type":
                outline_type = (value or "").strip()
            elif lowered_attr in ("title", "text") and title is None:
                candidate = (value or "").strip()
                title = candidate or None

        if not xml_url:
            continue

        key = _normalize(xml_url)
        if not key:
            continue
        if key in seen:
            duplicates += 1
            continue
        seen.add(key)

        feed = OpmlFeed(url=xml_url, title=title, kind=_kind_for(outline_type, xml_url))
        # Structural screening only: an OPML file can list hundreds of feeds and
        # the preview must not fire hundreds of DNS lookups. The full check (DNS,
        # address ranges, reachability, real RSS/Atom content) runs per feed at
        # import time, and its outcome is what the user sees as the final status.
        is_valid, code, message = validate_feed_url_structure(xml_url)
        if not is_valid:
            feed.status = "blocked"
            feed.error_code = code
            feed.error_message = message

        feeds.append(feed)

        if len(feeds) >= max_outlines:
            truncated = True
            break

    if not feeds:
        return _fail("no_feeds")

    return OpmlParseResult(
        ok=True,
        title=head_title,
        feeds=feeds,
        duplicates_in_file=duplicates,
        truncated=truncated,
    )
