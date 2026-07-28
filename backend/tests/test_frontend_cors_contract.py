"""CORS contract derived from the frontend Axios client source."""

from __future__ import annotations

import re
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


ORIGIN = "https://social-listening-azure.vercel.app"
CLIENT_SOURCE = Path(__file__).parents[2] / "frontend" / "src" / "lib" / "api.ts"
CALL_RE = re.compile(
    r"api\.(get|post|put|patch|delete)\(\s*([\"'`])([^\"'`]+)\2",
    re.IGNORECASE,
)
HEADER_KEY_RE = re.compile(r"['\"]([A-Za-z][A-Za-z0-9-]*)['\"]\s*:")


def _object_after(source: str, marker: str, start: int = 0) -> tuple[str, int] | None:
    """Return the balanced object following a marker such as ``headers:``."""
    marker_match = re.search(rf"{re.escape(marker)}\s*\{{", source[start:])
    if not marker_match:
        return None
    opening = start + marker_match.end() - 1
    depth = 0
    quote = None
    escaped = False
    for index in range(opening, len(source)):
        char = source[index]
        if quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
            continue
        if char in "'\"`":
            quote = char
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return source[opening + 1 : index], index + 1
    raise AssertionError(f"unbalanced object after {marker!r}")


def _materialize_path(path: str) -> str:
    # CORS preflight is middleware-only; placeholder IDs need no real record.
    return re.sub(r"\$\{[^}]+\}", "1", path)


def _frontend_request_contract() -> list[tuple[str, str, set[str]]]:
    source = CLIENT_SOURCE.read_text(encoding="utf-8")
    header_blocks = []
    cursor = 0
    while block := _object_after(source, "headers:", cursor):
        body, cursor = block
        header_blocks.append(body)
    explicit_headers = {
        header.lower()
        for body in header_blocks
        for header in HEADER_KEY_RE.findall(body)
    }
    if re.search(r"config\.headers\.Authorization\b", source):
        explicit_headers.add("authorization")
    calls = []
    for match in CALL_RE.finditer(source):
        method, path = match.group(1).upper(), _materialize_path(match.group(3))
        # Every Axios request inherits the client defaults/interceptor, while
        # explicit header blocks above capture route-specific headers such as
        # the login cache-busting headers. This is intentionally source-derived
        # rather than a hand-maintained route allow-list.
        calls.append((method, path, explicit_headers))
    assert calls, "frontend API client request contract was not discovered"
    return calls


def test_every_frontend_api_request_preflight_is_allowed():
    client = TestClient(app, raise_server_exceptions=False)
    contract = _frontend_request_contract()
    failures = []
    for method, path, headers in contract:
        response = client.options(
            path,
            headers={
                "Origin": ORIGIN,
                "Access-Control-Request-Method": method,
                "Access-Control-Request-Headers": ",".join(sorted(headers)),
            },
        )
        if response.status_code != 200:
            failures.append((method, path, sorted(headers), response.status_code, response.text))
            continue
        allowed = {
            item.strip().lower()
            for item in response.headers.get("Access-Control-Allow-Headers", "").split(",")
        }
        missing = headers - allowed
        if missing:
            failures.append((method, path, sorted(missing), response.status_code, "missing headers"))
    assert not failures, f"frontend CORS contract failures: {failures}"
