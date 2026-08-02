"""Endpoint-level regression evidence for issue #221."""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
import statistics
import time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api import mentions as mentions_module
from app.api.mentions import _mention_cache_key
from app.core.database import get_db
from app.core.security import get_current_active_user
from app.main import app
from app.models.mention import AIAnalysis, Mention, MentionVisit, SentimentScore
from app.models.source import Source, SourceType


@pytest.fixture()
def mention_feed(monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "REDIS_URL", "")
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    for table in (
        Source.__table__,
        Mention.__table__,
        AIAnalysis.__table__,
        MentionVisit.__table__,
    ):
        table.create(engine)
    session_factory = sessionmaker(bind=engine, expire_on_commit=False)

    with session_factory() as db:
        sources = [
            Source(
                id=organization_id,
                organization_id=organization_id,
                user_id=organization_id,
                group_id=organization_id,
                name=f"Source {organization_id}",
                source_type=SourceType.NEWS,
                url=f"https://example{organization_id}.test",
            )
            for organization_id in (1, 2)
        ]
        db.add_all(sources)
        collected_base = datetime(2026, 7, 28, 8, tzinfo=timezone.utc)
        mentions = []
        analyses = []
        for organization_id in (1, 2):
            for position in range(100):
                mention_id = (organization_id - 1) * 100 + position + 1
                mention = Mention(
                    id=mention_id,
                    organization_id=organization_id,
                    user_id=organization_id,
                    project_id=organization_id,
                    keyword_id=organization_id,
                    source_id=organization_id,
                    source_type="news",
                    domain=f"example{organization_id}.test",
                    author="alpha" if position % 2 == 0 else "beta",
                    title=f"tenant-{organization_id} benchmark mention {position}",
                    snippet=f"Compact list snippet {position}",
                    content="x" * 2048,
                    meta_data={"media_url": "https://example.test/video.mp4", "blob": "y" * 512},
                    url=f"https://example{organization_id}.test/{position}",
                    canonical_url=f"https://example{organization_id}.test/{position}",
                    sentiment="negative",
                    influence_score=None if position % 13 == 0 else position % 9,
                    views_count=position % 7,
                    comments_count=position % 3,
                    likes_count=position % 5,
                    shares_count=position % 2,
                    verification_status="verified",
                    is_reviewed=position % 2 == 0,
                    is_muted=False,
                    is_deleted=False,
                    collected_at=collected_base - timedelta(seconds=position),
                )
                mentions.append(mention)
                if position % 11 != 0:
                    analyses.append(
                        AIAnalysis(
                            mention_id=mention_id,
                            sentiment=SentimentScore.NEGATIVE,
                            risk_score=(position % 7) * 10,
                            crisis_level=3,
                            summary_vi="Benchmark analysis",
                            ai_provider="test",
                        )
                    )
        db.add_all(mentions + analyses)
        db.commit()

    user_holder = {
        "user": SimpleNamespace(
            id=1,
            current_organization_id=1,
            role="viewer",
            is_superuser=False,
            is_active=True,
        )
    }

    def override_db():
        with session_factory() as db:
            yield db

    def override_user():
        return user_holder["user"]

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_active_user] = override_user
    mentions_module._MENTIONS_SEARCH_CACHE.clear()
    try:
        yield TestClient(app), engine, user_holder
    finally:
        mentions_module._MENTIONS_SEARCH_CACHE.clear()
        app.dependency_overrides.clear()
        engine.dispose()


def test_actual_100_row_request_uses_at_most_five_selects(mention_feed):
    client, engine, _ = mention_feed
    statements = []

    def record_statement(_conn, _cursor, statement, _parameters, _context, _many):
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement)

    event.listen(engine, "before_cursor_execute", record_statement)
    try:
        response = client.get("/api/mentions?page_size=100&expand=false")
    finally:
        event.remove(engine, "before_cursor_execute", record_statement)

    assert response.status_code == 200
    assert len(response.json()["items"]) == 100
    assert len(statements) <= 5, statements
    assert sum("ai_analysis" in statement.lower() for statement in statements) == 1


def test_100_row_page_latency_stays_bounded(mention_feed):
    client, _engine, _ = mention_feed
    warmup = client.get("/api/mentions?page_size=100&expand=false")
    assert warmup.status_code == 200

    durations_ms = []
    for _ in range(10):
        started = time.perf_counter()
        response = client.get("/api/mentions?page_size=100&expand=false")
        durations_ms.append((time.perf_counter() - started) * 1000)
        assert response.status_code == 200

    ordered = sorted(durations_ms)
    p95_ms = ordered[max(0, int(len(ordered) * 0.95) - 1)]
    assert statistics.median(ordered) < 250, ordered
    assert p95_ms < 750, ordered


def test_cache_is_scoped_by_organization_and_user(mention_feed):
    client, _engine, user_holder = mention_feed

    first = client.get("/api/mentions?q=benchmark&page_size=1")
    assert first.status_code == 200
    assert first.json()["items"][0]["title"].startswith("tenant-1")

    user_holder["user"] = SimpleNamespace(
        id=2,
        current_organization_id=2,
        role="viewer",
        is_superuser=False,
        is_active=True,
    )
    second = client.get("/api/mentions?q=benchmark&page_size=1")

    assert second.status_code == 200
    assert second.json()["items"][0]["title"].startswith("tenant-2")
    assert len(mentions_module._MENTIONS_SEARCH_CACHE) == 2


def test_cache_key_covers_every_list_filter():
    user = SimpleNamespace(id=7, current_organization_id=9)
    filters = {
        "page": 1,
        "page_size": 20,
        "cursor": None,
        "expand": False,
        "source_id": 1,
        "source_type": "news",
        "source_types": ["news"],
        "sentiment": "negative",
        "sentiments": ["negative"],
        "min_risk_score": 50,
        "search_query": "needle",
        "q": "needle",
        "author": "alpha",
        "domain": "example.test",
        "date_from": "2026-07-01T00:00:00Z",
        "date_to": "2026-07-31T00:00:00Z",
        "job_id": None,
        "keyword_id": 3,
        "keyword": "brand",
        "project_id": 4,
        "is_muted": False,
        "is_reviewed": True,
        "min_influence_score": 10,
        "sort_by": "newest",
    }
    baseline = _mention_cache_key(user, **filters)
    for name, value in filters.items():
        changed = dict(filters)
        changed[name] = f"changed-{name}" if not isinstance(value, bool) else not value
        assert _mention_cache_key(user, **changed) != baseline, name


def test_offset_pages_are_rejected_and_cursor_advances(mention_feed):
    client, _engine, _ = mention_feed

    rejected = client.get("/api/mentions?page=2&page_size=10")
    assert rejected.status_code == 400
    assert "cursor" in rejected.json()["detail"].lower()

    first = client.get("/api/mentions?page_size=10")
    cursor = first.json()["next_cursor"]
    second = client.get("/api/mentions?page_size=10", params={"cursor": cursor})

    assert second.status_code == 200
    assert first.json()["items"][-1]["id"] != second.json()["items"][0]["id"]


def test_first_and_later_pages_are_contiguous_without_duplicates(mention_feed):
    client, _engine, _ = mention_feed
    seen_ids = []
    cursor = None

    for _page_number in range(1, 5):
        params = {"page_size": 10, "sort_by": "newest"}
        if cursor:
            params["cursor"] = cursor
        response = client.get("/api/mentions", params=params)
        assert response.status_code == 200
        payload = response.json()
        page_ids = [item["id"] for item in payload["items"]]
        assert len(page_ids) == 10
        assert not set(page_ids).intersection(seen_ids)
        seen_ids.extend(page_ids)
        cursor = payload["next_cursor"]

    assert seen_ids == list(range(1, 41))


def test_empty_result_preserves_pagination_contract(mention_feed):
    client, _engine, _ = mention_feed

    response = client.get("/api/mentions", params={"q": "definitely-absent"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["items"] == []
    assert payload["total"] == 0
    assert payload["page"] == 1
    assert payload["total_pages"] == 1
    assert payload["has_next"] is False
    assert payload["has_prev"] is False
    assert payload["next_cursor"] is None
    assert payload["pagination_mode"] == "cursor"


@pytest.mark.parametrize(
    ("params", "expected_status"),
    [
        ({"page_size": 0}, 422),
        ({"page_size": 101}, 422),
        ({"page": 0}, 422),
        ({"sort_by": "not-a-sort"}, 422),
        ({"cursor": "not-a-cursor"}, 400),
    ],
)
def test_invalid_pagination_values_fail_closed(mention_feed, params, expected_status):
    client, _engine, _ = mention_feed

    response = client.get("/api/mentions", params=params)

    assert response.status_code == expected_status


def test_cursor_cannot_be_reused_with_a_different_sort(mention_feed):
    client, _engine, _ = mention_feed
    first = client.get("/api/mentions", params={"page_size": 10, "sort_by": "newest"})
    assert first.status_code == 200

    response = client.get(
        "/api/mentions",
        params={
            "page_size": 10,
            "sort_by": "oldest",
            "cursor": first.json()["next_cursor"],
        },
    )

    assert response.status_code == 400


def test_project_filter_cannot_cross_tenant_boundary(mention_feed):
    client, _engine, _ = mention_feed

    own = client.get("/api/mentions", params={"project_id": 1, "page_size": 100})
    foreign = client.get("/api/mentions", params={"project_id": 2, "page_size": 100})

    assert own.status_code == 200
    assert len(own.json()["items"]) == 100
    assert foreign.status_code == 200
    assert foreign.json()["items"] == []
    assert foreign.json()["total"] == 0


@pytest.mark.parametrize(
    "params",
    [
        {"is_reviewed": True},
        {"is_reviewed": False},
        {"min_risk_score": 50},
        {"min_influence_score": 7},
    ],
)
def test_filtered_total_matches_the_returned_page(mention_feed, params):
    client, _engine, _ = mention_feed

    response = client.get(
        "/api/mentions",
        params={**params, "page_size": 100, "expand": False},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == len(payload["items"])


def test_engagement_and_search_cursor_pages_are_stable(mention_feed):
    client, _engine, _ = mention_feed
    first = client.get(
        "/api/mentions",
        params={"page_size": 10, "sort_by": "engagement_high", "q": "benchmark"},
    )
    cursor = first.json()["next_cursor"]
    second = client.get(
        "/api/mentions",
        params={
            "page_size": 10,
            "sort_by": "engagement_high",
            "q": "benchmark",
            "cursor": cursor,
        },
    )
    first_ids = [item["id"] for item in first.json()["items"]]
    second_ids = [item["id"] for item in second.json()["items"]]
    assert cursor
    assert not set(first_ids).intersection(second_ids)


@pytest.mark.parametrize(
    "sort_by",
    ["risk_high", "risk_low", "influence_high", "engagement_high"],
)
def test_composite_sort_cursors_cover_all_rows_without_gaps_or_duplicates(
    mention_feed, sort_by
):
    client, _engine, _ = mention_feed
    collected_ids = []
    cursor = None

    while True:
        params = {"page_size": 13, "sort_by": sort_by}
        if cursor:
            params["cursor"] = cursor
        response = client.get("/api/mentions", params=params)
        assert response.status_code == 200
        payload = response.json()
        collected_ids.extend(item["id"] for item in payload["items"])
        cursor = payload["next_cursor"]
        if cursor is None:
            break

    assert len(collected_ids) == 100
    assert len(set(collected_ids)) == 100
    positions = {mention_id: mention_id - 1 for mention_id in range(1, 101)}

    def risk(position):
        return None if position % 11 == 0 else (position % 7) * 10

    def influence(position):
        return None if position % 13 == 0 else position % 9

    def engagement(position):
        return position % 7 + position % 3 + position % 5 + position % 2

    if sort_by == "risk_high":
        expected = sorted(
            positions,
            key=lambda mention_id: (
                risk(positions[mention_id]) is None,
                -(risk(positions[mention_id]) or 0),
                positions[mention_id],
            ),
        )
    elif sort_by == "risk_low":
        expected = sorted(
            positions,
            key=lambda mention_id: (
                risk(positions[mention_id]) is None,
                risk(positions[mention_id]) or 0,
                positions[mention_id],
            ),
        )
    elif sort_by == "influence_high":
        expected = sorted(
            positions,
            key=lambda mention_id: (
                influence(positions[mention_id]) is None,
                -(influence(positions[mention_id]) or 0),
                positions[mention_id],
            ),
        )
    else:
        expected = sorted(
            positions,
            key=lambda mention_id: (
                -engagement(positions[mention_id]),
                positions[mention_id],
            ),
        )
    assert collected_ids == expected


def test_slim_payload_is_opt_in_without_breaking_expanded_clients(mention_feed):
    client, _engine, _ = mention_feed
    slim = client.get("/api/mentions?page_size=1&expand=false").json()["items"][0]
    expanded = client.get("/api/mentions?page_size=1&expand=true").json()["items"][0]
    default_payload = client.get("/api/mentions?page_size=1").json()["items"][0]

    assert slim["content"] is None
    assert slim["metadata"] is None
    assert expanded["content"]
    assert expanded["metadata"]
    assert default_payload["content"] == expanded["content"]
    assert default_payload["metadata"] == expanded["metadata"]


def test_summary_aggregations_are_bounded_to_three_selects(mention_feed):
    client, engine, _ = mention_feed
    statements = []

    def record_statement(_conn, _cursor, statement, _parameters, _context, _many):
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement)

    event.listen(engine, "before_cursor_execute", record_statement)
    try:
        response = client.get("/api/mentions/summary")
    finally:
        event.remove(engine, "before_cursor_execute", record_statement)

    assert response.status_code == 200
    assert response.json()["total"] == 100
    assert len(statements) <= 3, statements


def test_chart_aggregation_is_one_select_and_preserves_results(mention_feed):
    client, engine, _ = mention_feed
    statements = []

    def record_statement(_conn, _cursor, statement, _parameters, _context, _many):
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement)

    event.listen(engine, "before_cursor_execute", record_statement)
    try:
        response = client.get("/api/mentions/charts?granularity=daily")
    finally:
        event.remove(engine, "before_cursor_execute", record_statement)

    assert response.status_code == 200
    assert len(statements) == 1, statements
    assert response.json() == {
        "items": [
            {
                "date": "2026-07-28",
                "total_mentions": 100,
                "reach": 3730,
                "sentiment_positive": 0,
                "sentiment_neutral": 0,
                "sentiment_negative": 100,
            }
        ],
        "granularity": "daily",
    }
