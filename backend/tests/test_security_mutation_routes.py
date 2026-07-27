"""Security regression tests for mutation routes and abuse controls."""

from __future__ import annotations

import ast
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.security import get_current_user
from app.main import app


client = TestClient(app, raise_server_exceptions=False)

PUBLIC_MUTATIONS = {
    ("backend/app/api/auth.py", "/register"),
    ("backend/app/api/auth.py", "/login"),
    ("backend/app/api/webinar.py", "/register"),
}
AUTH_DEPENDENCIES = {
    "get_current_user",
    "get_current_active_user",
    "get_current_superuser",
    "get_enabled_superuser",
    "require_roles",
    "RequirePermission",
}


def _mutation_route_inventory() -> list[tuple[str, int, str, str, bool]]:
    backend_root = Path(__file__).resolve().parents[1]
    inventory: list[tuple[str, int, str, str, bool]] = []
    for path in sorted((backend_root / "app").rglob("*.py")):
        source = path.read_text(encoding="utf-8-sig")
        tree = ast.parse(source)
        for node in ast.walk(tree):
            if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            function_source = ast.get_source_segment(source, node) or ""
            protected = any(name in function_source for name in AUTH_DEPENDENCIES)
            for decorator in node.decorator_list:
                if not (
                    isinstance(decorator, ast.Call)
                    and isinstance(decorator.func, ast.Attribute)
                    and decorator.func.attr in {"post", "put", "patch", "delete"}
                ):
                    continue
                route_path = ast.literal_eval(decorator.args[0])
                relative_path = path.relative_to(backend_root.parent).as_posix()
                inventory.append(
                    (
                        relative_path,
                        node.lineno,
                        decorator.func.attr.upper(),
                        route_path,
                        protected,
                    )
                )
    return inventory


def test_every_mutation_route_is_authenticated_or_explicitly_public():
    unprotected = [
        route
        for route in _mutation_route_inventory()
        if not route[4] and (route[0], route[3]) not in PUBLIC_MUTATIONS
    ]
    assert unprotected == []


@pytest.mark.parametrize(
    "path",
    [
        "/api/sys/run-backfill",
        "/api/sys/run-visit-migration",
        "/api/debug/migrate",
    ],
)
def test_state_changing_admin_operations_are_not_get_routes(path):
    response = client.get(path)
    assert response.status_code == 405


@pytest.mark.parametrize(
    ("path", "params"),
    [
        ("/api/sys/run-backfill", None),
        ("/api/sys/run-visit-migration", None),
        ("/api/debug/migrate", None),
        (
            "/api/crawl/debug/test-crawl",
            {"keyword": "security-test", "platform": "web", "limit": 1},
        ),
    ],
)
def test_anonymous_high_risk_mutations_are_rejected(path, params):
    response = client.post(path, params=params)
    assert response.status_code in {401, 403}


@pytest.mark.parametrize(
    "path",
    [
        "/api/sys/run-backfill",
        "/api/sys/run-visit-migration",
        "/api/debug/migrate",
        "/api/crawl/debug/test-crawl?keyword=security-test",
    ],
)
def test_non_admin_cannot_run_high_risk_mutations(path):
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(
        id=42,
        is_active=True,
        is_superuser=False,
        role="viewer",
    )
    app.dependency_overrides[get_db] = lambda: MagicMock()
    try:
        response = client.post(path)
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 403


def test_dangerous_operations_are_disabled_by_default_for_superadmin(monkeypatch):
    monkeypatch.delenv("ENABLE_DANGEROUS_ADMIN_OPERATIONS", raising=False)
    db = MagicMock()
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(
        id=1,
        is_active=True,
        is_superuser=True,
        role="super_admin",
    )
    app.dependency_overrides[get_db] = lambda: db
    try:
        response = client.post("/api/sys/run-backfill")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "ADMIN_OPERATIONS_DISABLED"
    db.execute.assert_not_called()


def test_rate_limit_returns_429_with_public_error_and_correlation_id():
    from app.core.rate_limit import FixedWindowRateLimiter, MemoryRateLimitStore

    app.state.rate_limiter = FixedWindowRateLimiter(
        store=MemoryRateLimitStore(),
        limits={"webinar": (2, 60)},
    )
    payload = {
        "name": "",
        "email": "rate-limit@example.com",
        "webinar_title": "Security",
        "webinar_time": "now",
        "timezone": "UTC",
    }
    try:
        assert client.post("/api/webinar/register", json=payload).status_code == 400
        assert client.post("/api/webinar/register", json=payload).status_code == 400
        response = client.post("/api/webinar/register", json=payload)
    finally:
        del app.state.rate_limiter

    assert response.status_code == 429
    assert response.json()["detail"]["code"] == "RATE_LIMIT_EXCEEDED"
    assert response.headers["X-Correlation-ID"]


def test_rate_limit_counter_is_shared_across_redis_compatible_clients():
    from app.core.rate_limit import FixedWindowRateLimiter, RedisRateLimitStore

    class FakeRedisCompatibleClient:
        def __init__(self):
            self.counts = {}

        def eval(self, script, key_count, key, window_seconds):
            assert "INCR" in script
            assert key_count == 1
            self.counts[key] = self.counts.get(key, 0) + 1
            return [self.counts[key], int(window_seconds)]

    shared_client = FakeRedisCompatibleClient()
    first_store = RedisRateLimitStore.__new__(RedisRateLimitStore)
    second_store = RedisRateLimitStore.__new__(RedisRateLimitStore)
    first_store._client = shared_client
    second_store._client = shared_client
    first = FixedWindowRateLimiter(first_store, {"login": (1, 60)})
    second = FixedWindowRateLimiter(second_store, {"login": (1, 60)})

    assert first.check("login", "same-account").allowed is True
    assert second.check("login", "same-account").allowed is False
