import importlib.util
from datetime import datetime, timezone
from typing import Dict, Iterable, Optional, Set

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.integration import SocialIntegration, SocialIntegrationAccount
from app.schemas.connectors import (
    CapabilityState,
    ConnectorCapabilitiesResponse,
    ConnectorCapability,
)


def _missing_settings(names: Iterable[str]) -> list[str]:
    return [name for name in names if not bool(getattr(settings, name, None))]


def _missing_modules(names: Iterable[str]) -> list[str]:
    return [f"python:{name}" for name in names if importlib.util.find_spec(name) is None]


def _capability(
    state: CapabilityState,
    reason_code: str,
    *,
    missing: Optional[list[str]] = None,
    action: Optional[str] = None,
    preview_only: bool = False,
) -> ConnectorCapability:
    return ConnectorCapability(
        state=state,
        production_ready=state == CapabilityState.READY,
        action_enabled=bool(action),
        action=action,
        reason_code=reason_code,
        missing_prerequisites=missing or [],
        preview_only=preview_only,
    )


def _configured_capability(setting_name: str, reason_prefix: str) -> ConnectorCapability:
    if bool(getattr(settings, setting_name, None)):
        return _capability(CapabilityState.READY, f"{reason_prefix}_READY")
    return _capability(
        CapabilityState.CONFIG_REQUIRED,
        f"{reason_prefix}_CONFIG_REQUIRED",
        missing=[setting_name],
    )


def _meta_accounts(db: Session, user_id: int) -> Set[str]:
    integration = db.execute(
        select(SocialIntegration).where(
            SocialIntegration.user_id == user_id,
            SocialIntegration.provider == "meta",
        )
    ).scalar_one_or_none()
    if not integration or integration.status not in {"active", "limited"}:
        return set()
    expires_at = integration.token_expires_at
    if expires_at is not None:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at <= datetime.now(timezone.utc):
            return set()
    accounts = db.execute(
        select(SocialIntegrationAccount).where(
            SocialIntegrationAccount.integration_id == integration.id,
            SocialIntegrationAccount.selected.is_(True),
        )
    ).scalars().all()
    return {account.account_type for account in accounts}


def get_connector_capabilities(db: Session, user_id: int) -> ConnectorCapabilitiesResponse:
    runtime_missing = _missing_modules(("requests", "bs4"))
    website_enabled = bool(getattr(settings, "BASIC_CRAWL_ENABLED", True))
    website_missing = ([] if website_enabled else ["BASIC_CRAWL_ENABLED=true"]) + runtime_missing
    website = (
        _capability(CapabilityState.READY, "WEBSITE_READY")
        if not website_missing
        else _capability(
            CapabilityState.CONFIG_REQUIRED,
            "WEBSITE_RUNTIME_REQUIRED",
            missing=website_missing,
        )
    )

    rss_missing = _missing_modules(("feedparser",))
    rss = (
        _capability(CapabilityState.READY, "RSS_READY", action="ADD_SOURCE")
        if not rss_missing
        else _capability(
            CapabilityState.CONFIG_REQUIRED,
            "RSS_RUNTIME_REQUIRED",
            missing=rss_missing,
        )
    )

    google_news_missing = _missing_modules(("httpx", "feedparser"))
    google_news = (
        _capability(CapabilityState.READY, "GOOGLE_NEWS_RSS_READY")
        if not google_news_missing
        else _capability(
            CapabilityState.CONFIG_REQUIRED,
            "GOOGLE_NEWS_RSS_RUNTIME_REQUIRED",
            missing=google_news_missing,
        )
    )

    meta_missing = _missing_settings(
        ("META_APP_ID", "META_APP_SECRET", "META_REDIRECT_URI", "TOKEN_ENCRYPTION_KEY")
    )
    selected_meta_accounts = set() if meta_missing else _meta_accounts(db, user_id)

    def meta_capability(account_type: str, prefix: str) -> ConnectorCapability:
        if meta_missing:
            return _capability(
                CapabilityState.CONFIG_REQUIRED,
                f"{prefix}_CONFIG_REQUIRED",
                missing=meta_missing,
            )
        if account_type not in selected_meta_accounts:
            return _capability(
                CapabilityState.OAUTH_REQUIRED,
                f"{prefix}_OAUTH_REQUIRED",
                missing=["META_OAUTH_ACCOUNT"],
                action="META_OAUTH",
            )
        return _capability(CapabilityState.READY, f"{prefix}_READY")

    twitter_enabled = bool(getattr(settings, "TWITTER_CONNECTOR_ENABLED", False))
    if not twitter_enabled:
        twitter = _capability(
            CapabilityState.CONFIG_REQUIRED,
            "TWITTER_EXPLICIT_ENABLE_REQUIRED",
            missing=["TWITTER_CONNECTOR_ENABLED=true"],
        )
    elif not settings.TWITTER_BEARER_TOKEN:
        twitter = _capability(
            CapabilityState.CONFIG_REQUIRED,
            "TWITTER_CONFIG_REQUIRED",
            missing=["TWITTER_BEARER_TOKEN"],
        )
    else:
        twitter = _capability(CapabilityState.READY, "TWITTER_READY")

    connectors: Dict[str, ConnectorCapability] = {
        "rss": rss,
        "website": website,
        "google_news_rss": google_news,
        "newsapi": _configured_capability("NEWS_API_KEY", "NEWSAPI"),
        "youtube": _configured_capability("YOUTUBE_API_KEY", "YOUTUBE"),
        "facebook_page": meta_capability("page", "FACEBOOK_PAGE"),
        "instagram_business": meta_capability("instagram_business", "INSTAGRAM_BUSINESS"),
        "twitter": twitter,
        "reddit": _capability(
            CapabilityState.BEST_EFFORT_UNSUPPORTED,
            "REDDIT_BEST_EFFORT_UNSUPPORTED",
        ),
        "tiktok": _capability(CapabilityState.NOT_IMPLEMENTED, "TIKTOK_NOT_IMPLEMENTED"),
    }
    exports = {
        "infographic": _capability(
            CapabilityState.NOT_IMPLEMENTED,
            "INFOGRAPHIC_PREVIEW_ONLY",
            preview_only=True,
        )
    }
    return ConnectorCapabilitiesResponse(connectors=connectors, exports=exports)
