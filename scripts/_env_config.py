"""
Shared configuration for the developer/ops scripts in this directory.

These scripts used to carry hardcoded backend URLs and plaintext account
credentials. Everything now comes from the environment:

    NOPE360_BACKEND_URL     backend base URL
                            (default: https://sociallistening-9fvs.onrender.com)
    NOPE360_ADMIN_EMAIL     primary admin account email
    NOPE360_ADMIN_PASSWORD  primary admin account password
    NOPE360_USER_EMAIL      secondary (non-admin) account email    [optional]
    NOPE360_USER_PASSWORD   secondary (non-admin) account password [optional]
    NOPE360_ALT_EMAIL       third account email                   [optional]
    NOPE360_ALT_PASSWORD    third account password                [optional]

Some scripts exercised additional one-off accounts. Those use numbered slots:

    NOPE360_ACCOUNT4_EMAIL / NOPE360_ACCOUNT4_PASSWORD  ... up to ACCOUNT7

See `.env.example` in the repository root for the variable names. Never commit a
real value, and never print one: the helpers below only ever report whether a
value is present.
"""
from __future__ import annotations

import os
import sys
from typing import Optional

DEFAULT_BACKEND_URL = "https://sociallistening-9fvs.onrender.com"

# Retired deployment. Kept here only so scripts can detect and refuse it.
RETIRED_BACKEND_HOSTS = ("social-listening-backend.onrender.com",)


class MissingConfig(SystemExit):
    """Raised (as a clean exit) when required configuration is absent."""


def _fail(lines: list[str]) -> "MissingConfig":
    message = ["Missing configuration for this script:"]
    message.extend(f"  - {line}" for line in lines)
    message.append("")
    message.append("Set the variables listed in .env.example and run again.")
    message.append("Never hardcode a password back into a script.")
    return MissingConfig("\n".join(message))


def backend_url() -> str:
    """Backend base URL, without a trailing slash."""
    raw = (os.getenv("NOPE360_BACKEND_URL") or DEFAULT_BACKEND_URL).strip()
    url = raw.rstrip("/")
    if not url.startswith(("http://", "https://")):
        raise _fail([f"NOPE360_BACKEND_URL must start with http:// or https:// (got {len(raw)} chars)"])
    for retired in RETIRED_BACKEND_HOSTS:
        if retired in url:
            raise _fail(
                [
                    "NOPE360_BACKEND_URL points at a retired deployment that no longer exists.",
                    f"Use {DEFAULT_BACKEND_URL} or your own environment's URL.",
                ]
            )
    return url


def _required(name: str, what: str) -> str:
    value = os.getenv(name) or ""
    if not value.strip():
        raise _fail([f"{name} is required ({what})."])
    return value


def _optional(name: str) -> Optional[str]:
    value = os.getenv(name) or ""
    return value if value.strip() else None


def admin_email() -> str:
    return _required("NOPE360_ADMIN_EMAIL", "primary admin account email")


def admin_password() -> str:
    return _required("NOPE360_ADMIN_PASSWORD", "primary admin account password")


def user_email() -> str:
    return _required("NOPE360_USER_EMAIL", "secondary account email")


def user_password() -> str:
    return _required("NOPE360_USER_PASSWORD", "secondary account password")


def alt_email() -> str:
    return _required("NOPE360_ALT_EMAIL", "third account email")


def alt_password() -> str:
    return _required("NOPE360_ALT_PASSWORD", "third account password")


def account_email(slot: str) -> str:
    """Email for an arbitrary named slot, e.g. account_email("ACCOUNT4")."""
    return _required(f"NOPE360_{slot.upper()}_EMAIL", f"{slot} account email")


def account_password(slot: str) -> str:
    """Password for an arbitrary named slot, e.g. account_password("ACCOUNT4")."""
    return _required(f"NOPE360_{slot.upper()}_PASSWORD", f"{slot} account password")


def optional_user_credentials() -> Optional[tuple[str, str]]:
    """Secondary account, or None when it is not configured."""
    email, password = _optional("NOPE360_USER_EMAIL"), _optional("NOPE360_USER_PASSWORD")
    if email and password:
        return email, password
    return None


def describe_config() -> str:
    """Human-readable, value-free summary for script banners."""
    present = []
    for label, name in (
        ("admin", "NOPE360_ADMIN_EMAIL"),
        ("user", "NOPE360_USER_EMAIL"),
        ("alt", "NOPE360_ALT_EMAIL"),
    ):
        present.append(f"{label}={'set' if _optional(name) else 'unset'}")
    return f"backend={backend_url()} credentials({', '.join(present)})"


def login(email: str, password: str, *, timeout: int = 30) -> str:
    """
    Log in and return a bearer token.

    Raises SystemExit with a value-free message when authentication fails, so a
    wrong password never ends up echoed in a traceback.
    """
    import requests

    response = requests.post(
        f"{backend_url()}/api/auth/login",
        data={"username": email, "password": password},
        timeout=timeout,
    )
    if response.status_code != 200:
        raise SystemExit(
            f"Login failed for the configured account (HTTP {response.status_code}). "
            "Check NOPE360_ADMIN_EMAIL / NOPE360_ADMIN_PASSWORD."
        )
    token = response.json().get("access_token")
    if not token:
        raise SystemExit("Login response did not contain an access token.")
    return token


def admin_token(*, timeout: int = 30) -> str:
    """Convenience: log in with the primary admin account."""
    return login(admin_email(), admin_password(), timeout=timeout)


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _self_check() -> int:
    """`python scripts/_env_config.py` prints a value-free config summary."""
    try:
        print(describe_config())
    except SystemExit as exc:
        print(str(exc), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(_self_check())
