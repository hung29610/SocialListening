# -*- coding: utf-8 -*-
"""
Regression tests for login/registration credential hygiene.

Motivated by Chrome's "the password you just used was found in a data breach"
prompt after login. The prompt itself is browser-owned and cannot (and must not)
be suppressed from application code; these tests instead lock down the
application-side conditions that make such a warning likely or repeatable:

- the admin bootstrap script must not ship a hardcoded/weak default password;
- registration must not accept a password weaker than the change-password rule;
- no plaintext credential may be logged by the auth module.
"""
import os
import re
import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("DATABASE_URL", "sqlite:///test_auth_credential_hygiene.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-tests")
os.environ.setdefault("ENVIRONMENT", "test")

BACKEND_ROOT = Path(__file__).resolve().parents[1]
CREATE_ADMIN = BACKEND_ROOT / "app" / "scripts" / "create_admin.py"
AUTH_API = BACKEND_ROOT / "app" / "api" / "auth.py"


class TestAdminBootstrapScript:
    def test_does_not_contain_a_hardcoded_password(self):
        source = CREATE_ADMIN.read_text(encoding="utf-8")
        # Pattern-based on purpose: asserting against a specific literal would
        # mean storing a credential in the test file.
        assert 'get_password_hash("' not in source
        assert "get_password_hash('" not in source
        # `<...>` is a documentation placeholder in the usage examples, not a value.
        bindings = [
            m.group(1)
            for m in re.finditer(r"(?:PASSWORD|password)\s*=\s*['\"]([^'\"\n]{4,})['\"]", source)
            if not m.group(1).startswith("<")
        ]
        assert not bindings, "create_admin.py must not bind a password to a string literal"

    def test_reads_credentials_from_environment(self):
        source = CREATE_ADMIN.read_text(encoding="utf-8")
        assert "ADMIN_EMAIL" in source
        assert "ADMIN_PASSWORD" in source

    def test_never_prints_the_password_value(self):
        source = CREATE_ADMIN.read_text(encoding="utf-8")
        for line in source.splitlines():
            stripped = line.strip()
            if stripped.startswith("print(") and "password" in stripped.lower():
                # Printing the literal variable is what must not happen.
                assert "{password}" not in stripped
                assert "', password" not in stripped

    def test_refuses_to_run_without_credentials(self):
        env = {
            **os.environ,
            "PYTHONPATH": str(BACKEND_ROOT),
            "DATABASE_URL": "sqlite:///test_auth_credential_hygiene.db",
            "SECRET_KEY": "test-secret-key-for-tests",
        }
        env.pop("ADMIN_EMAIL", None)
        env.pop("ADMIN_PASSWORD", None)

        result = subprocess.run(
            [sys.executable, "-m", "app.scripts.create_admin"],
            cwd=str(BACKEND_ROOT),
            env=env,
            capture_output=True,
            text=True,
            timeout=120,
        )
        assert result.returncode == 1, result.stdout + result.stderr
        assert "ADMIN_EMAIL is required." in result.stdout
        assert "ADMIN_PASSWORD is required." in result.stdout

    def test_refuses_a_short_password(self):
        env = {
            **os.environ,
            "PYTHONPATH": str(BACKEND_ROOT),
            "DATABASE_URL": "sqlite:///test_auth_credential_hygiene.db",
            "SECRET_KEY": "test-secret-key-for-tests",
            "ADMIN_EMAIL": "admin@example.com",
            "ADMIN_PASSWORD": "short",
        }
        result = subprocess.run(
            [sys.executable, "-m", "app.scripts.create_admin"],
            cwd=str(BACKEND_ROOT),
            env=env,
            capture_output=True,
            text=True,
            timeout=120,
        )
        assert result.returncode == 1, result.stdout + result.stderr
        assert "at least 12 characters" in result.stdout
        # The rejected value must not be echoed back.
        assert "short" not in result.stdout.replace("shorter", "")


class TestRegistrationPasswordFloor:
    def test_user_create_enforces_minimum_length(self):
        from pydantic import ValidationError

        from app.api.auth import UserCreate

        with pytest.raises(ValidationError):
            UserCreate(email="new-user@example.com", password="short12")  # 7 chars

        model = UserCreate(email="new-user@example.com", password="a-long-enough-secret")
        assert model.password == "a-long-enough-secret"

    def test_minimum_matches_the_change_password_rule(self):
        source = AUTH_API.read_text(encoding="utf-8")
        # /me/change-password rejects < 8; registration must not be weaker.
        assert "at least 8 characters" in source
        assert "min_length=8" in source


class TestAuthModuleDoesNotLogCredentials:
    def test_no_plaintext_password_logging(self):
        source = AUTH_API.read_text(encoding="utf-8")
        lowered = source.lower()
        for marker in (
            "print(form_data.password",
            "logger.info(form_data.password",
            "logger.debug(form_data.password",
            "print(user_data.password",
            "logger.info(user_data.password",
            "logger.debug(user_data.password",
        ):
            assert marker not in lowered
