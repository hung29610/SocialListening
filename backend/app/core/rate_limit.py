"""Shared-store fixed-window rate limiting for security-sensitive API surfaces."""

from __future__ import annotations

import hashlib
import logging
import os
import threading
import time
from dataclasses import dataclass
from typing import Mapping, Protocol

import redis
from fastapi import HTTPException, Request, status

from app.core.config import settings


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


def get_rate_limiter(request: Request | None = None) -> FixedWindowRateLimiter:
    if request is not None:
        overridden = getattr(request.app.state, "rate_limiter", None)
        if overridden is not None:
            return overridden

    global _default_limiter
    if _default_limiter is None:
        with _default_limiter_lock:
            if _default_limiter is None:
                if settings.ENVIRONMENT.lower() == "test":
                    store: RateLimitStore = MemoryRateLimitStore()
                    test_limits = {
                        scope: (10_000, window)
                        for scope, (_, window) in DEFAULT_LIMITS.items()
                    }
                    _default_limiter = FixedWindowRateLimiter(store, test_limits)
                else:
                    store = RedisRateLimitStore(settings.REDIS_URL)
                    _default_limiter = FixedWindowRateLimiter(store)
    return _default_limiter


def client_identity(request: Request) -> str:
    host = request.client.host if request.client else "unknown"
    return f"ip:{host}"


def principal_identity(request: Request) -> str | None:
    authorization = request.headers.get("authorization", "")
    if not authorization:
        return None
    return f"authorization:{authorization}"


def enforce_account_rate_limit(request: Request, scope: str, account: str) -> None:
    """Apply a second account-level limit after request-model parsing."""

    try:
        decision = get_rate_limiter(request).check(scope, f"account:{account.lower()}")
    except redis.RedisError as exc:
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
