"""Repeatable local endpoint benchmark for issue #221.

Run from the repository root with the Python 3.11 development environment.
The script creates an isolated in-memory database and prints one JSON object.
"""
from datetime import datetime, timedelta, timezone
import json
import os
import statistics
import sys
import time
from pathlib import Path
from types import SimpleNamespace

benchmark_backend = Path(
    os.getenv("MENTION_BENCHMARK_BACKEND", str(Path(__file__).parents[1]))
).resolve()
sys.path.insert(0, str(benchmark_backend))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.main import app
from app.models.mention import AIAnalysis, Mention, MentionVisit, SentimentScore
from app.models.source import Source, SourceType


def main() -> None:
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
    collected_base = datetime(2026, 7, 28, 8, tzinfo=timezone.utc)

    with session_factory() as db:
        db.add(
            Source(
                id=1,
                organization_id=1,
                user_id=1,
                group_id=1,
                name="Benchmark Source",
                source_type=SourceType.NEWS,
                url="https://benchmark.test",
            )
        )
        for position in range(100):
            mention_id = position + 1
            db.add(
                Mention(
                    id=mention_id,
                    organization_id=1,
                    user_id=1,
                    project_id=1,
                    keyword_id=1,
                    source_id=1,
                    title=f"Benchmark mention {position}",
                    snippet=f"Compact list snippet {position}",
                    content="x" * 2048,
                    meta_data={"media_url": "https://example.test/video.mp4", "blob": "y" * 512},
                    url=f"https://benchmark.test/{position}",
                    canonical_url=f"https://benchmark.test/{position}",
                    sentiment="negative",
                    verification_status="verified",
                    is_muted=False,
                    is_deleted=False,
                    collected_at=collected_base - timedelta(seconds=position),
                )
            )
            db.add(
                AIAnalysis(
                    mention_id=mention_id,
                    sentiment=SentimentScore.NEGATIVE,
                    risk_score=75,
                    crisis_level=3,
                    summary_vi="Benchmark analysis",
                    ai_provider="test",
                )
            )
        db.commit()

    def override_db():
        with session_factory() as db:
            yield db

    def override_user():
        return SimpleNamespace(
            id=1,
            current_organization_id=1,
            role="viewer",
            is_superuser=False,
            is_active=True,
        )

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_active_user] = override_user
    client = TestClient(app)
    statement_count = 0

    def count_select(_conn, _cursor, statement, _parameters, _context, _many):
        nonlocal statement_count
        if statement.lstrip().upper().startswith("SELECT"):
            statement_count += 1

    event.listen(engine, "before_cursor_execute", count_select)
    measured = client.get("/api/mentions?page_size=100&expand=false")
    event.remove(engine, "before_cursor_execute", count_select)
    measured.raise_for_status()

    durations_ms = []
    response_bytes = []
    for _ in range(25):
        started = time.perf_counter()
        response = client.get("/api/mentions?page_size=100&expand=false")
        durations_ms.append((time.perf_counter() - started) * 1000)
        response_bytes.append(len(response.content))

    durations_ms.sort()
    p95_index = max(0, int(len(durations_ms) * 0.95) - 1)
    print(
        json.dumps(
            {
                "rows": len(measured.json()["items"]),
                "select_statements": statement_count,
                "p95_ms": round(durations_ms[p95_index], 2),
                "median_ms": round(statistics.median(durations_ms), 2),
                "response_bytes": round(statistics.mean(response_bytes)),
                "iterations": len(durations_ms),
            },
            sort_keys=True,
        )
    )
    app.dependency_overrides.clear()
    engine.dispose()


if __name__ == "__main__":
    main()
