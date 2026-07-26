# -*- coding: utf-8 -*-
"""
Repository-wide static guard against reintroducing plaintext credentials or the
retired backend URL into executable code.

Deliberately pattern-based: this file must never contain a credential value, so
it checks *shapes* (a password identifier bound to a string literal, an admin
email constant, a DSN with inline credentials) rather than known secrets.

Scope is tracked, executable files. Markdown is checked only for the retired
backend URL, since docs legitimately discuss configuration.
"""
import re
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]

RETIRED_BACKEND_HOST = "social-listening-backend.onrender.com"
CURRENT_BACKEND_URL = "https://sociallistening-9fvs.onrender.com"

EXECUTABLE_SUFFIXES = (".py", ".ts", ".tsx", ".js", ".mjs", ".cjs", ".bat", ".ps1", ".sh", ".yml", ".yaml", ".json")

# Files allowed to bind credential-shaped literals, with the reason.
CREDENTIAL_LITERAL_ALLOWLIST = {
    # Offline test fixtures: values are fake and only ever hit SQLite.
    "backend/tests/test_ai_chat_api.py": "offline fixture user",
    "backend/tests/test_auth_userresponse_compat.py": "offline fixture user",
    "backend/tests/test_dashboard_trend_datetime_parsing.py": "offline fixture user",
    "backend/tests/test_isolated_auth_integration.py": "offline fixture user",
    "backend/tests/test_manual_scan.py": "offline fixture user",
    "backend/tests/test_manual_scan_schema_regression.py": "offline fixture user",
    "backend/tests/test_mentions_real_actions.py": "offline fixture user",
    "backend/tests/test_notifications.py": "offline fixture user",
    "backend/tests/test_reports.py": "offline fixture user",
    "backend/tests/test_saved_filters_schema_registry.py": "offline fixture user",
    "backend/tests/test_source_type.py": "offline fixture user",
    "backend/tests/test_ai_assistant_service.py": "offline fixture user",
    "backend/tests/test_auth_credential_hygiene.py": "asserts on credential shapes",
    "backend/tests/test_repo_secret_hygiene.py": "this guard",
    "backend/tests/test_summary_ai.py": "offline fixture user",
    "backend/tests/test_mentions_verifiable.py": "offline fixture user",
    "backend/tests/test_mentions_phase2.py": "offline fixture user",
    "backend/tests/test_mentions_regression.py": "offline fixture user",
    "backend/tests/test_auto_scan.py": "offline fixture user",
    "backend/tests/test_scheduler.py": "offline fixture user",
    "backend/tests/test_source_integrity.py": "offline fixture user",
    "backend/tests/test_mentions_search_integrity.py": "offline fixture user",
    "backend/tests/test_reports_groupby_regression.py": "offline fixture user",
    "backend/tests/test_cache.py": "offline fixture",
    "backend/tests/test_startup_settings_scope.py": "offline fixture",
    "backend/tests/test_system_migrate_security.py": "offline fixture",
    "backend/tests/test_google_news_url_resolution.py": "offline fixture",
    "backend/tests/test_feed_fetcher.py": "offline fixture",
    "backend/tests/test_rss_ingestion.py": "offline fixture",
    # Translation dictionaries hold UI labels such as `smtpPassword: 'SMTP password'`.
    # By construction they contain no credential values; their contents are governed
    # by frontend/scripts/check-i18n-keys.mjs (parity + placeholder detection).
    "frontend/src/i18n/locales/vi.ts": "i18n dictionary: UI labels only",
    "frontend/src/i18n/locales/en.ts": "i18n dictionary: UI labels only",
}

# Placeholder addresses that are fine anywhere.
PLACEHOLDER_EMAILS = {
    "admin@example.com",
    "test@example.com",
    "user@example.com",
    "you@company.com",
    "email@example.com",
    "someone@example.com",
    "ban@congty.com",
    "admin@your-domain.com",
    "noreply@example.com",
    "support@example.com",
}

# `PASSWORD = "..."` / `"password": "..."` / `password='...'`
PASSWORD_LITERAL = re.compile(
    r"""(?:^|[\s,{(])                     # start of a binding
        (?:['"]?)
        (?:[A-Z_]*PASSWORD|password|passwd|pwd|new_password|current_password|smtpPassword)
        (?:['"]?)
        \s*[:=]\s*
        (['"])(?P<value>[^'"\n]{4,})\1
    """,
    re.VERBOSE,
)

# Anything that looks like a real password rather than a placeholder/expression.
PLACEHOLDER_VALUES = re.compile(
    r"^(?:$|\s*$|<|\{|\.\.\.|x{3,}|\*{3,}|•+|test|testing|secret|changeme|password|your[-_ ]?password|"
    r"string|str|none|null|true|false|new-password|confirm-new-password|current-password|"
    r"fakehash|hashed|placeholder|example|dummy|sample|demo)$",
    re.IGNORECASE,
)

EMAIL_CONSTANT = re.compile(
    r"""(?:^|[\s,{(])
        (?:['"]?)
        (?:[A-Z_]*EMAIL|email|USERNAME|username|user_email|admin_email)
        (?:['"]?)
        \s*[:=]\s*
        (['"])(?P<value>[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})\1
    """,
    re.VERBOSE,
)

# postgres://user:password@host, mysql://..., redis://user:pass@...
DSN_WITH_CREDENTIALS = re.compile(r"[a-z+]{2,20}://(?P<user>[^:/@\s'\"]{2,}):(?P<password>[^@/\s'\"]{4,})@(?P<host>[^\s'\"/]+)")

# Tokens that make a DSN obviously an example rather than a real credential.
_PLACEHOLDER_DSN_TOKENS = (
    "user:password", "USER:PASSWORD", "user:pass", "postgres:postgres", "root:root",
    "<", "${", "%s", "xxx", "***", "user:secret", "redis:redis",
)
# A localhost target cannot expose a remote system, and local dev docs need one.
_LOCAL_HOSTS = ("localhost", "127.0.0.1", "[::1]", "host.docker.internal", "db", "postgres", "redis")


def _is_placeholder_dsn(dsn: str) -> bool:
    if any(token in dsn for token in _PLACEHOLDER_DSN_TOKENS):
        return True
    match = DSN_WITH_CREDENTIALS.search(dsn)
    if not match:
        return True
    host = match.group("host").split(":")[0].lower()
    return host in _LOCAL_HOSTS


def _tracked_files() -> list[str]:
    result = subprocess.run(
        ["git", "ls-files"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=True,
    )
    return [line for line in result.stdout.splitlines() if line.strip()]


def _read(rel: str) -> str:
    path = REPO_ROOT / rel
    if not path.exists():
        return ""
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return ""


@pytest.fixture(scope="module")
def tracked_files():
    files = _tracked_files()
    assert files, "git ls-files returned nothing; is this a git checkout?"
    return files


def test_retired_backend_url_absent_from_executable_code(tracked_files):
    offenders = []
    for rel in tracked_files:
        if not rel.endswith(EXECUTABLE_SUFFIXES):
            continue
        # This guard names the retired host on purpose.
        if rel == "backend/tests/test_repo_secret_hygiene.py":
            continue
        if rel == "scripts/_env_config.py":
            # Lists the retired host so scripts can refuse it.
            continue
        text = _read(rel)
        if RETIRED_BACKEND_HOST in text:
            offenders.append(f"{rel} ({text.count(RETIRED_BACKEND_HOST)}x)")
    assert not offenders, (
        "The retired backend URL must not appear in executable code. "
        f"Use {CURRENT_BACKEND_URL} or NOPE360_BACKEND_URL. Offenders: {offenders}"
    )


def test_retired_backend_url_absent_from_docs(tracked_files):
    offenders = []
    for rel in tracked_files:
        if not rel.endswith((".md", ".txt")):
            continue
        text = _read(rel)
        if RETIRED_BACKEND_HOST in text:
            offenders.append(rel)
    assert not offenders, f"Docs still reference the retired backend URL: {offenders}"


def test_no_password_literals_outside_fixtures(tracked_files):
    offenders = []
    for rel in tracked_files:
        if not rel.endswith(EXECUTABLE_SUFFIXES):
            continue
        if rel in CREDENTIAL_LITERAL_ALLOWLIST:
            continue
        text = _read(rel)
        for match in PASSWORD_LITERAL.finditer(text):
            value = match.group("value").strip()
            if PLACEHOLDER_VALUES.match(value):
                continue
            if value.startswith(("$", "%", "{", "<", "os.", "process.env")):
                continue
            line = text[: match.start()].count("\n") + 1
            # Report the location and length only; never the value.
            offenders.append(f"{rel}:{line} (password literal, {len(value)} chars)")
    assert not offenders, (
        "Plaintext password literals found. Read credentials from the environment "
        f"instead. Offenders: {offenders}"
    )


def test_no_hardcoded_account_emails_outside_fixtures(tracked_files):
    offenders = []
    for rel in tracked_files:
        if not rel.endswith(EXECUTABLE_SUFFIXES):
            continue
        if rel in CREDENTIAL_LITERAL_ALLOWLIST:
            continue
        text = _read(rel)
        for match in EMAIL_CONSTANT.finditer(text):
            value = match.group("value").strip()
            if value in PLACEHOLDER_EMAILS or value.endswith((".example", ".test", ".invalid", ".local")):
                continue
            line = text[: match.start()].count("\n") + 1
            offenders.append(f"{rel}:{line} (account email literal)")
    assert not offenders, (
        "Hardcoded account emails found. Read them from the environment instead. "
        f"Offenders: {offenders}"
    )


def test_no_connection_strings_with_inline_credentials(tracked_files):
    offenders = []
    for rel in tracked_files:
        if not rel.endswith(EXECUTABLE_SUFFIXES) and not rel.endswith((".md", ".txt", ".example")):
            continue
        if rel in ("backend/tests/test_repo_secret_hygiene.py",):
            continue
        text = _read(rel)
        for match in DSN_WITH_CREDENTIALS.finditer(text):
            dsn = match.group(0)
            if _is_placeholder_dsn(dsn):
                continue
            line = text[: match.start()].count("\n") + 1
            offenders.append(f"{rel}:{line} (DSN with inline credentials)")
    assert not offenders, (
        "Connection strings with inline credentials found. Use DATABASE_URL / "
        f"NOPE360_DB_URL from the environment. Offenders: {offenders}"
    )


def test_scripts_helper_exposes_env_driven_config():
    source = _read("scripts/_env_config.py")
    assert source, "scripts/_env_config.py is missing"
    for name in ("NOPE360_BACKEND_URL", "NOPE360_ADMIN_EMAIL", "NOPE360_ADMIN_PASSWORD"):
        assert name in source, f"{name} must be documented in scripts/_env_config.py"
    assert CURRENT_BACKEND_URL in source, "the current backend URL must be the documented default"


def test_env_example_documents_script_variables():
    source = _read(".env.example")
    assert source, ".env.example is missing"
    for name in (
        "NOPE360_BACKEND_URL",
        "NOPE360_ADMIN_EMAIL",
        "NOPE360_ADMIN_PASSWORD",
        "NOPE360_DB_URL",
    ):
        assert name in source, f"{name} must be listed in .env.example"
    # The example file must not carry a usable value.
    for match in PASSWORD_LITERAL.finditer(source):
        value = match.group("value").strip()
        assert PLACEHOLDER_VALUES.match(value), ".env.example must only contain placeholders"
