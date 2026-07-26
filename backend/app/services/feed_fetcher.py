"""
Safe HTTP fetcher for user-supplied URLs (RSS/Atom feeds, feed auto-discovery,
source reachability tests).

Feed URLs come from authenticated users, which makes every outbound fetch a
potential SSRF vector into the private network the backend runs in. This module
centralises the guards that all such fetches must go through:

- scheme allowlist (http/https only)
- rejection of embedded credentials and non-standard privileged ports
- DNS resolution with loopback/private/link-local/reserved targets blocked
- **connection pinned to the validated IP**, so the HTTP client never performs a
  second, unchecked resolution (closes the DNS-rebinding TOCTOU window)
- bounded redirect chain, with every hop validated and pinned independently
- separate connect/read timeouts
- streamed download with a hard response-size ceiling

TLS is untouched: the certificate is still verified, SNI still carries the real
hostname, and the Host header still carries the real host. Only the TCP
destination is fixed. Certificate failures surface as normal SSL errors.

Errors are returned as stable machine codes plus a short user-facing message.
Raw socket/DNS/TLS errors are logged but never surfaced to the client, so
internal hostnames and network topology stay out of API responses.
"""
from __future__ import annotations

import ipaddress
import logging
import os
import socket
from dataclasses import dataclass, field
from typing import List, Optional, Tuple
from urllib.parse import urljoin, urlparse, urlunparse

import requests
from requests.adapters import HTTPAdapter

logger = logging.getLogger(__name__)

USER_AGENT = "Mozilla/5.0 (compatible; Nope360Bot/1.0; +https://nope360.com)"

ALLOWED_SCHEMES = ("http", "https")

# Privileged ports we still allow because feeds legitimately use them.
ALLOWED_LOW_PORTS = (80, 443, 8080, 8443)

CONNECT_TIMEOUT = 5.0
READ_TIMEOUT = 15.0
MAX_REDIRECTS = 3
MAX_RESPONSE_BYTES = 5 * 1024 * 1024  # 5 MB

FEED_ACCEPT = "application/rss+xml, application/atom+xml, application/xml, text/xml, */*"
HTML_ACCEPT = "text/html, application/xhtml+xml, */*"


def _allow_private_targets() -> bool:
    """Local development escape hatch, off unless explicitly enabled."""
    return os.getenv("FEED_FETCH_ALLOW_PRIVATE_TARGETS", "").strip().lower() in ("1", "true", "yes")


# Public error codes -> short user-facing message (Vietnamese, matching the
# existing source-management API responses). The frontend maps the *code* to a
# localized string; the message here is the fallback for non-UI callers.
ERROR_MESSAGES = {
    "invalid_url": "URL không hợp lệ.",
    "unsupported_scheme": "Chỉ hỗ trợ URL bắt đầu bằng http:// hoặc https://.",
    "credentials_in_url": "URL không được chứa tên đăng nhập hoặc mật khẩu.",
    "blocked_port": "Cổng kết nối này không được phép.",
    "unresolvable_host": "Không phân giải được tên miền của URL.",
    "blocked_target": "URL trỏ tới địa chỉ nội bộ nên không được phép.",
    "too_many_redirects": "URL chuyển hướng quá nhiều lần.",
    "timeout": "Kết nối hết hạn (timeout). Vui lòng thử lại sau.",
    "tls_error": "Kết nối bảo mật (TLS) tới nguồn thất bại.",
    "http_error": "Nguồn trả về lỗi HTTP.",
    "fetch_failed": "Không lấy được dữ liệu từ nguồn.",
    "too_large": "Nội dung nguồn vượt quá giới hạn cho phép.",
    "invalid_xml": "Nội dung nguồn không phải XML/RSS hợp lệ.",
    "parse_failed": "Không xử lý được nội dung nguồn.",
}


def message_for(code: str) -> str:
    return ERROR_MESSAGES.get(code, ERROR_MESSAGES["fetch_failed"])


@dataclass
class FeedFetchResult:
    """Outcome of a guarded fetch. `ok` decides which fields are meaningful."""
    ok: bool
    content: bytes = b""
    final_url: str = ""
    content_type: str = ""
    status_code: Optional[int] = None
    error_code: str = ""
    error_message: str = ""
    truncated: bool = False
    # Every IP actually connected to, in hop order. Useful for tests and audit.
    connected_ips: List[str] = field(default_factory=list)


# ─── Destination validation ───────────────────────────────────────────────────


def _resolve_host(host: str) -> List[str]:
    """Return every IP the host resolves to (raises on failure)."""
    infos = socket.getaddrinfo(host, None, 0, socket.SOCK_STREAM)
    addresses: List[str] = []
    for info in infos:
        addr = info[4][0]
        if addr not in addresses:
            addresses.append(addr)
    return addresses


def _is_blocked_ip(ip: ipaddress._BaseAddress) -> bool:
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


@dataclass
class ValidatedTarget:
    """A URL that passed validation, together with the IP to connect to."""
    url: str
    scheme: str
    host: str
    port: int
    ip: str
    host_header: str


def _default_port(scheme: str) -> int:
    return 443 if scheme == "https" else 80


def validate_feed_url(url: str) -> Tuple[bool, str, str]:
    """
    Validate a user-supplied URL. Returns (is_valid, error_code, error_message).

    Kept as the module's simple boolean entry point (used by the sources API to
    reject a URL before storing it). `resolve_target` does the same checks and
    additionally returns the address the fetch must be pinned to.
    """
    ok, code, message, _ = _validate(url)
    return ok, code, message


def validate_feed_url_structure(url: str) -> Tuple[bool, str, str]:
    """
    Structural-only validation: scheme, credentials, port and literal-IP checks,
    with no DNS lookup.

    Used where a large batch of URLs must be screened quickly (OPML preview).
    The full check, including DNS and address-range rejection, still runs before
    anything is fetched or stored.
    """
    ok, code, message, _ = _validate(url, resolve_dns=False)
    return ok, code, message


def resolve_target(url: str) -> Tuple[Optional[ValidatedTarget], str, str]:
    """
    Validate `url` and resolve it to a single allowed IP.

    Returns (target, error_code, error_message); `target` is None on failure.
    """
    ok, code, message, target = _validate(url)
    if not ok:
        return None, code, message
    return target, "", ""


def _validate(url: str, *, resolve_dns: bool = True) -> Tuple[bool, str, str, Optional[ValidatedTarget]]:
    if not url or not isinstance(url, str) or not url.strip():
        return False, "invalid_url", message_for("invalid_url"), None

    try:
        parsed = urlparse(url.strip())
    except Exception:
        return False, "invalid_url", message_for("invalid_url"), None

    scheme = parsed.scheme.lower()
    if scheme not in ALLOWED_SCHEMES:
        return False, "unsupported_scheme", message_for("unsupported_scheme"), None

    if parsed.username or parsed.password:
        return False, "credentials_in_url", message_for("credentials_in_url"), None

    host = parsed.hostname
    if not host:
        return False, "invalid_url", message_for("invalid_url"), None

    try:
        port = parsed.port
    except ValueError:
        return False, "invalid_url", message_for("invalid_url"), None

    if port is not None and port < 1024 and port not in ALLOWED_LOW_PORTS:
        return False, "blocked_port", message_for("blocked_port"), None

    effective_port = port or _default_port(scheme)
    host_header = host if port is None else f"{host}:{port}"

    def _target(ip: str) -> ValidatedTarget:
        return ValidatedTarget(
            url=url.strip(),
            scheme=scheme,
            host=host,
            port=effective_port,
            ip=ip,
            host_header=host_header,
        )

    # Literal IP in the URL: check it directly, no DNS needed.
    literal_ip = None
    try:
        literal_ip = ipaddress.ip_address(host)
    except ValueError:
        pass

    if literal_ip is not None:
        if not _allow_private_targets() and _is_blocked_ip(literal_ip):
            return False, "blocked_target", message_for("blocked_target"), None
        return True, "", "", _target(str(literal_ip))

    lowered = host.lower()
    if not _allow_private_targets() and (
        lowered in ("localhost", "localhost.localdomain") or lowered.endswith(".localhost")
    ):
        return False, "blocked_target", message_for("blocked_target"), None

    if not resolve_dns:
        # Structural pass only. No IP is known yet, so no target is returned; the
        # caller must run the full check before fetching or storing.
        return True, "", "", None

    try:
        addresses = _resolve_host(host)
    except Exception as exc:
        logger.info("Feed URL host resolution failed for %r: %s", host, exc)
        return False, "unresolvable_host", message_for("unresolvable_host"), None

    if not addresses:
        return False, "unresolvable_host", message_for("unresolvable_host"), None

    # Every answer must be allowed. A single internal address rejects the URL,
    # so a split-horizon or partially-poisoned answer cannot be cherry-picked.
    for addr in addresses:
        try:
            ip = ipaddress.ip_address(addr)
        except ValueError:
            return False, "blocked_target", message_for("blocked_target"), None
        if not _allow_private_targets() and _is_blocked_ip(ip):
            logger.info("Feed URL %r resolves to a blocked address range", host)
            return False, "blocked_target", message_for("blocked_target"), None

    # Pin to the first allowed answer.
    return True, "", "", _target(addresses[0])


# ─── Pinned transport ─────────────────────────────────────────────────────────


class _PinnedHTTPSAdapter(HTTPAdapter):
    """
    HTTPS adapter that presents the real hostname to TLS while the URL carries a
    literal IP.

    `server_hostname` is both the SNI value and the name Python's ssl module
    verifies the certificate against, so pinning the TCP destination does not
    weaken verification. Verified against badssl.com: hostname mismatch,
    untrusted root and expired certificates all still fail.
    """

    def __init__(self, server_hostname: str, **kwargs):
        self._server_hostname = server_hostname
        super().__init__(**kwargs)

    def init_poolmanager(self, *args, **kwargs):
        kwargs["server_hostname"] = self._server_hostname
        return super().init_poolmanager(*args, **kwargs)


def _pinned_url(target: ValidatedTarget) -> str:
    """Rewrite the URL's authority to the pinned IP, keeping path and query."""
    parsed = urlparse(target.url)
    literal = f"[{target.ip}]" if ":" in target.ip else target.ip
    explicit_port = urlparse(target.url).port
    netloc = literal if explicit_port is None else f"{literal}:{explicit_port}"
    return urlunparse(parsed._replace(netloc=netloc, fragment=""))


def _mount_prefix(target: ValidatedTarget) -> str:
    literal = f"[{target.ip}]" if ":" in target.ip else target.ip
    explicit_port = urlparse(target.url).port
    authority = literal if explicit_port is None else f"{literal}:{explicit_port}"
    return f"{target.scheme}://{authority}"


def _session_for(target: ValidatedTarget) -> requests.Session:
    session = requests.Session()
    # Redirects are followed manually so each hop is re-validated.
    session.max_redirects = 1
    adapter = (
        _PinnedHTTPSAdapter(target.host)
        if target.scheme == "https"
        else HTTPAdapter()
    )
    session.mount(_mount_prefix(target), adapter)
    return session


def _normalize_redirect_target(base_url: str, location: str) -> str:
    """Resolve a Location header against the current (real, not pinned) URL."""
    resolved = urljoin(base_url, location)
    parsed = urlparse(resolved)
    return urlunparse(parsed._replace(fragment=""))


# ─── Fetching ─────────────────────────────────────────────────────────────────


def fetch_url(
    url: str,
    *,
    max_bytes: int = MAX_RESPONSE_BYTES,
    max_redirects: int = MAX_REDIRECTS,
    accept: str = FEED_ACCEPT,
) -> FeedFetchResult:
    """
    Fetch a user-supplied URL with SSRF guards, a pinned destination, bounded
    redirects and a size cap.

    Every hop is validated and resolved before it is requested, and the request
    is sent to the resolved IP, so the destination cannot change between the
    check and the connection.
    """
    current_url = url
    connected: List[str] = []

    for _ in range(max_redirects + 1):
        target, code, message = resolve_target(current_url)
        if target is None:
            return FeedFetchResult(
                ok=False, error_code=code, error_message=message, connected_ips=connected
            )

        session = _session_for(target)
        try:
            try:
                response = session.get(
                    _pinned_url(target),
                    headers={
                        "User-Agent": USER_AGENT,
                        "Accept": accept,
                        "Host": target.host_header,
                    },
                    timeout=(CONNECT_TIMEOUT, READ_TIMEOUT),
                    allow_redirects=False,
                    stream=True,
                )
            except requests.exceptions.SSLError as exc:
                logger.info("TLS failure for %r: %s", target.host, exc)
                return FeedFetchResult(
                    ok=False, error_code="tls_error", error_message=message_for("tls_error"),
                    connected_ips=connected,
                )
            except requests.exceptions.Timeout:
                return FeedFetchResult(
                    ok=False, error_code="timeout", error_message=message_for("timeout"),
                    connected_ips=connected,
                )
            except Exception as exc:
                # Never surface the raw error: it can contain internal hostnames.
                logger.info("Feed fetch failed for %r: %s", target.host, exc)
                return FeedFetchResult(
                    ok=False, error_code="fetch_failed", error_message=message_for("fetch_failed"),
                    connected_ips=connected,
                )

            connected.append(target.ip)

            try:
                if response.status_code in (301, 302, 303, 307, 308):
                    location = response.headers.get("location")
                    if not location:
                        return FeedFetchResult(
                            ok=False, error_code="fetch_failed", error_message=message_for("fetch_failed"),
                            status_code=response.status_code, connected_ips=connected,
                        )
                    # Resolve against the real URL, never the pinned IP form.
                    current_url = _normalize_redirect_target(current_url, location)
                    continue

                if response.status_code >= 400:
                    return FeedFetchResult(
                        ok=False,
                        error_code="http_error",
                        error_message=f"{message_for('http_error')} (HTTP {response.status_code})",
                        status_code=response.status_code,
                        final_url=current_url,
                        connected_ips=connected,
                    )

                declared = response.headers.get("content-length")
                if declared and declared.isdigit() and int(declared) > max_bytes:
                    return FeedFetchResult(
                        ok=False, error_code="too_large", error_message=message_for("too_large"),
                        status_code=response.status_code, final_url=current_url, connected_ips=connected,
                    )

                chunks: List[bytes] = []
                total = 0
                truncated = False
                try:
                    for chunk in response.iter_content(chunk_size=16384):
                        if not chunk:
                            continue
                        total += len(chunk)
                        if total > max_bytes:
                            truncated = True
                            break
                        chunks.append(chunk)
                except requests.exceptions.Timeout:
                    return FeedFetchResult(
                        ok=False, error_code="timeout", error_message=message_for("timeout"),
                        connected_ips=connected,
                    )
                except Exception as exc:
                    logger.info("Feed body read failed for %r: %s", target.host, exc)
                    return FeedFetchResult(
                        ok=False, error_code="fetch_failed", error_message=message_for("fetch_failed"),
                        connected_ips=connected,
                    )

                if truncated:
                    return FeedFetchResult(
                        ok=False, error_code="too_large", error_message=message_for("too_large"),
                        status_code=response.status_code, final_url=current_url,
                        truncated=True, connected_ips=connected,
                    )

                return FeedFetchResult(
                    ok=True,
                    content=b"".join(chunks),
                    final_url=current_url,
                    content_type=(response.headers.get("content-type") or "").lower(),
                    status_code=response.status_code,
                    connected_ips=connected,
                )
            finally:
                response.close()
        finally:
            session.close()

    return FeedFetchResult(
        ok=False, error_code="too_many_redirects", error_message=message_for("too_many_redirects"),
        connected_ips=connected,
    )
