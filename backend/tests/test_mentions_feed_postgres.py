"""Opt-in PostgreSQL benchmark for the tenant-scoped mention feed."""
from datetime import datetime, timedelta, timezone
import os
import statistics
import time
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.core.security import create_access_token, get_current_active_user
from app.main import app
from app.models.keyword import KeywordGroup
from app.models.mention import AIAnalysis, Mention, SentimentScore
from app.models.organization import Organization, OrganizationMember
from app.models.source import Source, SourceType
from app.models.user import User


TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "")
HAS_POSTGRES = TEST_DATABASE_URL.startswith(
    ("postgresql://", "postgresql+psycopg2://")
)


@pytest.fixture(scope="module")
def postgres_mention_feed():
    if not HAS_POSTGRES:
        pytest.skip("a dedicated PostgreSQL TEST_DATABASE_URL is required")

    engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, expire_on_commit=False)
    organization_id = 88001
    user_id = 88001
    project_id = 88001
    source_id = 88001
    collected_base = datetime(2026, 8, 2, 5, tzinfo=timezone.utc)

    with session_factory() as db:
        db.add_all(
            [
                Organization(
                    id=organization_id,
                    name="Mention benchmark tenant",
                    slug="mention-benchmark-tenant",
                    status="active",
                ),
                User(
                    id=user_id,
                    email="mention-benchmark@example.test",
                    hashed_password="test-only",
                    current_organization_id=organization_id,
                ),
            ]
        )
        db.flush()
        db.add_all(
            [
                OrganizationMember(
                    organization_id=organization_id,
                    user_id=user_id,
                    status="active",
                ),
                KeywordGroup(
                    id=project_id,
                    organization_id=organization_id,
                    user_id=user_id,
                    name="Mention benchmark project",
                ),
                Source(
                    id=source_id,
                    organization_id=organization_id,
                    user_id=user_id,
                    group_id=project_id,
                    name="Mention benchmark source",
                    source_type=SourceType.NEWS,
                    url="https://mention-benchmark.example.test",
                ),
            ]
        )
        db.flush()
        for position in range(100):
            mention = Mention(
                organization_id=organization_id,
                user_id=user_id,
                project_id=project_id,
                source_id=source_id,
                source_type="news",
                title=f"PostgreSQL benchmark mention {position}",
                snippet="Bounded benchmark payload",
                content="x" * 1024,
                url=f"https://mention-benchmark.example.test/{position}",
                canonical_url=f"https://mention-benchmark.example.test/{position}",
                sentiment="negative",
                verification_status="verified",
                is_muted=False,
                is_deleted=False,
                collected_at=collected_base - timedelta(seconds=position),
            )
            db.add(mention)
            db.flush()
            db.add(
                AIAnalysis(
                    mention_id=mention.id,
                    sentiment=SentimentScore.NEGATIVE,
                    risk_score=75,
                    crisis_level=3,
                    summary_vi="PostgreSQL benchmark analysis",
                    ai_provider="test",
                )
            )
        db.commit()

    def override_db():
        with session_factory() as db:
            yield db

    def override_user():
        return SimpleNamespace(
            id=user_id,
            current_organization_id=organization_id,
            role="viewer",
            is_superuser=False,
            is_active=True,
        )

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_active_user] = override_user
    try:
        token = create_access_token({"sub": str(user_id)})
        yield (
            TestClient(app, headers={"Authorization": f"Bearer {token}"}),
            engine,
            organization_id,
        )
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_postgres_cursor_index_is_valid_and_selected(postgres_mention_feed):
    _client, engine, organization_id = postgres_mention_feed
    with engine.begin() as connection:
        valid = connection.execute(
            text(
                "SELECT i.indisvalid FROM pg_index i "
                "JOIN pg_class c ON c.oid = i.indexrelid "
                "WHERE c.relname = 'idx_mentions_org_collected_id'"
            )
        ).scalar_one()
        connection.execute(text("SET LOCAL enable_seqscan = off"))
        plan = connection.execute(
            text(
                "EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) "
                "SELECT id FROM mentions "
                "WHERE organization_id = :organization_id "
                "AND collected_at IS NOT NULL "
                "ORDER BY collected_at DESC, id DESC LIMIT 100"
            ),
            {"organization_id": organization_id},
        ).scalars().all()

    assert valid is True
    assert any("idx_mentions_org_collected_id" in line for line in plan), plan


def test_postgres_100_row_feed_query_count_and_latency(postgres_mention_feed):
    client, engine, _organization_id = postgres_mention_feed
    statements = []

    def record_statement(_conn, _cursor, statement, _parameters, _context, _many):
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement)

    event.listen(engine, "before_cursor_execute", record_statement)
    try:
        measured = client.get("/api/mentions?page_size=100&expand=false")
    finally:
        event.remove(engine, "before_cursor_execute", record_statement)

    assert measured.status_code == 200
    assert len(measured.json()["items"]) == 100
    assert len(statements) <= 5, statements

    durations_ms = []
    for _ in range(10):
        started = time.perf_counter()
        response = client.get("/api/mentions?page_size=100&expand=false")
        durations_ms.append((time.perf_counter() - started) * 1000)
        assert response.status_code == 200

    ordered = sorted(durations_ms)
    p95_ms = ordered[max(0, int(len(ordered) * 0.95) - 1)]
    print(
        {
            "rows": 100,
            "select_statements": len(statements),
            "median_ms": round(statistics.median(ordered), 2),
            "p95_ms": round(p95_ms, 2),
        }
    )
    assert statistics.median(ordered) < 500, ordered
    assert p95_ms < 1500, ordered
