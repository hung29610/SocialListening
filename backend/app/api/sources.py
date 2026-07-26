import traceback
import logging
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from typing import List, Optional

from app.core.api_errors import api_error
from app.core.database import get_db
from app.core.tenant import apply_tenant_filter
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.source import Source, SourceGroup, SourceType, CrawlFrequency
from app.schemas.source import (
    SourceCreate, SourceUpdate, SourceResponse,
    SourceGroupCreate, SourceGroupUpdate, SourceGroupResponse, SourceGroupListResponse
)
from app.services.scheduler_service import calculate_next_crawl_time

logger = logging.getLogger(__name__)
router = APIRouter()


def _source_to_response(source: Source) -> SourceResponse:
    """Safely convert Source SQLAlchemy object to SourceResponse Pydantic model."""
    # Convert crawl_time (datetime.time) to "HH:MM" string if needed
    crawl_time_str = None
    if source.crawl_time is not None:
        try:
            crawl_time_str = source.crawl_time.strftime("%H:%M")
        except Exception:
            crawl_time_str = str(source.crawl_time)

    return SourceResponse(
        id=source.id,
        group_id=source.group_id,
        name=source.name,
        source_type=source.source_type,
        url=source.url,
        platform_id=source.platform_id,
        meta_data=source.meta_data,
        is_active=source.is_active,
        crawl_frequency=source.crawl_frequency,
        crawl_time=crawl_time_str,
        crawl_day_of_week=source.crawl_day_of_week,
        crawl_day_of_month=source.crawl_day_of_month,
        crawl_month=source.crawl_month,
        # Include schedule arrays
        schedule_hours=source.schedule_hours,
        schedule_days_of_week=source.schedule_days_of_week,
        schedule_days_of_month=source.schedule_days_of_month,
        schedule_months=source.schedule_months,
        next_crawl_at=source.next_crawl_at,
        last_crawled_at=source.last_crawled_at,
        last_success_at=source.last_success_at,
        last_error=source.last_error,
        crawl_count=source.crawl_count or 0,
        error_count=source.error_count or 0,
        created_at=source.created_at,
        updated_at=source.updated_at,
    )


# ─── Source Group Endpoints ───────────────────────────────────────────────────

@router.get("/groups", response_model=List[SourceGroupListResponse])
def list_source_groups(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List all source groups with source counts."""
    try:
        query = apply_tenant_filter(select(SourceGroup), SourceGroup, current_user)
        if is_active is not None:
            query = query.where(SourceGroup.is_active == is_active)
        query = query.offset(skip).limit(limit).order_by(SourceGroup.created_at.desc())
        groups = db.execute(query).scalars().all()

        response = []
        for group in groups:
            count = db.execute(
                apply_tenant_filter(select(func.count(Source.id)), Source, current_user).where(Source.group_id == group.id)
            ).scalar() or 0
            response.append(SourceGroupListResponse(
                id=group.id,
                name=group.name,
                description=group.description,
                is_active=group.is_active,
                created_at=group.created_at,
                source_count=count,
            ))
        return response
    except Exception as e:
        logger.error(f"Error listing source groups: {traceback.format_exc()}")
        raise api_error("source_list_failed", status.HTTP_500_INTERNAL_SERVER_ERROR, "Lỗi khi tải nhóm nguồn")


@router.post("/groups", response_model=SourceGroupResponse, status_code=status.HTTP_201_CREATED)
def create_source_group(
    group_data: SourceGroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new source group."""
    try:
        group_dict = group_data.dict()
        group_dict['user_id'] = current_user.id
        group = SourceGroup(**group_dict)
        db.add(group)
        db.commit()
        db.refresh(group)
        return SourceGroupResponse(
            id=group.id,
            name=group.name,
            description=group.description,
            is_active=group.is_active,
            created_at=group.created_at,
            updated_at=group.updated_at,
            sources=[],
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating source group: {traceback.format_exc()}")
        raise api_error("source_create_failed", status.HTTP_500_INTERNAL_SERVER_ERROR, "Lỗi khi tạo nhóm nguồn")


@router.get("/groups/{group_id}", response_model=SourceGroupResponse)
def get_source_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    group = db.execute(apply_tenant_filter(select(SourceGroup), SourceGroup, current_user).where(SourceGroup.id == group_id)).scalar_one_or_none()
    if not group:
        raise api_error("source_group_not_found", status.HTTP_404_NOT_FOUND, "Không tìm thấy nhóm nguồn")
    sources_in_group = db.execute(apply_tenant_filter(select(Source), Source, current_user).where(Source.group_id == group_id)).scalars().all()
    return SourceGroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        is_active=group.is_active,
        created_at=group.created_at,
        updated_at=group.updated_at,
        sources=[_source_to_response(s) for s in sources_in_group],
    )


@router.put("/groups/{group_id}", response_model=SourceGroupResponse)
def update_source_group(
    group_id: int,
    group_data: SourceGroupUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    group = db.execute(apply_tenant_filter(select(SourceGroup), SourceGroup, current_user).where(SourceGroup.id == group_id)).scalar_one_or_none()
    if not group:
        raise api_error("source_group_not_found", status.HTTP_404_NOT_FOUND, "Không tìm thấy nhóm nguồn")
    for field, value in group_data.dict(exclude_unset=True).items():
        setattr(group, field, value)
    db.commit()
    db.refresh(group)
    sources_in_group = db.execute(apply_tenant_filter(select(Source), Source, current_user).where(Source.group_id == group_id)).scalars().all()
    return SourceGroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        is_active=group.is_active,
        created_at=group.created_at,
        updated_at=group.updated_at,
        sources=[_source_to_response(s) for s in sources_in_group],
    )


@router.delete("/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_source_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    group = db.execute(apply_tenant_filter(select(SourceGroup), SourceGroup, current_user).where(SourceGroup.id == group_id)).scalar_one_or_none()
    if not group:
        raise api_error("source_group_not_found", status.HTTP_404_NOT_FOUND, "Không tìm thấy nhóm nguồn")
    db.delete(group)
    db.commit()


# ─── Source Endpoints ─────────────────────────────────────────────────────────

@router.get("", response_model=List[SourceResponse])
def list_sources(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    group_id: Optional[int] = None,
    source_type: Optional[SourceType] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List all sources. Returns [] if none exist."""
    try:
        query = apply_tenant_filter(select(Source), Source, current_user)
        if group_id is not None:
            query = query.where(Source.group_id == group_id)
        if source_type is not None:
            query = query.where(Source.source_type == source_type)
        if is_active is not None:
            query = query.where(Source.is_active == is_active)
        query = query.offset(skip).limit(limit).order_by(Source.created_at.desc())
        sources = db.execute(query).scalars().all()
        return [_source_to_response(s) for s in sources]
    except Exception as e:
        logger.error(f"Error listing sources: {traceback.format_exc()}")
        raise api_error("source_list_failed", status.HTTP_500_INTERNAL_SERVER_ERROR, "Lỗi khi tải danh sách nguồn")


@router.post("", response_model=SourceResponse, status_code=status.HTTP_201_CREATED)
def create_source(
    source_data: SourceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new source."""
    try:
        if source_data.group_id:
            group = db.execute(apply_tenant_filter(select(SourceGroup), SourceGroup, current_user).where(SourceGroup.id == source_data.group_id)).scalar_one_or_none()
            if not group:
                raise api_error("source_group_not_found", status.HTTP_404_NOT_FOUND, "Không tìm thấy nhóm nguồn")

        data = source_data.dict()
        data['user_id'] = current_user.id

        # Parse crawl_time string → datetime.time for DB column
        crawl_time_obj = None
        if data.get('crawl_time'):
            try:
                from datetime import time as dtime
                parts = data['crawl_time'].split(':')
                crawl_time_obj = dtime(int(parts[0]), int(parts[1]))
            except Exception:
                crawl_time_obj = None
        data['crawl_time'] = crawl_time_obj

        # Calculate next crawl time
        from datetime import time as dtime
        data['next_crawl_at'] = calculate_next_crawl_time(
            frequency=data['crawl_frequency'],
            crawl_time=crawl_time_obj,
            crawl_day_of_week=data.get('crawl_day_of_week'),
            crawl_day_of_month=data.get('crawl_day_of_month'),
            crawl_month=data.get('crawl_month'),
        )

        # Check for duplicate URL
        existing = db.execute(apply_tenant_filter(select(Source), Source, current_user).where(Source.url == data['url'])).scalars().first()
        if existing:
            raise api_error("source_duplicate_url", status.HTTP_409_CONFLICT, "Nguồn với URL này đã tồn tại")

        # Every source URL must be a safe, externally reachable http(s) target,
        # regardless of source type.
        from app.services.feed_fetcher import validate_feed_url
        is_url_safe, url_error_code, url_error_msg = validate_feed_url(data['url'])
        if not is_url_safe:
            raise api_error(url_error_code or "invalid_url", status.HTTP_400_BAD_REQUEST, url_error_msg)

        # Validate if RSS
        if data.get('source_type') == 'rss':
            from app.services.crawl_service import validate_rss_feed
            is_rss_valid, error_code, error_msg = validate_rss_feed(data['url'])
            if not is_rss_valid:
                raise api_error(
                    error_code or "source_invalid_feed",
                    status.HTTP_400_BAD_REQUEST,
                    error_msg or "URL này không phải RSS feed hợp lệ. Hãy đổi loại nguồn sang Website hoặc nhập link RSS hợp lệ.",
                )

        source = Source(**data)
        db.add(source)
        db.commit()
        db.refresh(source)
        return _source_to_response(source)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating source: {traceback.format_exc()}")
        raise api_error("source_create_failed", status.HTTP_500_INTERNAL_SERVER_ERROR, "Lỗi khi tạo nguồn")


# ─── Feed discovery and OPML import ───────────────────────────────────────────
#
# These routes are declared before "/{source_id}" so their literal paths are not
# captured by the integer path parameter.


class FeedDiscoveryRequest(BaseModel):
    url: str = Field(..., min_length=1, max_length=2048)


class FeedToImport(BaseModel):
    url: str = Field(..., min_length=1, max_length=2048)
    name: Optional[str] = Field(None, max_length=500)
    kind: Optional[str] = Field(None, max_length=16)


class ImportFeedsRequest(BaseModel):
    feeds: List[FeedToImport] = Field(..., min_items=1, max_items=200)
    group_id: Optional[int] = None
    # Feeds are created disabled by default so nothing collects before the user
    # has reviewed them.
    activate: bool = False


MAX_OPML_UPLOAD_BYTES = 2 * 1024 * 1024


@router.post("/discover-feeds")
def discover_feeds_endpoint(
    payload: FeedDiscoveryRequest,
    current_user: User = Depends(get_current_active_user),
):
    """
    Inspect a public website URL and return the RSS/Atom feeds it advertises.

    Nothing is created or activated: the response is a list of candidates for the
    user to choose from. An empty `feeds` list with `ok: true` is an honest
    "no feed advertised" answer, not an error.
    """
    from app.services.feed_discovery import discover_feeds

    result = discover_feeds(payload.url)
    return result.to_dict()


@router.post("/opml/preview")
async def preview_opml_endpoint(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
):
    """
    Parse an uploaded OPML file and return its feeds with per-feed validation
    status. Nothing is persisted; the user confirms with /import-feeds.
    """
    from app.services.opml_import import MAX_OPML_BYTES, message_for as opml_message, parse_opml

    filename = (file.filename or "").lower()
    if filename and not filename.endswith((".opml", ".xml")):
        raise api_error("opml_bad_extension", status.HTTP_400_BAD_REQUEST, "Chỉ hỗ trợ tệp .opml hoặc .xml")

    # Read with a hard ceiling so a large upload cannot exhaust memory.
    content = await file.read(MAX_OPML_UPLOAD_BYTES + 1)
    if content and len(content) > MAX_OPML_BYTES:
        raise api_error("opml_too_large", status.HTTP_400_BAD_REQUEST, opml_message("too_large"))

    result = parse_opml(content)
    payload = result.to_dict()
    if not result.ok:
        raise api_error(f"opml_{result.error_code}", status.HTTP_400_BAD_REQUEST, payload["error_message"])
    return payload


@router.post("/import-feeds")
def import_feeds_endpoint(
    payload: ImportFeedsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Create RSS sources from an explicitly confirmed list of feeds.

    Each feed is validated on its own and reported with an honest per-feed status:
      created   - validated and stored
      duplicate - the same URL already exists for this tenant
      blocked   - rejected by the URL guards (internal address, bad scheme, port)
      invalid   - reachable but not a valid RSS/Atom document
      failed    - fetch/validation failed for another reason (timeout, HTTP error)

    One failing feed never aborts the rest of the import.
    """
    from app.services.crawl_service import validate_rss_feed
    from app.services.feed_fetcher import validate_feed_url

    group_id = payload.group_id
    if group_id is not None:
        group = db.execute(
            apply_tenant_filter(select(SourceGroup), SourceGroup, current_user).where(SourceGroup.id == group_id)
        ).scalar_one_or_none()
        if not group:
            raise api_error("source_group_not_found", status.HTTP_404_NOT_FOUND, "Không tìm thấy nhóm nguồn")

    results = []
    created_count = 0
    seen_in_request = set()

    for item in payload.feeds:
        url = (item.url or "").strip()
        entry = {"url": url, "name": item.name, "status": "failed", "error_code": "", "error_message": "", "source_id": None}

        if not url:
            entry.update(status="invalid", error_code="invalid_url", error_message="URL không hợp lệ.")
            results.append(entry)
            continue

        if url in seen_in_request:
            entry.update(status="duplicate", error_message="Feed bị lặp trong danh sách gửi lên.")
            results.append(entry)
            continue
        seen_in_request.add(url)

        is_url_safe, url_code, url_message = validate_feed_url(url)
        if not is_url_safe:
            entry.update(status="blocked", error_code=url_code, error_message=url_message)
            results.append(entry)
            continue

        existing = db.execute(
            apply_tenant_filter(select(Source), Source, current_user).where(Source.url == url)
        ).scalars().first()
        if existing:
            entry.update(status="duplicate", source_id=existing.id, error_message="Nguồn với URL này đã tồn tại.")
            results.append(entry)
            continue

        is_feed_valid, feed_code, feed_message = validate_rss_feed(url)
        if not is_feed_valid:
            # Distinguish "not a feed" from "could not reach it".
            blocked_codes = ("blocked_target", "unsupported_scheme", "credentials_in_url", "blocked_port")
            invalid_codes = ("invalid_xml", "invalid_rss_feed", "parse_failed")
            if feed_code in blocked_codes:
                entry.update(status="blocked", error_code=feed_code, error_message=feed_message)
            elif feed_code in invalid_codes:
                entry.update(status="invalid", error_code=feed_code, error_message=feed_message)
            else:
                entry.update(status="failed", error_code=feed_code, error_message=feed_message)
            results.append(entry)
            continue

        try:
            source = Source(
                user_id=current_user.id,
                group_id=group_id,
                name=(item.name or url)[:500],
                source_type=SourceType.RSS,
                url=url,
                platform="web",
                # Never report a feed as connected before it has collected once;
                # activation is the user's explicit choice.
                is_active=bool(payload.activate),
                crawl_frequency=CrawlFrequency.DAILY,
            )
            source.next_crawl_at = calculate_next_crawl_time(frequency=CrawlFrequency.DAILY, crawl_time=None)
            db.add(source)
            db.commit()
            db.refresh(source)
            entry.update(status="created", source_id=source.id, error_code="", error_message="")
            created_count += 1
        except Exception as exc:
            db.rollback()
            logger.error("Failed to create source from imported feed: %s", exc)
            entry.update(status="failed", error_code="create_failed", error_message="Không tạo được nguồn.")

        results.append(entry)

    summary = {
        "created": created_count,
        "duplicate": sum(1 for r in results if r["status"] == "duplicate"),
        "blocked": sum(1 for r in results if r["status"] == "blocked"),
        "invalid": sum(1 for r in results if r["status"] == "invalid"),
        "failed": sum(1 for r in results if r["status"] == "failed"),
        "total": len(results),
    }
    return {"summary": summary, "results": results}


@router.get("/{source_id}", response_model=SourceResponse)
def get_source(
    source_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    source = db.execute(apply_tenant_filter(select(Source), Source, current_user).where(Source.id == source_id)).scalar_one_or_none()
    if not source:
        raise api_error("source_not_found", status.HTTP_404_NOT_FOUND, "Không tìm thấy nguồn")
    return _source_to_response(source)


@router.put("/{source_id}", response_model=SourceResponse)
def update_source(
    source_id: int,
    source_data: SourceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    source = db.execute(apply_tenant_filter(select(Source), Source, current_user).where(Source.id == source_id)).scalar_one_or_none()
    if not source:
        raise api_error("source_not_found", status.HTTP_404_NOT_FOUND, "Không tìm thấy nguồn")

    try:
        update_dict = source_data.dict(exclude_unset=True)

        # Parse crawl_time string if provided
        if 'crawl_time' in update_dict and update_dict['crawl_time']:
            try:
                from datetime import time as dtime
                parts = update_dict['crawl_time'].split(':')
                update_dict['crawl_time'] = dtime(int(parts[0]), int(parts[1]))
            except Exception:
                update_dict['crawl_time'] = None

        if 'url' in update_dict or 'source_type' in update_dict:
            final_type = update_dict.get('source_type', source.source_type)
            final_url = update_dict.get('url', source.url)

            from app.services.feed_fetcher import validate_feed_url
            is_url_safe, url_error_code, url_error_msg = validate_feed_url(final_url)
            if not is_url_safe:
                raise api_error(url_error_code or "invalid_url", status.HTTP_400_BAD_REQUEST, url_error_msg)

            if final_type == 'rss':
                from app.services.crawl_service import validate_rss_feed
                is_rss_valid, error_code, error_msg = validate_rss_feed(final_url)
                if not is_rss_valid:
                    raise api_error(
                        error_code or "source_invalid_feed",
                        status.HTTP_400_BAD_REQUEST,
                        error_msg or "URL này không phải RSS feed hợp lệ. Hãy đổi loại nguồn sang Website hoặc nhập link RSS hợp lệ.",
                    )
            # Clear error when URL or source type changes and passes validation
            source.last_error = None
            source.error_count = 0

        for field, value in update_dict.items():
            setattr(source, field, value)

        # Recalculate next crawl if schedule fields changed
        schedule_fields = {'crawl_frequency', 'crawl_time', 'crawl_day_of_week', 'crawl_day_of_month', 'crawl_month'}
        if update_dict.keys() & schedule_fields:
            source.next_crawl_at = calculate_next_crawl_time(
                frequency=source.crawl_frequency,
                crawl_time=source.crawl_time,
                crawl_day_of_week=source.crawl_day_of_week,
                crawl_day_of_month=source.crawl_day_of_month,
                crawl_month=source.crawl_month,
            )

        db.commit()
        db.refresh(source)
        return _source_to_response(source)
    except HTTPException:
        # Validation failures must keep their own status code; the generic
        # handler below previously turned every 400 into a 500.
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating source: {traceback.format_exc()}")
        raise api_error("source_update_failed", status.HTTP_500_INTERNAL_SERVER_ERROR, "Lỗi khi cập nhật nguồn")


@router.delete("/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_source(
    source_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    source = db.execute(apply_tenant_filter(select(Source), Source, current_user).where(Source.id == source_id)).scalar_one_or_none()
    if not source:
        raise api_error("source_not_found", status.HTTP_404_NOT_FOUND, "Không tìm thấy nguồn")
    db.delete(source)
    db.commit()


@router.post("/{source_id}/test")
def test_source(
    source_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Test if a source URL is reachable.

    Goes through the guarded fetcher so a stored URL cannot be used to probe
    internal addresses, and so raw network errors are not echoed back.
    """
    from app.services.feed_fetcher import fetch_url

    source = db.execute(apply_tenant_filter(select(Source), Source, current_user).where(Source.id == source_id)).scalar_one_or_none()
    if not source:
        raise api_error("source_not_found", status.HTTP_404_NOT_FOUND, "Không tìm thấy nguồn")

    result = fetch_url(source.url)
    if result.ok:
        return {
            "success": True,
            "status_code": result.status_code,
            "reachable": True,
            "url": source.url,
        }
    return {
        "success": False,
        "reachable": False,
        "status_code": result.status_code,
        "error": result.error_message,
        "error_code": result.error_code,
        "url": source.url,
    }


@router.post("/{source_id}/scan")
def scan_source(
    source_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Trigger a manual scan on a specific source."""
    source = db.execute(apply_tenant_filter(select(Source), Source, current_user).where(Source.id == source_id)).scalar_one_or_none()
    if not source:
        raise api_error("source_not_found", status.HTTP_404_NOT_FOUND, "Không tìm thấy nguồn")

    from app.models.keyword import Keyword
    from app.models.mention import Mention
    from app.api.crawl import crawl_source
    import hashlib
    from datetime import datetime

    from app.models.keyword import KeywordGroup
    
    all_keywords = db.execute(apply_tenant_filter(select(Keyword).join(KeywordGroup, Keyword.group_id == KeywordGroup.id), KeywordGroup, current_user).where(Keyword.is_active == True)).scalars().all()
    if not all_keywords:
        return {"success": False, "message": "Không có từ khóa nào được kích hoạt"}

    keyword_texts = [kw.keyword.lower() for kw in all_keywords]
    try:
        mentions_data = crawl_source(source, keyword_texts, all_keywords, db)
        new_count = 0
        for mention_data in mentions_data:
            content_hash = hashlib.sha256(mention_data['content'].encode()).hexdigest()
            existing = db.execute(apply_tenant_filter(select(Mention), Mention, current_user).where(Mention.content_hash == content_hash)).scalar_one_or_none()
            if existing:
                continue
            mention = Mention(
                source_id=source.id,
                title=mention_data.get('title'),
                content=mention_data['content'],
                content_hash=content_hash,
                url=mention_data['url'],
                author=mention_data.get('author'),
                published_at=mention_data.get('published_at'),
                matched_keywords=mention_data.get('matched_keywords', []),
            )
            db.add(mention)
            db.commit()
            db.refresh(mention)
            new_count += 1

        source.last_crawled_at = datetime.utcnow()
        source.crawl_count = (source.crawl_count or 0) + 1
        db.commit()
        return {"success": True, "new_mentions": new_count, "source_id": source_id}
    except Exception as e:
        db.rollback()
        source.last_error = str(e)
        source.error_count = (source.error_count or 0) + 1
        db.commit()
        raise api_error("source_update_failed", status.HTTP_500_INTERNAL_SERVER_ERROR, "Lỗi khi quét nguồn")
