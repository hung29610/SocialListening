"""Nope360 API runtime (startup-state-machine-v1 release contract)."""

import os
import logging
import traceback
import re
import uuid

import redis
from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import engine, SessionLocal
from app.core import startup_state
from app.core import ownership as _ownership  # register fail-closed write guards
from app.core.ownership import TenantOwnershipError, TenantReason
from app.core.security import get_current_superuser
from app.core.security_operations import get_enabled_superuser
from app.core.rate_limit import (
    RateLimitConfigurationError,
    classify_rate_limit_scope,
    client_identity,
    get_rate_limiter,
    rate_limit_admin_user,
    rate_limit_ai_user,
    rate_limit_scan_user,
)
from app.models.user import User
from app.api import (
    collectors,
    auth,
    keywords,
    sources,
    mentions,
    alerts,
    incidents,
    reports,
    dashboard,
    crawl,
    takedown,
    services,
    admin,
    users,
    settings as settings_api,
    roles,
    api_keys,
    branding,
    audit,
    monitor,
    system,
    ai,
    ai_config,
    evidence,
    ai_chat,
    competitors,
    influencers,
    reputation,
    discovery,
    integrations,
    realtime,
    saved_filters,
    organizations,
    billing,
)

from app.api import service_requests, webinar

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run the one authoritative startup state machine, then serve safely."""
    logger.info("Starting Social Listening Platform...")
    from pathlib import Path
    from app.core.startup_orchestrator import run_startup_orchestrator

    free_mvp_embedded = os.getenv("FREE_MVP_RUNTIME_MODE", "").lower() == "embedded"
    runtime_label = "free_mvp_embedded" if free_mvp_embedded else "standard"
    outcome = run_startup_orchestrator(
        Path(__file__).resolve().parent.parent,
        runtime_label,
    )
    tenant_ready = outcome.tenant_ready

    # ── Optional admin seed: promote an existing user to super_admin once ──────
    # Set ADMIN_SEED_EMAIL in your environment to enable this.
    # The target user must already exist in the database.
    # If already a super_admin the UPDATE is a no-op.
    admin_seed_email = (settings.ADMIN_SEED_EMAIL or "").strip()
    if tenant_ready and admin_seed_email:
        db = SessionLocal()
        try:
            from sqlalchemy import text
            result = db.execute(
                text(
                    "UPDATE users "
                    "SET is_superuser = true, is_active = true, role = 'super_admin' "
                    "WHERE email = :email"
                ),
                {"email": admin_seed_email},
            )
            db.commit()
            if result.rowcount > 0:
                logger.info("Admin seed: granted super_admin to configured ADMIN_SEED_EMAIL account.")
            else:
                logger.warning(
                    "Admin seed: ADMIN_SEED_EMAIL is set but no matching user was found. "
                    "Create the user first, then restart."
                )
        except Exception as e:
            logger.error(f"Admin seed failed: {e}")
        finally:
            db.close()

    # Seed service data
    if tenant_ready:
        try:
            from app.scripts.seed_services import seed_services_if_empty
            db = SessionLocal()
            try:
                seed_services_if_empty(db)
                logger.info("Service seed check complete")
            finally:
                db.close()
        except Exception as e:
            logger.warning("Service seed skipped error_type=%s", type(e).__name__)

    # The web process may run APScheduler only when explicitly enabled.  It is
    # never inferred from the legacy standalone-worker SCHEDULER_ENABLED flag.
    enable_embedded_scheduler = free_mvp_embedded or (
        os.getenv("ENABLE_EMBEDDED_SCHEDULER", "false").lower() == "true"
    )
    scheduler_active = False
    if enable_embedded_scheduler and tenant_ready:
        try:
            from app.services.scheduler_service import start_scheduler
            is_started = start_scheduler(is_embedded=True)
            if is_started:
                logger.info("Background scheduler started")
                scheduler_active = True
            else:
                logger.warning("Scheduler start failed or was disabled")
        except Exception as e:
            logger.warning("Scheduler start failed error_type=%s", type(e).__name__)
    elif enable_embedded_scheduler:
        logger.warning(
            "STARTUP_STATE phase=scheduler status=inactive reason=TENANT_READINESS_BLOCKED"
        )

    startup_state.set_scheduler(
        scheduler_active,
        None if scheduler_active else (
            "SCHEDULER_INACTIVE" if tenant_ready else "TENANT_READINESS_BLOCKED"
        ),
    )
    startup_state.mark_complete()
    logger.info(
        "STARTUP_STATE phase=scheduler status=%s reason=%s",
        "active" if scheduler_active else "inactive",
        "SINGLETON_LEASE_ACQUIRED" if scheduler_active else startup_state.snapshot()["reason_code"],
    )
    logger.info(
        "STARTUP_STATE phase=complete status=%s reason=%s",
        startup_state.snapshot()["status"],
        startup_state.snapshot()["reason_code"],
    )

    yield
    
    # Shutdown scheduler
    if scheduler_active:
        try:
            from app.services.scheduler_service import stop_scheduler
            stop_scheduler()
            logger.info("Embedded background scheduler stopped")
        except Exception as e:
            logger.warning(f"Embedded scheduler stop failed: {e}")
    
    logger.info("Shutting down...")


app = FastAPI(
    title="Vietnamese Social Listening Platform",
    description="Monitor, analyze, and manage brand reputation across social media",
    version="1.0.0",
    lifespan=lifespan,
)


@app.exception_handler(TenantOwnershipError)
async def tenant_ownership_exception_handler(request: Request, exc: TenantOwnershipError):
    if exc.reason in {TenantReason.PARENT_NOT_FOUND, TenantReason.ORPHAN_PARENT}:
        status_code = 404
    elif exc.reason in {
        TenantReason.USER_ORGANIZATION_MISMATCH,
        TenantReason.SCOPE_CONFLICT,
        TenantReason.MULTIPLE_ORGANIZATION_CANDIDATES,
    }:
        status_code = 403
    else:
        status_code = 422
    return JSONResponse(
        status_code=status_code,
        content={"detail": "Tenant ownership validation failed", "reason": exc.reason.value},
    )


@app.middleware("http")
async def security_controls(request: Request, call_next):
    # Browser CORS preflights intentionally carry no bearer token. They must be
    # answered by the outer CORSMiddleware without touching abuse controls.
    if request.method == "OPTIONS":
        return await call_next(request)

    supplied_id = request.headers.get("x-correlation-id", "")
    if supplied_id and re.fullmatch(r"[A-Za-z0-9._-]{1,128}", supplied_id):
        correlation_id = supplied_id
    else:
        correlation_id = str(uuid.uuid4())
    request.state.correlation_id = correlation_id

    readiness_exempt = request.url.path in {
        "/",
        "/health",
        "/readyz",
        "/docs",
        "/openapi.json",
        "/api/auth/login",
        "/api/system/startup-readiness",
    }
    if not readiness_exempt and not startup_state.tenant_workloads_allowed():
        return JSONResponse(
            status_code=503,
            content={
                "detail": {
                    "code": "APPLICATION_NOT_READY",
                    "message": "Tenant workloads are temporarily unavailable.",
                    "correlation_id": correlation_id,
                }
            },
            headers={"X-Correlation-ID": correlation_id},
        )

    scope = classify_rate_limit_scope(request.url.path)
    if scope:
        identities = [client_identity(request)]
        try:
            limiter = get_rate_limiter(request)
            for identity in identities:
                decision = await run_in_threadpool(limiter.check, scope, identity)
                if not decision.allowed:
                    return JSONResponse(
                        status_code=429,
                        content={
                            "detail": {
                                "code": "RATE_LIMIT_EXCEEDED",
                                "message": "Too many requests. Try again later.",
                                "correlation_id": correlation_id,
                            }
                        },
                        headers={
                            "Retry-After": str(decision.retry_after),
                            "X-Correlation-ID": correlation_id,
                        },
                    )
        except (redis.RedisError, RateLimitConfigurationError) as exc:
            logger.error(
                "Rate-limit shared store unavailable correlation_id=%s error=%s",
                correlation_id,
                type(exc).__name__,
            )
            return JSONResponse(
                status_code=503,
                content={
                    "detail": {
                        "code": "RATE_LIMIT_UNAVAILABLE",
                        "message": "Abuse protection is temporarily unavailable.",
                        "correlation_id": correlation_id,
                    }
                },
                headers={"X-Correlation-ID": correlation_id},
            )

    response = await call_next(request)
    response.headers["X-Correlation-ID"] = correlation_id
    return response


cors_origins = settings.cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Accept",
        "Authorization",
        "Cache-Control",
        "Content-Type",
        "Expires",
        "Pragma",
        "X-Correlation-ID",
        "X-Requested-With",
    ],
    expose_headers=["X-Correlation-ID", "Retry-After"],
)


from fastapi.exceptions import HTTPException

# ─── Global exception handler — ensures 500s return JSON + CORS ───────────────
def _add_cors_headers(request: Request, response: JSONResponse) -> JSONResponse:
    origin = request.headers.get("origin")
    if origin and origin in cors_origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    elif "*" in cors_origins:
        response.headers["Access-Control-Allow-Origin"] = "*"
    return response

@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    correlation_id = getattr(request.state, "correlation_id", str(uuid.uuid4()))
    if exc.status_code >= 500:
        logger.error(
            "HTTPException %s on %s %s correlation_id=%s",
            exc.status_code,
            request.method,
            request.url.path,
            correlation_id,
        )
    if exc.status_code == 500:
        detail = {
            "code": "INTERNAL_ERROR",
            "message": "Internal server error.",
            "correlation_id": correlation_id,
        }
    elif isinstance(exc.detail, dict):
        detail = {**exc.detail, "correlation_id": correlation_id}
    else:
        detail = exc.detail
    response = JSONResponse(
        status_code=exc.status_code,
        content={"detail": detail},
        headers={**(exc.headers or {}), "X-Correlation-ID": correlation_id},
    )
    return _add_cors_headers(request, response)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    correlation_id = getattr(request.state, "correlation_id", str(uuid.uuid4()))
    logger.error(
        "Unhandled exception on %s %s correlation_id=%s: %s",
        request.method,
        request.url.path,
        correlation_id,
        traceback.format_exc(),
    )
    response = JSONResponse(
        status_code=500,
        content={
            "detail": {
                "code": "INTERNAL_ERROR",
                "message": "Internal server error.",
                "correlation_id": correlation_id,
            }
        },
        headers={"X-Correlation-ID": correlation_id},
    )
    return _add_cors_headers(request, response)


# ─── Health ───────────────────────────────────────────────────────────────────
def _database_connection_status() -> str:
    db_status = "disconnected"
    db = None
    try:
        db = SessionLocal()
        db.execute(__import__("sqlalchemy").text("SELECT 1"))
        db_status = "connected"
    except Exception:
        db_status = "disconnected"
    finally:
        if db is not None:
            db.close()
    return db_status


@app.get("/health")
def health_check():
    """Liveness check. It remains available while tenant work is blocked."""
    db_status = _database_connection_status()
    state = startup_state.public_snapshot()
    state["database"] = db_status
    state["status"] = "live" if db_status == "connected" else "degraded"
    return state


@app.get("/readyz")
def readiness_check():
    """Bounded readiness check for normal tenant workloads."""
    state = startup_state.public_snapshot()
    state["database"] = _database_connection_status()
    ready = (
        state["database"] == "connected"
        and state["migration"] == "ready"
        and state["tenant_integrity"] == "ready"
    )
    payload = {**state, "status": "ready" if ready else "not_ready"}
    return JSONResponse(status_code=200 if ready else 503, content=payload)


# ─── Debug routes (non-production only) ───────────────────────────────────────
if settings.ENVIRONMENT != "production":
    @app.get(
        "/api/debug/routes",
        dependencies=[Depends(rate_limit_admin_user)],
    )
    def debug_routes(current_user: User = Depends(get_enabled_superuser)):
        return [{"path": r.path, "methods": list(r.methods or [])} for r in app.routes]

    @app.get(
        "/api/debug/db-tables",
        dependencies=[Depends(rate_limit_admin_user)],
    )
    def debug_db_tables(current_user: User = Depends(get_enabled_superuser)):
        from sqlalchemy import inspect as sa_inspect
        inspector = sa_inspect(engine)
        result = {}
        for table in inspector.get_table_names():
            result[table] = [c["name"] for c in inspector.get_columns(table)]
        return result


# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(collectors.router,       prefix="/api/collectors",      tags=["Collectors"], dependencies=[Depends(rate_limit_scan_user)])
app.include_router(auth.router,             prefix="/api/auth",             tags=["Authentication"])
app.include_router(keywords.router,         prefix="/api/keywords",         tags=["Keywords"])
app.include_router(sources.router,          prefix="/api/sources",          tags=["Sources"], dependencies=[Depends(rate_limit_scan_user)])
app.include_router(crawl.router,            prefix="/api/crawl",            tags=["Crawl"], dependencies=[Depends(rate_limit_scan_user)])
app.include_router(mentions.router,         prefix="/api/mentions",         tags=["Mentions"])
app.include_router(alerts.router,           prefix="/api/alerts",           tags=["Alerts"])
app.include_router(incidents.router,        prefix="/api/incidents",        tags=["Incidents"])
app.include_router(reports.router,          prefix="/api/reports",          tags=["Reports"])
app.include_router(dashboard.router,        prefix="/api/dashboard",        tags=["Dashboard"])
app.include_router(takedown.router,         prefix="/api/takedown",         tags=["Legal Response"])
app.include_router(services.router,         prefix="/api/services",         tags=["Services"])
app.include_router(admin.router,            prefix="/api/admin",            tags=["Admin"], dependencies=[Depends(rate_limit_admin_user)])
app.include_router(users.router,            prefix="/api/admin",            tags=["User Management"], dependencies=[Depends(rate_limit_admin_user)])
app.include_router(settings_api.router,     prefix="/api/admin/settings",   tags=["System Settings"], dependencies=[Depends(rate_limit_admin_user)])
app.include_router(roles.router,            prefix="/api/admin/roles",      tags=["Role Management"], dependencies=[Depends(rate_limit_admin_user)])
app.include_router(api_keys.router,         prefix="/api/api-keys",         tags=["API Keys"], dependencies=[Depends(rate_limit_admin_user)])
app.include_router(branding.router,         prefix="/api/branding",         tags=["Branding"], dependencies=[Depends(rate_limit_admin_user)])
app.include_router(audit.router,            prefix="/api/admin/audit",      tags=["Audit Logs"], dependencies=[Depends(rate_limit_admin_user)])
app.include_router(service_requests.router, prefix="/api/service-requests", tags=["Service Requests"])
app.include_router(monitor.router,          prefix="/api/monitor",           tags=["Monitor"], dependencies=[Depends(rate_limit_scan_user)])
app.include_router(system.router,           prefix="/api/system",            tags=["System"])
app.include_router(webinar.router,          prefix="/api/webinar",           tags=["Webinar"])
app.include_router(ai.router,               prefix="/api/ai",                tags=["AI"], dependencies=[Depends(rate_limit_ai_user)])
app.include_router(ai_chat.router,          prefix="/api/ai",                tags=["AI Chat"], dependencies=[Depends(rate_limit_ai_user)])
app.include_router(ai_config.router,        prefix="/api/ai",                tags=["AI Config"], dependencies=[Depends(rate_limit_ai_user)])
app.include_router(evidence.router,         prefix="/api/evidence",          tags=["Evidence Locker"])
app.include_router(competitors.router,      prefix="/api/competitors",       tags=["Competitors"])
app.include_router(influencers.router,      prefix="/api/influencers",       tags=["Influencers"])
app.include_router(reputation.router,       prefix="/api/reputation",        tags=["Reputation Handling"])
app.include_router(discovery.router,        prefix="/api/discovery",         tags=["Auto Discovery"], dependencies=[Depends(rate_limit_scan_user)])
app.include_router(integrations.router,     prefix="/api/integrations",      tags=["Integrations"])
app.include_router(realtime.router,         prefix="/api/realtime",          tags=["Realtime"])
app.include_router(saved_filters.router,    prefix="/api/saved-filters",    tags=["Saved Filters"])
app.include_router(organizations.router,    prefix="/api/organizations",    tags=["Organizations"])
app.include_router(billing.router,          prefix="/api/billing",          tags=["Billing"])

@app.get("/")
def root():
    return {"message": "Vietnamese Social Listening Platform API", "docs": "/docs", "health": "/health"}


from sqlalchemy import text
from app.core.database import get_db
from sqlalchemy.orm import Session
from fastapi import Depends

@app.get(
    "/api/sys/db-stats",
    dependencies=[Depends(rate_limit_admin_user)],
)
def get_db_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
):
    # Count sentiments
    stats = {}
    mentions = db.execute(text("SELECT sentiment, COUNT(*) as count FROM mentions GROUP BY sentiment")).fetchall()
    for row in mentions:
        stats[row[0] if row[0] is not None else "null"] = row[1]
    return {"status": "ok", "stats": stats}

@app.post(
    "/api/sys/run-backfill",
    dependencies=[Depends(rate_limit_admin_user)],
)
def run_prod_backfill(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_enabled_superuser),
):
    try:
        db.execute(text("UPDATE mentions SET sentiment = 'negative' WHERE sentiment IN ('negative_low', 'negative_medium', 'negative_high')"))
        db.execute(text("UPDATE ai_analysis SET sentiment = 'negative' WHERE sentiment IN ('negative_low', 'negative_medium', 'negative_high')"))
        db.execute(text("""
            UPDATE mentions
            SET sentiment = (
                SELECT sentiment FROM ai_analysis 
                WHERE ai_analysis.mention_id = mentions.id
                LIMIT 1
            )
            WHERE sentiment IS NULL OR sentiment = ''
        """))
        db.execute(text("UPDATE mentions SET sentiment = 'neutral' WHERE sentiment IS NULL OR sentiment = ''"))
        db.commit()
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        logger.exception("Production sentiment backfill failed")
        raise HTTPException(
            status_code=500,
            detail={"code": "BACKFILL_FAILED", "message": "Backfill failed."},
        ) from e

@app.post(
    "/api/sys/run-visit-migration",
    dependencies=[Depends(rate_limit_admin_user)],
)
def run_visit_migration(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_enabled_superuser),
):
    try:
        # PostgreSQL syntax for adding columns safely
        db.execute(text("ALTER TABLE mentions ADD COLUMN IF NOT EXISTS is_reviewed BOOLEAN DEFAULT FALSE"))
        db.execute(text("ALTER TABLE mentions ADD COLUMN IF NOT EXISTS visit_count INTEGER DEFAULT 0"))
        db.execute(text("ALTER TABLE mentions ADD COLUMN IF NOT EXISTS last_visited_at TIMESTAMP WITH TIME ZONE NULL"))
        
        # Check if mention_visits exists, if not create it
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS mention_visits (
                id SERIAL PRIMARY KEY,
                mention_id INTEGER NOT NULL,
                user_id INTEGER,
                project_id INTEGER,
                visited_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                original_url TEXT,
                source_type VARCHAR(50),
                user_agent TEXT,
                ip_hash VARCHAR(64)
            )
        """))
        
        db.commit()
        return {"status": "success", "message": "Migration completed successfully"}
    except Exception as e:
        db.rollback()
        # Fallback to SQLite syntax if we are running locally
        try:
            db.execute(text("ALTER TABLE mentions ADD COLUMN is_reviewed BOOLEAN DEFAULT 0"))
        except: pass
        try:
            db.execute(text("ALTER TABLE mentions ADD COLUMN visit_count INTEGER DEFAULT 0"))
        except: pass
        try:
            db.execute(text("ALTER TABLE mentions ADD COLUMN last_visited_at DATETIME NULL"))
        except: pass
        try:
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS mention_visits (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    mention_id INTEGER NOT NULL,
                    user_id INTEGER,
                    project_id INTEGER,
                    visited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    original_url TEXT,
                    source_type VARCHAR(50),
                    user_agent TEXT,
                    ip_hash VARCHAR(64)
                )
            """))
        except: pass
        db.commit()
        return {"status": "partial", "message": "Ran SQLite fallback migration"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
# ─── Debug migration trigger (super-admin only) ───────────────────────────────
@app.post(
    "/api/debug/migrate",
    tags=["Debug"],
    dependencies=[Depends(rate_limit_admin_user)],
)
def debug_migrate(
    current_user: User = Depends(get_enabled_superuser),
):
    """Trigger Alembic upgrade to head. Requires super-admin authentication."""
    import traceback
    import alembic.config
    import alembic.command
    import os
    original_cwd = os.getcwd()
    try:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        os.chdir(base_dir)
        alembic_cfg = alembic.config.Config("alembic.ini")
        alembic.command.upgrade(alembic_cfg, "head")
        return {"status": "success"}
    except Exception as e:
        logger.exception("Debug migration failed")
        raise HTTPException(
            status_code=500,
            detail={"code": "MIGRATION_FAILED", "message": "Migration failed."},
        ) from e
    finally:
        os.chdir(original_cwd)

