# -*- coding: utf-8 -*-
"""Offline tests for the guarded feed fetcher.

Covers URL validation, SSRF blocking, destination pinning (DNS-rebinding
protection), redirect handling, size/timeout limits and error mapping.

No live network access: DNS resolution and requests.Session are stubbed. The
pinned-transport TLS behaviour that cannot be asserted offline (real certificate
verification against the presented hostname) is verified separately as a
documented manual smoke test; here we assert that the adapter is constructed with
the correct `server_hostname`, which is what drives SNI and verification.
"""
from urllib.parse import urlparse

import pytest

from app.services import feed_fetcher
from app.services.feed_fetcher import fetch_url, resolve_target, validate_feed_url

PUBLIC_IP = "93.184.216.34"
PUBLIC_IP_2 = "93.184.216.35"
PUBLIC_IPV6 = "2606:2800:220:1:248:1893:25c8:1946"
PRIVATE_IP = "10.1.2.3"


class _FakeResponse:
    def __init__(self, status_code=200, headers=None, chunks=None, raise_on_read=None):
        self.status_code = status_code
        self.headers = headers or {}
        self._chunks = chunks if chunks is not None else [b""]
        self._raise_on_read = raise_on_read
        self.closed = False

    def iter_content(self, chunk_size=16384):
        if self._raise_on_read is not None:
            raise self._raise_on_read
        for chunk in self._chunks:
            yield chunk

    def close(self):
        self.closed = True


class _FakeSession:
    """Records mounts and requests, and replays a scripted response list."""

    def __init__(self, responses):
        self._responses = list(responses)
        self.requested_urls = []
        self.request_headers = []
        self.kwargs = {}
        self.mounts = []
        self.closed = False
        self.max_redirects = None

    def mount(self, prefix, adapter):
        self.mounts.append((prefix, adapter))

    def get(self, url, **kwargs):
        self.requested_urls.append(url)
        self.request_headers.append(kwargs.get("headers", {}))
        self.kwargs = kwargs
        if not self._responses:
            raise AssertionError(f"unexpected extra request to {url}")
        response = self._responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response

    def close(self):
        self.closed = True


@pytest.fixture
def public_dns(monkeypatch):
    """Resolve every hostname to a single public IPv4 address."""
    monkeypatch.setattr(feed_fetcher, "_resolve_host", lambda host: [PUBLIC_IP])


@pytest.fixture
def install_session(monkeypatch):
    """Replace requests.Session with a scripted fake; returns the instance(s)."""
    created = []

    def _install(responses):
        session = _FakeSession(responses)
        created.append(session)
        monkeypatch.setattr(feed_fetcher.requests, "Session", lambda: session)
        return session

    return _install


@pytest.fixture
def install_session_factory(monkeypatch):
    """Like install_session but a fresh session per hop (mirrors real fetch_url)."""
    sessions = []

    def _install(response_batches):
        batches = list(response_batches)

        def factory():
            session = _FakeSession(batches.pop(0) if batches else [])
            sessions.append(session)
            return session

        monkeypatch.setattr(feed_fetcher.requests, "Session", factory)
        return sessions

    return _install


# ─── URL validation ───────────────────────────────────────────────────────────


class TestValidateFeedUrl:
    def test_accepts_public_https_url(self, public_dns):
        ok, code, _ = validate_feed_url("https://vnexpress.net/rss/tin-moi-nhat.rss")
        assert ok is True
        assert code == ""

    @pytest.mark.parametrize("url", ["", "   ", None, "not-a-url"])
    def test_rejects_empty_or_malformed(self, url):
        ok, code, message = validate_feed_url(url)
        assert ok is False
        assert code in ("invalid_url", "unsupported_scheme")
        assert message

    @pytest.mark.parametrize(
        "url",
        ["file:///etc/passwd", "ftp://example.com/feed.xml", "javascript:alert(1)", "gopher://example.com/feed"],
    )
    def test_rejects_unsupported_schemes(self, url):
        ok, code, _ = validate_feed_url(url)
        assert ok is False
        assert code in ("unsupported_scheme", "invalid_url")

    def test_rejects_embedded_credentials(self, public_dns):
        ok, code, _ = validate_feed_url("https://user:secret@example.com/feed.xml")
        assert ok is False
        assert code == "credentials_in_url"

    @pytest.mark.parametrize(
        "url",
        [
            "http://127.0.0.1/feed.xml",
            "http://localhost:8000/feed.xml",
            "http://10.0.0.5/feed.xml",
            "http://192.168.1.10/feed.xml",
            "http://172.16.4.4/feed.xml",
            "http://169.254.169.254/latest/meta-data/",
            "http://[::1]/feed.xml",
            "http://0.0.0.0/feed.xml",
            "http://[fd00::1]/feed.xml",
            "http://[fe80::1]/feed.xml",
        ],
    )
    def test_blocks_internal_targets(self, url):
        ok, code, message = validate_feed_url(url)
        assert ok is False
        assert code == "blocked_target"
        assert "127.0.0.1" not in message
        assert "169.254" not in message

    def test_blocks_aws_and_gcp_metadata_endpoints(self):
        for url in (
            "http://169.254.169.254/latest/meta-data/iam/security-credentials/",
            "http://169.254.169.254/computeMetadata/v1/",
        ):
            ok, code, _ = validate_feed_url(url)
            assert ok is False, url
            assert code == "blocked_target"

    def test_blocks_hostname_resolving_to_private_ip(self, monkeypatch):
        monkeypatch.setattr(feed_fetcher, "_resolve_host", lambda host: [PRIVATE_IP])
        ok, code, _ = validate_feed_url("https://internal.example.com/feed.xml")
        assert ok is False
        assert code == "blocked_target"

    def test_blocks_when_any_resolved_ip_is_private(self, monkeypatch):
        monkeypatch.setattr(feed_fetcher, "_resolve_host", lambda host: [PUBLIC_IP, "127.0.0.1"])
        ok, code, _ = validate_feed_url("https://mixed.example.com/feed.xml")
        assert ok is False
        assert code == "blocked_target"

    def test_blocks_when_private_answer_comes_first(self, monkeypatch):
        monkeypatch.setattr(feed_fetcher, "_resolve_host", lambda host: [PRIVATE_IP, PUBLIC_IP])
        ok, code, _ = validate_feed_url("https://mixed2.example.com/feed.xml")
        assert ok is False
        assert code == "blocked_target"

    def test_accepts_public_ipv6_answer(self, monkeypatch):
        monkeypatch.setattr(feed_fetcher, "_resolve_host", lambda host: [PUBLIC_IPV6])
        ok, code, _ = validate_feed_url("https://v6.example.com/feed.xml")
        assert ok is True
        assert code == ""

    def test_reports_unresolvable_host_without_leaking_error(self, monkeypatch):
        def _boom(host):
            raise OSError("getaddrinfo failed for internal-dns-01.render.internal")

        monkeypatch.setattr(feed_fetcher, "_resolve_host", _boom)
        ok, code, message = validate_feed_url("https://does-not-exist.example/feed.xml")
        assert ok is False
        assert code == "unresolvable_host"
        assert "render.internal" not in message

    def test_blocks_privileged_non_feed_ports(self, public_dns):
        ok, code, _ = validate_feed_url("http://example.com:22/feed.xml")
        assert ok is False
        assert code == "blocked_port"

    def test_allows_common_high_ports(self, public_dns):
        ok, code, _ = validate_feed_url("http://example.com:9000/feed.xml")
        assert ok is True
        assert code == ""

    def test_escape_hatch_allows_private_targets_when_enabled(self, monkeypatch):
        monkeypatch.setenv("FEED_FETCH_ALLOW_PRIVATE_TARGETS", "true")
        ok, code, _ = validate_feed_url("http://127.0.0.1:8000/feed.xml")
        assert ok is True
        assert code == ""


class TestResolveTarget:
    def test_returns_pinned_ip_and_host_header(self, public_dns):
        target, code, _ = resolve_target("https://example.com/feed.xml")
        assert code == ""
        assert target is not None
        assert target.ip == PUBLIC_IP
        assert target.host == "example.com"
        assert target.host_header == "example.com"
        assert target.port == 443

    def test_keeps_explicit_port_in_host_header(self, public_dns):
        target, _, _ = resolve_target("http://example.com:8080/feed.xml")
        assert target.host_header == "example.com:8080"
        assert target.port == 8080

    def test_literal_ip_needs_no_dns(self, monkeypatch):
        def _should_not_resolve(host):
            raise AssertionError("DNS must not be used for a literal IP")

        monkeypatch.setattr(feed_fetcher, "_resolve_host", _should_not_resolve)
        target, code, _ = resolve_target(f"https://{PUBLIC_IP}/feed.xml")
        assert code == ""
        assert target.ip == PUBLIC_IP


# ─── Destination pinning (DNS rebinding) ──────────────────────────────────────


class TestDestinationPinning:
    def test_request_goes_to_the_validated_ip_not_the_hostname(self, public_dns, install_session):
        session = install_session([_FakeResponse(200, {"content-type": "text/xml"}, [b"<rss/>"])])
        result = fetch_url("https://example.com/feed.xml")

        assert result.ok is True
        requested = urlparse(session.requested_urls[0])
        assert requested.hostname == PUBLIC_IP, "the connection must target the validated IP"
        assert requested.path == "/feed.xml"
        assert result.connected_ips == [PUBLIC_IP]

    def test_host_header_carries_the_real_hostname(self, public_dns, install_session):
        session = install_session([_FakeResponse(200, {}, [b"<rss/>"])])
        fetch_url("https://example.com/feed.xml")
        assert session.request_headers[0]["Host"] == "example.com"

    def test_https_adapter_is_mounted_with_the_real_hostname_for_sni(self, public_dns, install_session):
        session = install_session([_FakeResponse(200, {}, [b"<rss/>"])])
        fetch_url("https://example.com/feed.xml")

        assert session.mounts, "an adapter must be mounted for the pinned address"
        prefix, adapter = session.mounts[0]
        assert prefix == f"https://{PUBLIC_IP}"
        assert isinstance(adapter, feed_fetcher._PinnedHTTPSAdapter)
        assert adapter._server_hostname == "example.com"

    def test_plain_http_uses_a_default_adapter(self, public_dns, install_session):
        session = install_session([_FakeResponse(200, {}, [b"<rss/>"])])
        fetch_url("http://example.com/feed.xml")
        prefix, adapter = session.mounts[0]
        assert prefix == f"http://{PUBLIC_IP}"
        assert not isinstance(adapter, feed_fetcher._PinnedHTTPSAdapter)

    def test_dns_answer_changing_after_validation_is_never_used(self, monkeypatch, install_session):
        """The rebinding case: DNS returns public first, private afterwards."""
        answers = [[PUBLIC_IP], [PRIVATE_IP], [PRIVATE_IP]]
        calls = {"n": 0}

        def _resolve(host):
            index = min(calls["n"], len(answers) - 1)
            calls["n"] += 1
            return answers[index]

        monkeypatch.setattr(feed_fetcher, "_resolve_host", _resolve)
        session = install_session([_FakeResponse(200, {}, [b"<rss/>"])])

        result = fetch_url("https://rebind.example.com/feed.xml")

        assert result.ok is True
        # Exactly one resolution for this hop, and the connection used its answer.
        assert calls["n"] == 1
        assert result.connected_ips == [PUBLIC_IP]
        assert urlparse(session.requested_urls[0]).hostname == PUBLIC_IP
        assert PRIVATE_IP not in session.requested_urls[0]

    def test_ipv6_target_is_bracketed_in_the_pinned_url(self, monkeypatch, install_session):
        monkeypatch.setattr(feed_fetcher, "_resolve_host", lambda host: [PUBLIC_IPV6])
        session = install_session([_FakeResponse(200, {}, [b"<rss/>"])])
        result = fetch_url("https://v6.example.com/feed.xml")

        assert result.ok is True
        assert f"[{PUBLIC_IPV6}]" in session.requested_urls[0]
        assert urlparse(session.requested_urls[0]).hostname == PUBLIC_IPV6


# ─── Fetching ─────────────────────────────────────────────────────────────────


class TestFetchUrl:
    def test_returns_body_on_success(self, public_dns, install_session):
        install_session([_FakeResponse(200, {"content-type": "application/rss+xml"}, [b"<rss>", b"</rss>"])])
        result = fetch_url("https://example.com/feed.xml")
        assert result.ok is True
        assert result.content == b"<rss></rss>"
        assert result.content_type == "application/rss+xml"
        assert result.status_code == 200

    def test_uses_split_connect_and_read_timeouts(self, public_dns, install_session):
        session = install_session([_FakeResponse(200, {}, [b"<rss/>"])])
        fetch_url("https://example.com/feed.xml")
        assert session.kwargs["timeout"] == (feed_fetcher.CONNECT_TIMEOUT, feed_fetcher.READ_TIMEOUT)
        assert session.kwargs["allow_redirects"] is False

    def test_follows_bounded_redirect_chain(self, public_dns, install_session_factory):
        sessions = install_session_factory([
            [_FakeResponse(301, {"location": "https://example.com/step2"})],
            [_FakeResponse(302, {"location": "/step3"})],
            [_FakeResponse(200, {"content-type": "text/xml"}, [b"<feed/>"])],
        ])
        result = fetch_url("https://example.com/feed.xml")

        assert result.ok is True
        assert [urlparse(s.requested_urls[0]).path for s in sessions] == ["/feed.xml", "/step2", "/step3"]
        assert result.final_url == "https://example.com/step3"
        # Every hop connected to a validated IP.
        assert result.connected_ips == [PUBLIC_IP, PUBLIC_IP, PUBLIC_IP]

    def test_redirect_host_change_is_revalidated_and_repinned(self, monkeypatch, install_session_factory):
        def _resolve(host):
            return [PUBLIC_IP] if host == "example.com" else [PUBLIC_IP_2]

        monkeypatch.setattr(feed_fetcher, "_resolve_host", _resolve)
        sessions = install_session_factory([
            [_FakeResponse(302, {"location": "https://cdn.example.net/final.xml"})],
            [_FakeResponse(200, {}, [b"<rss/>"])],
        ])
        result = fetch_url("https://example.com/feed.xml")

        assert result.ok is True
        assert result.connected_ips == [PUBLIC_IP, PUBLIC_IP_2]
        assert sessions[1].request_headers[0]["Host"] == "cdn.example.net"

    def test_rejects_too_many_redirects(self, public_dns, install_session_factory):
        install_session_factory([[_FakeResponse(302, {"location": f"https://example.com/hop{i}"})] for i in range(6)])
        result = fetch_url("https://example.com/feed.xml", max_redirects=2)
        assert result.ok is False
        assert result.error_code == "too_many_redirects"

    def test_redirect_to_internal_address_is_blocked(self, monkeypatch, install_session_factory):
        monkeypatch.setattr(
            feed_fetcher,
            "_resolve_host",
            lambda host: ["127.0.0.1"] if host == "metadata.internal" else [PUBLIC_IP],
        )
        sessions = install_session_factory([
            [_FakeResponse(302, {"location": "http://metadata.internal/secrets"})],
            [_FakeResponse(200, {}, [b"should never be fetched"])],
        ])
        result = fetch_url("https://example.com/feed.xml")

        assert result.ok is False
        assert result.error_code == "blocked_target"
        assert len(sessions) == 1, "the internal hop must not open a connection"
        assert result.connected_ips == [PUBLIC_IP]

    def test_redirect_to_metadata_ip_literal_is_blocked(self, public_dns, install_session_factory):
        sessions = install_session_factory([
            [_FakeResponse(302, {"location": "http://169.254.169.254/latest/meta-data/"})],
            [_FakeResponse(200, {}, [b"nope"])],
        ])
        result = fetch_url("https://example.com/feed.xml")
        assert result.ok is False
        assert result.error_code == "blocked_target"
        assert len(sessions) == 1

    def test_rejects_declared_oversize_body(self, public_dns, install_session):
        install_session([_FakeResponse(200, {"content-length": str(50 * 1024 * 1024)}, [b"x"])])
        result = fetch_url("https://example.com/feed.xml")
        assert result.ok is False
        assert result.error_code == "too_large"

    def test_rejects_streamed_oversize_body(self, public_dns, install_session):
        install_session([_FakeResponse(200, {}, [b"x" * 1024] * 20)])
        result = fetch_url("https://example.com/feed.xml", max_bytes=4096)
        assert result.ok is False
        assert result.error_code == "too_large"
        assert result.truncated is True

    def test_maps_http_error_status(self, public_dns, install_session):
        install_session([_FakeResponse(503, {}, [b""])])
        result = fetch_url("https://example.com/feed.xml")
        assert result.ok is False
        assert result.error_code == "http_error"
        assert result.status_code == 503

    def test_maps_timeout(self, public_dns, install_session):
        install_session([feed_fetcher.requests.exceptions.Timeout("read timed out")])
        result = fetch_url("https://example.com/feed.xml")
        assert result.ok is False
        assert result.error_code == "timeout"

    def test_maps_tls_error_separately(self, public_dns, install_session):
        install_session([feed_fetcher.requests.exceptions.SSLError("certificate verify failed")])
        result = fetch_url("https://example.com/feed.xml")
        assert result.ok is False
        assert result.error_code == "tls_error"

    def test_does_not_leak_raw_connection_error(self, public_dns, install_session):
        install_session([
            feed_fetcher.requests.exceptions.ConnectionError(
                "HTTPSConnectionPool(host='sociallistening-internal', port=5432)"
            )
        ])
        result = fetch_url("https://example.com/feed.xml")
        assert result.ok is False
        assert result.error_code == "fetch_failed"
        assert "sociallistening-internal" not in result.error_message
        assert "5432" not in result.error_message

    def test_closes_response_and_session(self, public_dns, install_session):
        response = _FakeResponse(200, {}, [b"<rss/>"])
        session = install_session([response])
        fetch_url("https://example.com/feed.xml")
        assert response.closed is True
        assert session.closed is True

    def test_invalid_url_never_hits_network(self, install_session):
        session = install_session([])
        result = fetch_url("file:///etc/passwd")
        assert result.ok is False
        assert result.error_code == "unsupported_scheme"
        assert session.requested_urls == []
