"""Shared-store fixed-window rate limiting for security-sensitive API surfaces."""

from __future__ import annotations

import hashlib
import logging
import os
import threading
import time
from dataclasses import dataclass
from typing import Mapping, Protocol
from urllib.parse import urlparse

import redis
from fastapi import Depends, HTTPException, Request, status

from app.core.config import settings
from app.core.security import get_current_active_user
from app.models.user import User


logger = logging.getLogger(__name__)


class RateLimitStore(Protocol):
    """Storage contract implemented by Redis and the isolated test fallback."""

    def increment(self, key: str, window_seconds: int) -> tuple[int, int]:
        """Increment a window counter and return its count and remaining TTL."""


class RedisRateLimitStore:
    """Atomic counter store compatible with Redis and Redis-compatible services."""

    _INCREMENT_SCRIPT = """
local count = redis.call('INCR', KEYS[1])
if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return {count, ttl}
"""

    def __init__(self, redis_url: str):
        self._client = redis.Redis.from_url(
            redis_url,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )

    def increment(self, key: str, window_seconds: int) -> tuple[int, int]:
        count, ttl = self._client.eval(
            self._INCREMENT_SCRIPT,
            1,
            key,
            window_seconds,
        )
        return int(count), max(int(ttl), 1)

    def close(self) -> None:
        self._client.close()


class RateLimitConfigurationError(RuntimeError):
    """Raised when production abuse controls have no shared-store URL."""


class MemoryRateLimitStore:
    """Thread-safe test fallback; production uses the Redis implementation."""

    def __init__(self):
        self._entries: dict[str, tuple[int, float]] = {}
        self._lock = threading.Lock()

    def increment(self, key: str, window_seconds: int) -> tuple[int, int]:
        now = time.monotonic()
        with self._lock:
            count, expires_at = self._entries.get(key, (0, now + window_seconds))
            if expires_at <= now:
                count, expires_at = 0, now + window_seconds
            count += 1
            self._entries[key] = (count, expires_at)
            return count, max(int(expires_at - now), 1)


DEFAULT_LIMITS: dict[str, tuple[int, int]] = {
    "login": (10, 60),
    "registration": (5, 300),
    "webinar": (5, 300),
    "ai": (30, 60),
    "scan": (20, 60),
    "admin": (10, 60),
}


@dataclass(frozen=True)
class RateLimitDecision:
    allowed: bool
    retry_after: int


class FixedWindowRateLimiter:
    def __init__(
        self,
        store: RateLimitStore,
        limits: Mapping[str, tuple[int, int]] | None = None,
    ):
        self.store = store
        self.limits = dict(DEFAULT_LIMITS if limits is None else limits)

    def check(self, scope: str, identity: str) -> RateLimitDecision:
        policy = self.limits.get(scope)
        if policy is None:
            return RateLimitDecision(allowed=True, retry_after=0)
        limit, window_seconds = policy
        digest = hashlib.sha256(identity.encode("utf-8")).hexdigest()
        bucket = int(time.time() // window_seconds)
        key = f"nope360:rate-limit:{scope}:{bucket}:{digest}"
        count, ttl = self.store.increment(key, window_seconds)
        return RateLimitDecision(allowed=count <= limit, retry_after=ttl)


_default_limiter: FixedWindowRateLimiter | None = None
_default_limiter_lock = threading.Lock()


def _build_default_rate_limiter() -> FixedWindowRateLimiter:
    environment = settings.ENVIRONMENT.lower()
    if environment == "test":
        store: RateLimitStore = MemoryRateLimitStore()
        test_limits = {
            scope: (10_000, window)
            for scope, (_, window) in DEFAULT_LIMITS.items()
        }
        return FixedWindowRateLimiter(store, test_limits)

    parsed_url = urlparse(settings.REDIS_URL)
    if (
        environment == "production"
        and parsed_url.hostname in {None, "localhost", "127.0.0.1", "::1"}
    ):
        raise RateLimitConfigurationError(
            "Production rate limiting requires a non-local REDIS_URL."
        )
    return FixedWindowRateLimiter(RedisRateLimitStore(settings.REDIS_URL))


def get_rate_limiter(request: Request | None = None) -> FixedWindowRateLimiter:
    if request is not None:
        overridden = getattr(request.app.state, "rate_limiter", None)
        if overridden is not None:
            return overridden

    global _default_limiter
    if _default_limiter is None:
        with _default_limiter_lock:
            if _default_limiter is None:
                _default_limiter = _build_default_rate_limiter()
    return _default_limiter


def client_identity(request: Request) -> str:
    host = request.client.host if request.client else "unknown"
    return f"ip:{host}"


def _enforce_identity_rate_limit(request: Request, scope: str, identity: str) -> None:
    try:
        decision = get_rate_limiter(request).check(scope, identity)
    except (redis.RedisError, RateLimitConfigurationError) as exc:
        logger.error("Rate-limit shared store unavailable: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "RATE_LIMIT_UNAVAILABLE",
                "message": "Abuse protection is temporarily unavailable.",
            },
        ) from exc
    if not decision.allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": "RATE_LIMIT_EXCEEDED",
                "message": "Too many requests. Try again later.",
            },
            headers={"Retry-After": str(decision.retry_after)},
        )


def enforce_account_rate_limit(request: Request, scope: str, account: str) -> None:
    """Apply a public account-level limit after request-model parsing."""

    _enforce_identity_rate_limit(request, scope, f"account:{account.lower()}")


def make_verified_user_rate_limit(scope: str):
    """Build a dependency keyed only after authentication resolves a database user."""

    def verified_user_rate_limit(
        request: Request,
        current_user: User = Depends(get_current_active_user),
    ) -> User:
        _enforce_identity_rate_limit(
            request,
            scope,
            f"verified-user:{current_user.id}",
        )
        return current_user

    verified_user_rate_limit.__name__ = f"rate_limit_verified_user_{scope}"
    return verified_user_rate_limit


rate_limit_ai_user = make_verified_user_rate_limit("ai")
rate_limit_scan_user = make_verified_user_rate_limit("scan")
rate_limit_admin_user = make_verified_user_rate_limit("admin")


def classify_rate_limit_scope(path: str) -> str | None:
    if path == "/api/auth/login":
        return "login"
    if path == "/api/auth/register":
        return "registration"
    if path == "/api/webinar/register":
        return "webinar"
    if path.startswith("/api/ai"):
        return "ai"
    if (
        path.startswith("/api/crawl")
        or path.startswith("/api/collectors")
        or path.startswith("/api/discovery")
        or path == "/api/monitor/start"
        or (path.startswith("/api/sources/") and path.endswith("/scan"))
    ):
        return "scan"
    if (
        path.startswith("/api/admin")
        or path.startswith("/api/debug")
        or path.startswith("/api/sys/")
    ):
        return "admin"
    return None
