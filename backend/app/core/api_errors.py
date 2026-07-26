"""
Machine-readable API error codes.

Backend error text used to be Vietnamese sentences that the frontend matched with
substring checks (`detail.includes('cấu hình')`). That is both fragile and the
reason an English UI could still show Vietnamese: the message was decided on the
server, where the user's language is not known.

The contract is now:

- every error this codebase raises carries a stable `code`
- the code travels in the JSON body as `error_code` **and** in the
  `X-Error-Code` response header
- `detail` keeps its existing Vietnamese sentence, so older callers and direct
  API consumers are unaffected
- the frontend maps the code to a translated message and only falls back to
  `detail` when it has no mapping for the code

Codes are plain lowercase snake_case identifiers. Add new ones here so the
frontend has a single list to mirror.
"""
from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import HTTPException, status

ERROR_CODE_HEADER = "X-Error-Code"

# ─── Registry ────────────────────────────────────────────────────────────────
# Grouped by area. The English text is a developer-facing description only; user
# messages come from the frontend dictionaries.
ERROR_CODES: Dict[str, str] = {
    # generic
    "bad_request": "Malformed request",
    "not_found": "Resource not found",
    "forbidden": "Not allowed",
    "conflict": "Conflicting state",
    "internal_error": "Unexpected server error",
    # sources / feeds
    "source_not_found": "Source does not exist for this tenant",
    "source_group_not_found": "Source group does not exist for this tenant",
    "source_duplicate_url": "A source with this URL already exists",
    "source_invalid_feed": "URL is not a valid RSS/Atom feed",
    "source_create_failed": "Could not create the source",
    "source_update_failed": "Could not update the source",
    "source_list_failed": "Could not list sources",
    # feed URL guards (mirror app.services.feed_fetcher.ERROR_MESSAGES)
    "invalid_url": "URL is not usable",
    "unsupported_scheme": "Only http/https is supported",
    "credentials_in_url": "URL must not embed credentials",
    "blocked_port": "Port not allowed",
    "unresolvable_host": "Host does not resolve",
    "blocked_target": "URL points at an internal address",
    "too_many_redirects": "Redirect chain too long",
    "timeout": "Upstream timed out",
    "tls_error": "TLS handshake failed",
    "http_error": "Upstream returned an HTTP error",
    "fetch_failed": "Could not fetch the URL",
    "too_large": "Response exceeds the size limit",
    "invalid_xml": "Content is not valid XML/RSS",
    "parse_failed": "Could not parse the content",
    # OPML import
    "opml_bad_extension": "Only .opml or .xml files are accepted",
    "opml_empty_file": "File is empty",
    "opml_too_large": "File exceeds the size limit",
    "opml_doctype_forbidden": "File contains a DOCTYPE declaration",
    "opml_invalid_xml": "File is not valid XML",
    "opml_not_opml": "File is not an OPML document",
    "opml_no_feeds": "No feeds found in the file",
    # auth
    "invalid_credentials": "Wrong email or password",
    "email_already_registered": "Email already registered",
    "password_too_short": "Password does not meet the minimum length",
}


def api_error(
    code: str,
    status_code: int = status.HTTP_400_BAD_REQUEST,
    detail: Optional[str] = None,
    *,
    headers: Optional[Dict[str, str]] = None,
) -> HTTPException:
    """
    Build an HTTPException that carries a machine-readable code.

    `detail` keeps the existing human sentence for backwards compatibility. The
    code is what the frontend should branch on.
    """
    merged_headers = {ERROR_CODE_HEADER: code}
    if headers:
        merged_headers.update(headers)
    return HTTPException(
        status_code=status_code,
        detail=detail or ERROR_CODES.get(code, code),
        headers=merged_headers,
    )


def code_for_status(status_code: int) -> str:
    if status_code == 404:
        return "not_found"
    if status_code in (401, 403):
        return "forbidden"
    if status_code == 409:
        return "conflict"
    if 400 <= status_code < 500:
        return "bad_request"
    return "internal_error"


def error_body(code: str, detail: Any) -> Dict[str, Any]:
    """Shape used by app.main's HTTPException handler."""
    return {"detail": detail, "error_code": code}
