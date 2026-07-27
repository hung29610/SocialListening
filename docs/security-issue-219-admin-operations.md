# Issue #219: protected maintenance operations

Dangerous database backfill, schema migration, and debug-crawl endpoints now
require a super-admin token and are disabled by default.

Operators may temporarily set `ENABLE_DANGEROUS_ADMIN_OPERATIONS=true` only
for a planned maintenance window. Remove or set it to `false` immediately
afterward. Normal application startup, login, scans, and background workers do
not require this variable.

The affected mutation endpoints use `POST`; requests using `GET` return 405 and
cannot execute database changes. Meta OAuth authorization-state creation also
uses `POST`. The provider callback remains the sole documented state-changing
GET exception because the OAuth redirect protocol invokes it with query
parameters; tests explicitly allow only that callback to write state.

Security-sensitive API surfaces use the Redis-compatible shared rate-limit
store configured by `REDIS_URL`. In production this variable is mandatory and
must point to a network-accessible non-local Redis service. A missing value,
the localhost default, or an unavailable Redis service makes protected
surfaces fail closed with 503.

The real shared-counter integration test runs when `TEST_REDIS_URL` is set:

```powershell
$env:TEST_REDIS_URL = "redis://127.0.0.1:6379/15"
python -m pytest tests/test_security_rate_limit_redis_integration.py -q
```

The CI workflow owned by issue #224 should provision a Redis service, set
`TEST_REDIS_URL`, and run this test as a blocking step.
