from types import SimpleNamespace

import pytest

from app.core.config import settings
from app.core.crypto import decrypt_token, encrypt_token
from app.schemas.connectors import CapabilityState
from app.services import connector_capabilities as capabilities_service
from app.services.connector_capabilities import get_connector_capabilities
from app.services.social_crawler_service import SocialCrawlerService
from app.services.connectors.meta_connector import MetaConnector
from app.api import crawl, discovery, integrations


class _Result:
    def __init__(self, *, scalar=None, rows=None):
        self._scalar = scalar
        self._rows = rows or []

    def scalar_one_or_none(self):
        return self._scalar

    def scalars(self):
        return self

    def all(self):
        return self._rows


class _CapabilityDB:
    def __init__(self, integration=None, accounts=None):
        self.integration = integration
        self.accounts = accounts or []
        self.calls = 0

    def execute(self, _statement):
        self.calls += 1
        if self.calls == 1:
            return _Result(scalar=self.integration)
        return _Result(rows=self.accounts)


@pytest.fixture(autouse=True)
def capability_settings(monkeypatch):
    for name in (
        "META_APP_ID", "META_APP_SECRET", "META_REDIRECT_URI", "TOKEN_ENCRYPTION_KEY",
        "NEWS_API_KEY", "YOUTUBE_API_KEY", "TWITTER_BEARER_TOKEN",
    ):
        monkeypatch.setattr(settings, name, "")
    monkeypatch.setattr(settings, "TWITTER_CONNECTOR_ENABLED", False)
    monkeypatch.setattr(settings, "BASIC_CRAWL_ENABLED", True)
    monkeypatch.setattr(capabilities_service, "_missing_modules", lambda _names: [])


def test_contract_covers_every_connector_and_state_without_secrets():
    response = get_connector_capabilities(_CapabilityDB(), user_id=7)

    assert set(response.connectors) == {
        "rss", "website", "google_news_rss", "newsapi", "youtube",
        "facebook_page", "instagram_business", "twitter", "reddit", "tiktok",
    }
    assert response.connectors["rss"].state == CapabilityState.READY
    assert response.connectors["website"].state == CapabilityState.READY
    assert response.connectors["google_news_rss"].state == CapabilityState.READY
    assert response.connectors["newsapi"].state == CapabilityState.CONFIG_REQUIRED
    assert response.connectors["youtube"].missing_prerequisites == ["YOUTUBE_API_KEY"]
    assert response.connectors["facebook_page"].state == CapabilityState.CONFIG_REQUIRED
    assert response.connectors["reddit"].state == CapabilityState.BEST_EFFORT_UNSUPPORTED
    assert response.connectors["reddit"].production_ready is False
    assert response.connectors["tiktok"].state == CapabilityState.NOT_IMPLEMENTED
    assert response.exports["infographic"].preview_only is True
    serialized = response.json()
    assert "secret-value" not in serialized


def test_all_capability_routes_delegate_to_one_authoritative_service(monkeypatch):
    expected = object()
    user = SimpleNamespace(id=7)
    db = object()
    for module, endpoint in (
        (integrations, integrations.get_integrations_capabilities),
        (crawl, crawl.get_capabilities),
        (discovery, discovery.get_connector_status),
    ):
        monkeypatch.setattr(module, "get_connector_capabilities", lambda actual_db, user_id: expected)
        assert endpoint(db=db, current_user=user) is expected


def test_configured_provider_keys_become_ready(monkeypatch):
    monkeypatch.setattr(settings, "NEWS_API_KEY", "secret-value")
    monkeypatch.setattr(settings, "YOUTUBE_API_KEY", "secret-value")
    monkeypatch.setattr(settings, "TWITTER_CONNECTOR_ENABLED", True)
    monkeypatch.setattr(settings, "TWITTER_BEARER_TOKEN", "secret-value")

    response = get_connector_capabilities(_CapabilityDB(), user_id=7)

    assert response.connectors["newsapi"].state == CapabilityState.READY
    assert response.connectors["youtube"].state == CapabilityState.READY
    assert response.connectors["twitter"].state == CapabilityState.READY
    assert "secret-value" not in response.json()


def test_twitter_requires_explicit_enable_and_exact_bearer_name(monkeypatch):
    monkeypatch.setattr(settings, "TWITTER_BEARER_TOKEN", "secret-value")
    disabled = get_connector_capabilities(_CapabilityDB(), user_id=7)
    assert disabled.connectors["twitter"].state == CapabilityState.CONFIG_REQUIRED
    assert disabled.connectors["twitter"].missing_prerequisites == ["TWITTER_CONNECTOR_ENABLED=true"]

    monkeypatch.setattr(settings, "TWITTER_CONNECTOR_ENABLED", True)
    monkeypatch.setattr(settings, "TWITTER_BEARER_TOKEN", "")
    missing_token = get_connector_capabilities(_CapabilityDB(), user_id=7)
    assert missing_token.connectors["twitter"].missing_prerequisites == ["TWITTER_BEARER_TOKEN"]


def test_meta_requires_complete_config_then_oauth(monkeypatch):
    for name in ("META_APP_ID", "META_APP_SECRET", "META_REDIRECT_URI", "TOKEN_ENCRYPTION_KEY"):
        monkeypatch.setattr(settings, name, "configured")

    response = get_connector_capabilities(_CapabilityDB(), user_id=7)

    assert response.connectors["facebook_page"].state == CapabilityState.OAUTH_REQUIRED
    assert response.connectors["instagram_business"].state == CapabilityState.OAUTH_REQUIRED
    assert response.connectors["facebook_page"].action == "META_OAUTH"


def test_meta_connector_requires_redirect_and_encryption_prerequisites(monkeypatch):
    monkeypatch.setattr(settings, "META_APP_ID", "configured")
    monkeypatch.setattr(settings, "META_APP_SECRET", "configured")
    monkeypatch.setattr(settings, "META_REDIRECT_URI", "")
    monkeypatch.setattr(settings, "TOKEN_ENCRYPTION_KEY", "")
    assert MetaConnector().validate_config() is False

    monkeypatch.setattr(settings, "META_REDIRECT_URI", "https://example.invalid/callback")
    monkeypatch.setattr(settings, "TOKEN_ENCRYPTION_KEY", "configured")
    assert MetaConnector().validate_config() is True


def test_meta_readiness_is_platform_specific(monkeypatch):
    for name in ("META_APP_ID", "META_APP_SECRET", "META_REDIRECT_URI", "TOKEN_ENCRYPTION_KEY"):
        monkeypatch.setattr(settings, name, "configured")
    integration = SimpleNamespace(id=11, status="active", token_expires_at=None)
    accounts = [SimpleNamespace(account_type="page")]

    response = get_connector_capabilities(_CapabilityDB(integration, accounts), user_id=7)

    assert response.connectors["facebook_page"].state == CapabilityState.READY
    assert response.connectors["instagram_business"].state == CapabilityState.OAUTH_REQUIRED


def test_runtime_dependency_failure_is_not_reported_ready(monkeypatch):
    monkeypatch.setattr(capabilities_service, "_missing_modules", lambda _names: ["python:missing"])
    response = get_connector_capabilities(_CapabilityDB(), user_id=7)
    assert response.connectors["rss"].state == CapabilityState.CONFIG_REQUIRED
    assert response.connectors["website"].state == CapabilityState.CONFIG_REQUIRED
    assert response.connectors["google_news_rss"].state == CapabilityState.CONFIG_REQUIRED


@pytest.mark.asyncio
async def test_twitter_crawler_is_fail_closed_when_not_explicitly_enabled(monkeypatch):
    monkeypatch.setattr(settings, "TWITTER_CONNECTOR_ENABLED", False)
    monkeypatch.setattr(settings, "TWITTER_BEARER_TOKEN", "secret-value")
    assert await SocialCrawlerService().crawl_twitter("nope360") == []


def test_provider_token_crypto_fails_closed_without_configuration(monkeypatch):
    monkeypatch.setattr(settings, "TOKEN_ENCRYPTION_KEY", "")
    with pytest.raises(RuntimeError, match="TOKEN_ENCRYPTION_KEY"):
        encrypt_token("secret-value")
    with pytest.raises(RuntimeError, match="TOKEN_ENCRYPTION_KEY"):
        decrypt_token("encrypted-value")
