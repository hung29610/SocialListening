import logging
import hashlib
import os
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional
import unicodedata
import feedparser
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.source import Source, SourceType
from app.models.source_item import SourceItem
from app.models.keyword import Keyword, KeywordGroup
from app.models.mention import Mention
from app.core.config import settings
from app.services.feed_fetcher import fetch_url, validate_feed_url
from app.services.url_utils import clean_final_url, domain_from_url, extract_google_news_embedded_url, is_google_news_discovery_url

logger = logging.getLogger(__name__)

# Kept for backwards compatibility with callers/tests that import them; the
# actual request settings now live in app.services.feed_fetcher.
USER_AGENT = "Mozilla/5.0 (compatible; Nope360Bot/1.0; +https://nope360.com)"
REQUEST_TIMEOUT = 15

try:
    MAX_FEED_ENTRIES = min(int(os.getenv("CRAWL_MAX_RESULTS_PER_SOURCE", "50")), 200)
except ValueError:
    MAX_FEED_ENTRIES = 50


def validate_rss_feed(url: str) -> tuple[bool, str, str]:
    """
    Validate if a URL is a valid, safely reachable RSS/Atom feed.

    Returns (is_valid, error_code, error_message).
    """
    result = fetch_url(url)
    if not result.ok:
        return False, result.error_code, result.error_message

    feed = feedparser.parse(result.content)
    if feed.bozo and not feed.entries:
        return False, "invalid_xml", "URL không chứa XML/RSS hợp lệ."

    return True, "", ""

def normalize_url(url: str) -> str:
    """Normalize URL for deduplication."""
    if not url: return ""
    try:
        parsed = urlparse(url)
        return f"{parsed.scheme}://{parsed.netloc.lower()}{parsed.path.rstrip('/')}"
    except Exception:
        return url.strip()

def clean_html(raw_html: str) -> str:
    if not raw_html: return ""
    soup = BeautifulSoup(raw_html, "html.parser")
    return soup.get_text(separator=' ', strip=True)


# Feed content is third-party HTML. We store a reduced form so that anything
# rendering it later cannot execute scripts or load active content.
_UNSAFE_HTML_TAGS = ("script", "style", "iframe", "object", "embed", "form", "link", "meta", "svg", "base")
_UNSAFE_URL_PREFIXES = ("javascript:", "data:text/html", "vbscript:")


def sanitize_feed_html(raw_html: str) -> str:
    """
    Strip active content from feed-provided HTML.

    Removes script-like elements entirely, drops every event handler attribute
    and neutralises javascript:/vbscript:/data:text/html URLs. Layout markup is
    preserved so snippets stay readable.
    """
    if not raw_html:
        return ""
    try:
        soup = BeautifulSoup(raw_html, "html.parser")
        for tag_name in _UNSAFE_HTML_TAGS:
            for tag in soup.find_all(tag_name):
                tag.decompose()

        for tag in soup.find_all(True):
            for attr in list(tag.attrs):
                lowered = attr.lower()
                if lowered.startswith("on") or lowered in ("srcdoc", "formaction"):
                    del tag.attrs[attr]
                    continue
                if lowered in ("href", "src", "action", "xlink:href"):
                    value = tag.attrs.get(attr)
                    if isinstance(value, str):
                        normalized = value.strip().lower().replace("\n", "").replace("\t", "")
                        if any(normalized.startswith(prefix) for prefix in _UNSAFE_URL_PREFIXES):
                            del tag.attrs[attr]
        return str(soup)
    except Exception as exc:
        # Never let sanitisation failure poison the pipeline; fall back to text.
        logger.info("Feed HTML sanitisation failed, storing plain text instead: %s", exc)
        return clean_html(raw_html)


def strip_accents(s: str) -> str:
    if not s: return ""
    s = s.replace('đ', 'd').replace('Đ', 'D')
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

def generate_content_hash(text: str) -> str:
    return hashlib.sha256(text.strip().encode('utf-8')).hexdigest()

def fetch_and_parse_feed(url: str, max_entries: int = None) -> Dict:
    """
    Fetch and parse an RSS/Atom feed through the guarded fetcher.

    A malformed feed, an unreachable host or a blocked (internal) target is
    reported as a failed result for this single feed; it never raises, so one bad
    source cannot abort a collection run covering other sources.
    """
    limit = max_entries if max_entries is not None else MAX_FEED_ENTRIES
    try:
        fetched = fetch_url(url)
        if not fetched.ok:
            return {"success": False, "error": fetched.error_message, "error_code": fetched.error_code}

        feed = feedparser.parse(fetched.content)
        if feed.bozo and not feed.entries:
            # feedparser records the underlying exception; keep it out of the
            # user-facing message and log level noise.
            logger.info("Feed parse failed for %s: %s", url, getattr(feed, "bozo_exception", "unknown"))
            return {"success": False, "error": "Nội dung nguồn không phải RSS/Atom hợp lệ.", "error_code": "invalid_xml"}

        items = []
        for entry in feed.entries[:limit]:
            title = entry.get('title', '').strip()
            link = entry.get('link', '').strip()
            guid = entry.get('id', '') or entry.get('guid', '') or link
            final_link = clean_final_url(link) or extract_google_news_embedded_url(link)
            if not final_link:
                logger.info("Skipping RSS entry with invalid/discovery/media URL: %s", link)
                continue
            discovery_url = link if is_google_news_discovery_url(link) else None
            
            # Content / description
            description = entry.get('summary', '') or entry.get('description', '')
            if entry.get('content'):
                description = entry.content[0].get('value', description)
            
            snippet = clean_html(description)[:1000]
            
            # Dates
            published_at = None
            if hasattr(entry, 'published_parsed') and entry.published_parsed:
                try:
                    published_at = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
                except:
                    pass
            elif hasattr(entry, 'updated_parsed') and entry.updated_parsed:
                try:
                    published_at = datetime(*entry.updated_parsed[:6], tzinfo=timezone.utc)
                except:
                    pass
                    
            # Media
            image_url = None
            media_url = None
            media_thumbnail = None
            
            # Check enclosures
            if entry.get('enclosures'):
                for enc in entry.enclosures:
                    if 'image' in enc.get('type', ''):
                        image_url = enc.get('href')
                    elif 'video' in enc.get('type', ''):
                        media_url = enc.get('href')
                        
            # Check media namespace (VnE GO uses this)
            if hasattr(entry, 'media_content') and len(entry.media_content) > 0:
                media_url = entry.media_content[0].get('url')
            if hasattr(entry, 'media_thumbnail') and len(entry.media_thumbnail) > 0:
                media_thumbnail = entry.media_thumbnail[0].get('url')
                
            # If no image found, try extracting from description HTML
            if not image_url and not media_thumbnail and description:
                soup = BeautifulSoup(description, "html.parser")
                img = soup.find("img")
                if img and img.get("src"):
                    image_url = img["src"]
            
            items.append({
                "title": title,
                "url": final_link,
                "canonical_url": final_link,
                "original_url": discovery_url,
                "domain": domain_from_url(final_link),
                "guid": guid,
                "snippet": snippet,
                "html_description": sanitize_feed_html(description),
                "published_at": published_at,
                "image_url": image_url,
                "media_url": media_url,
                "media_thumbnail": media_thumbnail,
                "author": entry.get('author', '')
            })
            
        return {"success": True, "items": items}
    except Exception as e:
        logger.warning("Unexpected error while parsing feed %s: %s", url, e)
        return {"success": False, "error": "Không xử lý được nội dung nguồn.", "error_code": "parse_failed"}

def run_rss_collector(db: Session, source_ids: List[int] = None, ad_hoc_keywords: List[str] = None, ad_hoc_project_id: int = None) -> Dict:
    """Run RSS collection for given sources or all active RSS sources."""
    query = select(Source).where(Source.is_active == True, Source.source_type == 'rss')
    if source_ids:
        query = query.where(Source.id.in_(source_ids))
        
    sources = db.execute(query).scalars().all()
    
    result = {
        "status": "COMPLETED",
        "sources_scanned": len(sources),
        "items_seen": 0,
        "source_items_created": 0,
        "duplicates_skipped": 0,
        "mentions_created": 0,
        "errors": []
    }
    
    active_keywords = db.execute(select(Keyword).where(Keyword.is_active == True, Keyword.is_excluded == False)).scalars().all()
    
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    
    for source in sources:
        try:
            feed_data = fetch_and_parse_feed(source.url)
            if not feed_data["success"]:
                # Persist a stable "<code>: <message>" pair. The Sources UI keys
                # off the code to explain the failure, and the message is already
                # scrubbed of internal network detail by the fetcher.
                error_code = feed_data.get("error_code") or "rss_fetch_failed"
                error_text = feed_data["error"]
                source.last_error = f"{error_code}: {error_text}" if error_code not in error_text else error_text
                source.error_count = (source.error_count or 0) + 1
                result["errors"].append({
                    "source_id": source.id,
                    "error": error_text,
                    "error_code": error_code,
                })
                result["status"] = "PARTIAL_FAILED"
                db.commit()
                continue
                
            source.last_success_at = datetime.now(timezone.utc)
            source.last_error = None
            source.error_count = 0
            
            items = feed_data["items"]
            result["items_seen"] += len(items)
            
            for item in items:
                # Deduplication logic
                norm_url = normalize_url(item["url"])
                content_for_hash = f"{item['title']} {item['snippet']}"
                content_hash = generate_content_hash(content_for_hash)
                
                # Check if exists in source_items
                exists = db.execute(
                    select(SourceItem.id).where(
                        (SourceItem.normalized_url == norm_url) |
                        ((SourceItem.guid == item["guid"]) & (SourceItem.guid != '')) |
                        (SourceItem.content_hash == content_hash)
                    )
                ).scalar_one_or_none()
                
                if exists:
                    result["duplicates_skipped"] += 1
                    continue
                    
                # Date filtering (skip old items)
                pub_date = item["published_at"] or datetime.now(timezone.utc)
                if pub_date < thirty_days_ago:
                    result["duplicates_skipped"] += 1
                    continue
                    
                # Save to source_items
                source_item = SourceItem(
                    source_type="rss",
                    platform=source.platform or "web",
                    source_id=source.id,
                    source_name=source.name,
                    url=item["url"],
                    normalized_url=norm_url,
                    domain=item.get("domain"),
                    title=item["title"],
                    snippet=item["snippet"],
                    author=item["author"],
                    published_at=item["published_at"],
                    collected_at=datetime.now(timezone.utc),
                    guid=item["guid"],
                    image_url=item["image_url"],
                    media_url=item["media_url"],
                    media_thumbnail=item["media_thumbnail"],
                    raw_payload_json={"discovery_url": item.get("original_url")} if item.get("original_url") else None,
                    content_hash=content_hash,
                    status="collected"
                )
                db.add(source_item)
                db.flush()
                result["source_items_created"] += 1
                
                # Matching engine
                matched_kws = []
                text_to_match = strip_accents(f"{item['title']} {item['snippet']}".lower())
                
                project_id = None
                
                # Match ad-hoc keywords first
                for kw in (ad_hoc_keywords or []):
                    kw_norm = strip_accents(kw.lower())
                    if kw_norm in text_to_match:
                        matched_kws.append({"keyword": kw, "count": text_to_match.count(kw_norm)})
                        if not project_id and ad_hoc_project_id:
                            project_id = ad_hoc_project_id

                first_matched_keyword = None
                for kw in active_keywords:
                    kw_norm = strip_accents(kw.keyword.lower())
                    if kw_norm in text_to_match:
                        matched_kws.append({"keyword": kw.keyword, "count": text_to_match.count(kw_norm)})
                        if first_matched_keyword is None:
                            first_matched_keyword = kw

                if matched_kws and not project_id and first_matched_keyword is not None:
                    # A "project" is a KeywordGroup row (see Subscription.project_id,
                    # which is a FK to keyword_groups.id), so the owning group id IS
                    # the project id.
                    #
                    # Two defects fixed here:
                    #  1. attribution used active_keywords[0] instead of the keyword
                    #     that actually matched, filing items under a foreign project;
                    #  2. it then read kw_group.project_id, which does not exist on
                    #     KeywordGroup — the AttributeError aborted the whole source,
                    #     so keyword-matched RSS mentions were never stored.
                    kw_group = db.get(KeywordGroup, first_matched_keyword.group_id)
                    project_id = kw_group.id if kw_group else None


                # Always create mention so user can search for broader keywords on the web
                m_exists = db.execute(
                    select(Mention.id).where(
                        Mention.url == norm_url
                    )
                ).scalar_one_or_none()
                
                if not m_exists and matched_kws:
                    mention = Mention(
                        project_id=project_id,
                        keyword_text=matched_kws[0]["keyword"],
                        source_id=source.id,
                        source_type="rss",
                        platform=source.platform or "web",
                        domain=item.get("domain"),
                        title=item["title"],
                        url=norm_url,
                        canonical_url=item.get("canonical_url") or norm_url,
                        original_url=item.get("original_url"),
                        snippet=item["snippet"],
                        content=item["html_description"],
                        content_hash=content_hash,
                        published_at=item["published_at"],
                        collected_at=datetime.now(timezone.utc),
                        extraction_source="rss",
                        sentiment="neutral",
                        confidence="medium",
                        matched_keywords=matched_kws if matched_kws else None,
                        meta_data={
                            "image_url": item.get("image_url"),
                            "media_url": item.get("media_url"),
                            "media_thumbnail": item.get("media_thumbnail")
                        }
                    )
                    db.add(mention)
                    db.flush()  # Get mention.id for AIAnalysis
                    result["mentions_created"] += 1
                    source_item.status = "matched" if matched_kws else "collected"

                    # AI Analysis (non-blocking, mirrors crawl_service.py pattern)
                    try:
                        from app.services.ai_service import analyze_mention as ai_analyze
                        from app.models.mention import AIAnalysis
                        from app.models.alert import Alert, AlertSeverity, AlertStatus

                        text_for_ai = f"{item['title']}\n\n{item['snippet']}"
                        analysis_result = ai_analyze(text_for_ai, item["title"])

                        if analysis_result.get("status") == "success":
                            ai_analysis = AIAnalysis(
                                mention_id=mention.id,
                                sentiment=analysis_result["sentiment"],
                                risk_score=analysis_result["risk_score"],
                                crisis_level=analysis_result.get("crisis_level", 2),
                                summary_vi=analysis_result.get("summary_vi", ""),
                                suggested_action=analysis_result.get("suggested_action", "monitor"),
                                responsible_department=analysis_result.get("responsible_department", "customer_service"),
                                confidence_score=analysis_result.get("confidence_score", 65.0),
                                ai_provider=analysis_result.get("ai_provider", "unknown"),
                                model_version=analysis_result.get("model_version", "unknown"),
                                processing_time_ms=analysis_result.get("processing_time_ms", 0),
                            )
                            db.add(ai_analysis)

                            # Update mention sentiment based on AI result
                            mention.sentiment = analysis_result["sentiment"]

                            # Create alert if high risk
                            if analysis_result["risk_score"] >= 70:
                                severity = AlertSeverity.CRITICAL if analysis_result["risk_score"] >= 85 else AlertSeverity.HIGH
                                alert = Alert(
                                    mention_id=mention.id,
                                    severity=severity,
                                    status=AlertStatus.NEW,
                                    title=f"High risk mention: {mention.title or mention.url}",
                                    message=f"Risk: {analysis_result['risk_score']}, Sentiment: {analysis_result['sentiment']}"
                                )
                                db.add(alert)
                    except Exception as ai_err:
                        logger.info(f"AI analysis skipped for RSS mention {mention.id}: {ai_err}")
                
            db.commit()
            
        except Exception as e:
            logger.error(f"Error processing RSS source {source.id}: {e}")
            result["errors"].append({"source_id": source.id, "error": str(e)})
            result["status"] = "PARTIAL_FAILED"
            db.rollback()
            
    return result
