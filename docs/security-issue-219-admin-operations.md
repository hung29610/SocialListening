# Issue #219: protected maintenance operations

Dangerous database backfill, schema migration, and debug-crawl endpoints now
require a super-admin token and are disabled by default.

Operators may temporarily set `ENABLE_DANGEROUS_ADMIN_OPERATIONS=true` only
for a planned maintenance window. Remove or set it to `false` immediately
afterward. Normal application startup, login, scans, and background workers do
not require this variable.

The affected mutation endpoints use `POST`; requests using `GET` return 405 and
cannot execute database changes. Security-sensitive API surfaces use the
Redis-compatible shared rate-limit store configured by `REDIS_URL`. Production
fails closed with 503 if that shared abuse-control store is unavailable.
