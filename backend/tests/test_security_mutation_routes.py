"""Security regression tests for mutation routes and abuse controls."""

from __future__ import annotations

import ast
import inspect
import textwrap
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.security import (
    get_current_active_user,
    get_current_superuser,
    get_current_user,
)
from app.core.security_operations import get_enabled_superuser
from app.main import app


client = TestClient(app, raise_server_exceptions=False)
PRODUCTION_ORIGIN = "https://social-listening-azure.vercel.app"

PUBLIC_MUTATIONS = {
    ("POST", "/api/auth/register"),
    ("POST", "/api/auth/login"),
    ("POST", "/api/webinar/register"),
}
AUTH_DEPENDENCIES = {
    get_current_user,
    get_current_active_user,
    get_current_superuser,
    get_enabled_superuser,
}
OAUTH_GET_WRITE_EXCEPTIONS = {
    "/api/integrations/meta/callback",
}


def _resolved_dependency_calls(dependant) -> set[object]:
    calls = {dependant.call}
    for child in dependant.dependencies:
        calls.update(_resolved_dependency_calls(child))
    return calls


def _mutation_route_inventory() -> list[tuple[str, str, bool]]:
    inventory = []
    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        calls = _resolved_dependency_calls(route.dependant)
        protected = bool(calls & AUTH_DEPENDENCIES)
        for method in sorted(route.methods & {"POST", "PUT", "PATCH", "DELETE"}):
            inventory.append((method, route.path, protected))
    return inventory


def test_every_mutation_route_is_authenticated_or_explicitly_public():
    unprotected = [
        route
        for route in _mutation_route_inventory()
        if not route[2] and (route[0], route[1]) not in PUBLIC_MUTATIONS
    ]
    assert unprotected == []


@pytest.mark.parametrize(
    ("path", "rate_dependency"),
    [
        ("/api/ai/sentiment", "rate_limit_verified_user_ai"),
        ("/api/crawl/manual-scan", "rate_limit_verified_user_scan"),
        ("/api/admin/run-migrations", "rate_limit_verified_user_admin"),
    ],
)
def test_protected_route_families_resolve_verified_user_rate_dependency(
    path,
    rate_dependency,
):
    route = next(
        route
        for route in app.routes
        if isinstance(route, APIRoute) and route.path == path
    )
    dependency_names = {
        getattr(call, "__name__", "")
        for call in _resolved_dependency_calls(route.dependant)
    }
    assert rate_dependency in dependency_names


def _endpoint_writes_database(endpoint) -> bool:
    tree = ast.parse(textwrap.dedent(inspect.getsource(endpoint)))
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Attribute):
            continue
        if (
            isinstance(node.func.value, ast.Name)
            and node.func.value.id == "db"
            and node.func.attr in {"add", "delete", "commit", "flush"}
        ):
            return True
    return False


def test_get_database_writes_are_limited_to_documented_oauth_protocol_steps():
    write_paths = {
        route.path
        for route in app.routes
        if isinstance(route, APIRoute)
        and "GET" in route.methods
        and _endpoint_writes_database(route.endpoint)
    }
    assert write_paths == OAUTH_GET_WRITE_EXCEPTIONS


@pytest.mark.parametrize(
    "path",
    [
        "/api/sys/run-backfill",
        "/api/sys/run-visit-migration",
        "/api/debug/migrate",
        "/api/integrations/meta/auth-url",
    ],
)
def test_state_changing_operations_are_not_get_routes(path):
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


def test_protected_route_preflight_needs_no_authentication_or_rate_limit():
    class FailIfCalledLimiter:
        def check(self, scope, identity):
            raise AssertionError("preflight reached the rate limiter")

    app.state.rate_limiter = FailIfCalledLimiter()
    try:
        response = client.options(
            "/api/crawl/schedules",
            headers={
                "Origin": PRODUCTION_ORIGIN,
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "authorization",
            },
        )
    finally:
        del app.state.rate_limiter

    assert response.status_code == 200
    assert response.headers["Access-Control-Allow-Origin"] == PRODUCTION_ORIGIN


def test_anonymous_401_response_keeps_cors_headers():
    response = client.get(
        "/api/crawl/schedules",
        headers={"Origin": PRODUCTION_ORIGIN},
    )

    assert response.status_code in {401, 403}
    assert response.headers["Access-Control-Allow-Origin"] == PRODUCTION_ORIGIN


def test_rate_limit_429_response_keeps_cors_headers():
    from app.core.rate_limit import FixedWindowRateLimiter, MemoryRateLimitStore

    app.state.rate_limiter = FixedWindowRateLimiter(
        store=MemoryRateLimitStore(),
        limits={"webinar": (0, 60)},
    )
    try:
        response = client.post(
            "/api/webinar/register",
            headers={"Origin": PRODUCTION_ORIGIN},
            json={
                "name": "CORS regression",
                "email": "cors-rate-limit@example.com",
                "webinar_title": "Security",
                "webinar_time": "now",
                "timezone": "UTC",
            },
        )
    finally:
        del app.state.rate_limiter

    assert response.status_code == 429
    assert response.headers["Access-Control-Allow-Origin"] == PRODUCTION_ORIGIN


@pytest.mark.parametrize(
    "preview_origin",
    [
        "https://social-listening-cos3yuhhx-hung307-s-projects.vercel.app",
        (
            "https://social-listening-git-hotfix-p0-cors-p-27456a-"
            "hung307-s-projects.vercel.app"
        ),
    ],
)
def test_project_vercel_preview_origin_is_allowed(preview_origin):
    response = client.options(
        "/api/crawl/schedules",
        headers={
            "Origin": preview_origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )

    assert response.status_code == 200
    assert response.headers["Access-Control-Allow-Origin"] == preview_origin


def test_login_preflight_allows_frontend_auth_headers():
    response = client.options(
        "/api/auth/login",
        headers={
            "Origin": PRODUCTION_ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": (
                "cache-control,content-type,expires,pragma"
            ),
        },
    )

    assert response.status_code == 200
    assert response.headers["Access-Control-Allow-Origin"] == PRODUCTION_ORIGIN
    allowed = {item.strip().lower() for item in response.headers["Access-Control-Allow-Headers"].split(",")}
    assert {"cache-control", "content-type", "expires", "pragma"} <= allowed


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


def test_verified_user_limit_uses_stable_database_user_id_not_bearer_token():
    from app.core.rate_limit import (
        FixedWindowRateLimiter,
        MemoryRateLimitStore,
        make_verified_user_rate_limit,
    )

    limiter = FixedWindowRateLimiter(
        MemoryRateLimitStore(),
        {"scan": (1, 60)},
    )
    request = SimpleNamespace(
        app=SimpleNamespace(state=SimpleNamespace(rate_limiter=limiter)),
        headers={"authorization": "Bearer first-token"},
    )
    dependency = make_verified_user_rate_limit("scan")
    user = SimpleNamespace(id=314)

    assert dependency(request=request, current_user=user) is user
    request.headers["authorization"] = "Bearer different-token"
    with pytest.raises(Exception) as exc_info:
        dependency(request=request, current_user=user)
    assert getattr(exc_info.value, "status_code", None) == 429


def test_development_allows_configured_local_redis(monkeypatch):
    from app.core import rate_limit

    monkeypatch.setattr(rate_limit.settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(
        rate_limit.settings,
        "REDIS_URL",
        "redis://localhost:6379/0",
    )
    monkeypatch.setattr(
        rate_limit,
        "RedisRateLimitStore",
        lambda redis_url: rate_limit.MemoryRateLimitStore(),
    )

    limiter = rate_limit._build_default_rate_limiter()
    assert isinstance(limiter, rate_limit.FixedWindowRateLimiter)


def test_production_rejects_localhost_redis_configuration(monkeypatch):
    from app.core import rate_limit

    monkeypatch.setattr(rate_limit.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(
        rate_limit.settings,
        "REDIS_URL",
        "redis://localhost:6379/0",
    )

    with pytest.raises(rate_limit.RateLimitConfigurationError):
        rate_limit._build_default_rate_limiter()


@pytest.mark.parametrize(
    "path",
    [
        "/api/auth/me/notification-settings",
        "/api/auth/me/preferences",
        "/api/branding/",
        "/api/reports/email-schedules",
        "/api/admin/settings/organization",
        "/api/admin/settings/email",
        "/api/admin/settings/notifications",
        "/api/admin/settings/ai-model",
    ],
)
def test_ordinary_settings_gets_return_defaults_without_writing(path):
    db = MagicMock()
    db.execute.return_value.scalar_one_or_none.return_value = None
    db.execute.return_value.scalars.return_value.first.return_value = None
    user = SimpleNamespace(
        id=7,
        is_active=True,
        is_superuser=True,
        role="super_admin",
    )
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_current_active_user] = lambda: user
    app.dependency_overrides[get_current_superuser] = lambda: user
    try:
        response = client.get(path)
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200, response.text
    db.add.assert_not_called()
    db.commit.assert_not_called()


def test_debug_auto_discovery_does_not_expose_provider_exception(monkeypatch):
    from app.api import crawl
    from app.core.config import settings

    monkeypatch.setattr(settings, "SERPAPI_API_KEY", "configured-for-test")
    monkeypatch.setattr(
        "app.services.serpapi_provider.search",
        lambda **kwargs: (_ for _ in ()).throw(
            RuntimeError("provider-secret and internal-host")
        ),
    )
    user = SimpleNamespace(id=8, is_active=True, is_superuser=False, role="viewer")
    app.dependency_overrides[get_current_active_user] = lambda: user
    try:
        response = client.post(
            "/api/crawl/debug-auto-discovery",
            json={"keyword": "security"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 502
    body = response.text
    assert "provider-secret" not in body
    assert "internal-host" not in body
    assert response.json()["detail"]["code"] == "DISCOVERY_PROVIDER_FAILED"
