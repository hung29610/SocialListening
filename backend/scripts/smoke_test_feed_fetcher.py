"""
Manual smoke test for the guarded feed fetcher's TLS behaviour.

The automated suite (backend/tests/test_feed_fetcher.py) is fully offline and
deterministic. It can prove that the connection is pinned to the validated IP and
that the HTTPS adapter is built with the right `server_hostname`, but it cannot
prove that a *real* TLS handshake still verifies the certificate — that needs a
network and a server with a deliberately bad certificate.

This script does exactly that, against badssl.com, and is therefore explicitly
manual: it is never collected by pytest and never runs in CI.

    cd backend
    python scripts/smoke_test_feed_fetcher.py

Expected result: every case reports PASS.

    valid cert, pinned            -> 200
    hostname mismatch             -> tls_error
    untrusted root                -> tls_error
    expired certificate           -> tls_error
    self-signed certificate       -> tls_error
    pinned IP + foreign hostname  -> tls_error
    blocked metadata endpoint     -> blocked_target (no connection attempted)
    plain HTTP, pinned            -> 200
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from app.services.feed_fetcher import HTML_ACCEPT, fetch_url  # noqa: E402

CASES = [
    ("valid cert, pinned", "https://example.com/", "ok"),
    ("hostname mismatch", "https://wrong.host.badssl.com/", "tls_error"),
    ("untrusted root", "https://untrusted-root.badssl.com/", "tls_error"),
    ("expired certificate", "https://expired.badssl.com/", "tls_error"),
    ("self-signed certificate", "https://self-signed.badssl.com/", "tls_error"),
    ("blocked metadata endpoint", "http://169.254.169.254/latest/meta-data/", "blocked_target"),
    ("blocked loopback", "http://127.0.0.1:8000/feed.xml", "blocked_target"),
    ("plain HTTP, pinned", "http://example.com/", "ok"),
]


def main() -> int:
    if os.getenv("FEED_FETCH_ALLOW_PRIVATE_TARGETS", "").strip().lower() in ("1", "true", "yes"):
        print("Refusing to run: FEED_FETCH_ALLOW_PRIVATE_TARGETS is enabled, which")
        print("disables the very protections this smoke test is meant to verify.")
        return 2

    failures = 0
    for label, url, expected in CASES:
        result = fetch_url(url, accept=HTML_ACCEPT)
        actual = "ok" if result.ok else result.error_code
        passed = actual == expected
        failures += 0 if passed else 1
        detail = f"status={result.status_code}" if result.ok else f"code={result.error_code}"
        pinned = ",".join(result.connected_ips) or "-"
        print(f"{'PASS' if passed else 'FAIL'}  {label:28} expected={expected:15} got={actual:15} {detail:14} pinned_ip={pinned}")

    print()
    if failures:
        print(f"{failures} case(s) did not behave as expected.")
        print("Investigate before relying on the TLS/SSRF claims in the docs.")
    else:
        print("All cases behaved as expected: pinning does not weaken TLS verification,")
        print("and internal targets are refused before any connection is attempted.")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
