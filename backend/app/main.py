from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import engine, Base
from app.api import (
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
    admin
)
from app.api import service_requests


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    print("🚀 Starting Social Listening Platform...")

    # Create database tables
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables created/verified")
    except Exception as e:
        print(f"⚠️  Database tables may already exist: {e}")

    # Seed service categories and services if empty
    try:
        from app.scripts.seed_services import seed_services_if_empty
        from app.core.database import SessionLocal
        db = SessionLocal()
        try:
            seed_services_if_empty(db)
        finally:
            db.close()
        print("✅ Service seed check complete")
    except Exception as e:
        print(f"⚠️  Service seed skipped: {e}")

    print(f"📡 API running on http://localhost:8000")
    print(f"📚 API docs available at http://localhost:8000/docs")

    yield

    print("👋 Shutting down...")


app = FastAPI(
    title="Vietnamese Social Listening Platform",
    description="Monitor, analyze, and manage brand reputation across social media and news sources",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "social-listening-api"}

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(keywords.router, prefix="/api/keywords", tags=["Keywords"])
app.include_router(sources.router, prefix="/api/sources", tags=["Sources"])
app.include_router(crawl.router, prefix="/api/crawl", tags=["Crawl"])
app.include_router(mentions.router, prefix="/api/mentions", tags=["Mentions"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["Alerts"])
app.include_router(incidents.router, prefix="/api/incidents", tags=["Incidents"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(takedown.router, prefix="/api/takedown", tags=["Legal Response"])
app.include_router(services.router, prefix="/api/services", tags=["Services"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])

# Service Requests on separate prefix to avoid path conflict with /api/services/{service_id}
app.include_router(service_requests.router, prefix="/api/service-requests", tags=["Service Requests"])


@app.get("/")
async def root():
    return {
        "message": "Vietnamese Social Listening Platform API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
