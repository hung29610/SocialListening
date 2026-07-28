"""Real Redis-compatible integration coverage for shared rate-limit counters."""

import os
import uuid

import pytest
import redis

from app.core.rate_limit import FixedWindowRateLimiter, RedisRateLimitStore


TEST_REDIS_URL = os.getenv("TEST_REDIS_URL")


@pytest.mark.skipif(
    not TEST_REDIS_URL,
    reason="TEST_REDIS_URL is required for the blocking Redis integration job",
)
def test_two_rate_limiter_instances_share_a_real_redis_counter():
    scope = f"integration-{uuid.uuid4().hex}"
    identity = f"user-{uuid.uuid4().hex}"
    first_store = RedisRateLimitStore(TEST_REDIS_URL)
    second_store = RedisRateLimitStore(TEST_REDIS_URL)
    first = FixedWindowRateLimiter(first_store, {scope: (1, 60)})
    second = FixedWindowRateLimiter(second_store, {scope: (1, 60)})

    try:
        assert first.check(scope, identity).allowed is True
        assert second.check(scope, identity).allowed is False
    finally:
        cleanup = redis.Redis.from_url(TEST_REDIS_URL, decode_responses=True)
        keys = list(cleanup.scan_iter(match=f"nope360:rate-limit:{scope}:*"))
        if keys:
            cleanup.delete(*keys)
        cleanup.close()
        first_store.close()
        second_store.close()
