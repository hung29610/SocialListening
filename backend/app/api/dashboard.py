from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_
from datetime import datetime, timedelta
from typing import List

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.mention import Mention, AIAnalysis, SentimentScore
from app.models.alert import Alert, AlertSeverity
from app.models.incident import Incident, IncidentStatus
from app.models.source import Source

router = APIRouter()


class DashboardMetrics:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


class DashboardResponse:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


@router.get("")
def get_dashboard(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get dashboard metrics"""
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Total mentions
    total_mentions = db.execute(select(func.count(Mention.id))).scalar() or 0
    mentions_today = db.execute(
        select(func.count(Mention.id)).where(Mention.collected_at >= today_start)
    ).scalar() or 0
    
    # Negative mentions (last 30 days)
    month_start = now - timedelta(days=30)
    negative_mentions = db.execute(
        select(func.count(AIAnalysis.id))
        .where(
            and_(
                AIAnalysis.sentiment.in_(['negative_low', 'negative_medium', 'negative_high']),
                AIAnalysis.analyzed_at >= month_start
            )
        )
    ).scalar() or 0
    
    # Alerts
    total_alerts = db.execute(
        select(func.count(Alert.id)).where(Alert.status != 'resolved')
    ).scalar() or 0
    
    # Incidents
    total_incidents = db.execute(
        select(func.count(Incident.id)).where(Incident.status != 'closed')
    ).scalar() or 0
    
    # Sources
    total_sources = db.execute(
        select(func.count(Source.id)).where(Source.is_active == True)
    ).scalar() or 0
    
    # Latest mentions
    latest_mentions_query = select(Mention).order_by(Mention.collected_at.desc()).limit(5)
    latest_mentions = db.execute(latest_mentions_query).scalars().all()
    
    # Latest alerts
    latest_alerts_query = select(Alert).order_by(Alert.created_at.desc()).limit(5)
    latest_alerts = db.execute(latest_alerts_query).scalars().all()
    
    return {
        "metrics": {
            "total_mentions": total_mentions,
            "mentions_today": mentions_today,
            "negative_mentions": negative_mentions,
            "total_alerts": total_alerts,
            "total_incidents": total_incidents,
            "total_sources": total_sources
        },
        "latest_mentions": [
            {
                "id": m.id,
                "title": m.title,
                "content": m.content[:200] if m.content else "",
                "url": m.url,
                "collected_at": m.collected_at.isoformat() if m.collected_at else None
            }
            for m in latest_mentions
        ],
        "latest_alerts": [
            {
                "id": a.id,
                "title": a.title,
                "severity": a.severity,
                "status": a.status,
                "created_at": a.created_at.isoformat() if a.created_at else None
            }
            for a in latest_alerts
        ]
    }
