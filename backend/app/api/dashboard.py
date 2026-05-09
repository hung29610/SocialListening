from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
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
from app.schemas.report import (
    DashboardResponse, DashboardMetrics, SentimentDistribution, RiskDistribution,
    MentionTrend, TopRiskySource, TopRiskyMention
)

router = APIRouter()


@router.get("", response_model=DashboardResponse)
async def get_dashboard(
    days: int = Query(30, ge=1, le=365, description="Number of days to include in trends"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get dashboard metrics and visualizations"""
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=7)
    month_start = now - timedelta(days=30)
    trend_start = now - timedelta(days=days)
    
    # Metrics
    # Total mentions
    mentions_today_query = select(func.count(Mention.id)).where(Mention.collected_at >= today_start)
    mentions_week_query = select(func.count(Mention.id)).where(Mention.collected_at >= week_start)
    mentions_month_query = select(func.count(Mention.id)).where(Mention.collected_at >= month_start)
    
    mentions_today = (await db.execute(mentions_today_query)).scalar()
    mentions_week = (await db.execute(mentions_week_query)).scalar()
    mentions_month = (await db.execute(mentions_month_query)).scalar()
    
    # Open incidents
    open_incidents_query = select(func.count(Incident.id)).where(
        Incident.status.in_([IncidentStatus.NEW, IncidentStatus.VERIFYING, IncidentStatus.RESPONDING])
    )
    open_incidents = (await db.execute(open_incidents_query)).scalar()
    
    # Overdue incidents
    overdue_incidents_query = select(func.count(Incident.id)).where(Incident.is_overdue == True)
    overdue_incidents = (await db.execute(overdue_incidents_query)).scalar()
    
    # Critical and high alerts
    critical_alerts_query = select(func.count(Alert.id)).where(
        and_(Alert.severity == AlertSeverity.CRITICAL, Alert.status != "resolved")
    )
    high_alerts_query = select(func.count(Alert.id)).where(
        and_(Alert.severity == AlertSeverity.HIGH, Alert.status != "resolved")
    )
    
    critical_alerts = (await db.execute(critical_alerts_query)).scalar()
    high_alerts = (await db.execute(high_alerts_query)).scalar()
    
    # Average risk score
    avg_risk_query = select(func.avg(AIAnalysis.risk_score)).where(
        AIAnalysis.analyzed_at >= month_start
    )
    avg_risk = (await db.execute(avg_risk_query)).scalar() or 0.0
    
    metrics = DashboardMetrics(
        total_mentions_today=mentions_today,
        total_mentions_week=mentions_week,
        total_mentions_month=mentions_month,
        open_incidents=open_incidents,
        overdue_incidents=overdue_incidents,
        critical_alerts=critical_alerts,
        high_alerts=high_alerts,
        avg_risk_score=round(avg_risk, 2)
    )
    
    # Sentiment Distribution
    sentiment_query = select(
        AIAnalysis.sentiment,
        func.count(AIAnalysis.id)
    ).where(
        AIAnalysis.analyzed_at >= month_start
    ).group_by(AIAnalysis.sentiment)
    
    sentiment_result = await db.execute(sentiment_query)
    sentiment_data = dict(sentiment_result.all())
    
    sentiment_distribution = SentimentDistribution(
        positive=sentiment_data.get(SentimentScore.POSITIVE, 0),
        neutral=sentiment_data.get(SentimentScore.NEUTRAL, 0),
        negative_low=sentiment_data.get(SentimentScore.NEGATIVE_LOW, 0),
        negative_medium=sentiment_data.get(SentimentScore.NEGATIVE_MEDIUM, 0),
        negative_high=sentiment_data.get(SentimentScore.NEGATIVE_HIGH, 0)
    )
    
    # Risk Distribution
    risk_query = select(
        func.case(
            (AIAnalysis.risk_score <= 25, "low"),
            (AIAnalysis.risk_score <= 50, "medium"),
            (AIAnalysis.risk_score <= 75, "high"),
            else_="critical"
        ).label("risk_level"),
        func.count(AIAnalysis.id)
    ).where(
        AIAnalysis.analyzed_at >= month_start
    ).group_by("risk_level")
    
    risk_result = await db.execute(risk_query)
    risk_data = dict(risk_result.all())
    
    risk_distribution = RiskDistribution(
        low=risk_data.get("low", 0),
        medium=risk_data.get("medium", 0),
        high=risk_data.get("high", 0),
        critical=risk_data.get("critical", 0)
    )
    
    # Mention Trends with sentiment breakdown
    trends_query = select(
        func.date(Mention.collected_at).label("date"),
        func.count(Mention.id).label("count"),
        func.sum(
            func.case(
                (AIAnalysis.sentiment == SentimentScore.POSITIVE, 1),
                else_=0
            )
        ).label("positive"),
        func.sum(
            func.case(
                (AIAnalysis.sentiment == SentimentScore.NEUTRAL, 1),
                else_=0
            )
        ).label("neutral"),
        func.sum(
            func.case(
                (AIAnalysis.sentiment.in_([
                    SentimentScore.NEGATIVE_LOW,
                    SentimentScore.NEGATIVE_MEDIUM,
                    SentimentScore.NEGATIVE_HIGH
                ]), 1),
                else_=0
            )
        ).label("negative")
    ).join(
        AIAnalysis, AIAnalysis.mention_id == Mention.id, isouter=True
    ).where(
        Mention.collected_at >= trend_start
    ).group_by(func.date(Mention.collected_at)).order_by(func.date(Mention.collected_at))
    
    trends_result = await db.execute(trends_query)
    trends_data = trends_result.all()
    
    mention_trends = [
        MentionTrend(
            date=str(row.date),
            count=row.count,
            positive=row.positive or 0,
            neutral=row.neutral or 0,
            negative=row.negative or 0
        )
        for row in trends_data
    ]
    
    # Top Risky Sources
    top_sources_query = select(
        Source.id,
        Source.name,
        func.count(Mention.id).label("mention_count"),
        func.avg(AIAnalysis.risk_score).label("avg_risk")
    ).join(
        Mention, Mention.source_id == Source.id
    ).join(
        AIAnalysis, AIAnalysis.mention_id == Mention.id
    ).where(
        Mention.collected_at >= month_start
    ).group_by(
        Source.id, Source.name
    ).order_by(
        func.avg(AIAnalysis.risk_score).desc()
    ).limit(10)
    
    top_sources_result = await db.execute(top_sources_query)
    top_sources_data = top_sources_result.all()
    
    top_risky_sources = [
        TopRiskySource(
            source_id=row.id,
            source_name=row.name,
            mention_count=row.mention_count,
            avg_risk_score=round(row.avg_risk, 2)
        )
        for row in top_sources_data
    ]
    
    # Top Risky Mentions
    top_mentions_query = select(
        Mention.id,
        Mention.title,
        Mention.content,
        Mention.published_at,
        AIAnalysis.risk_score,
        AIAnalysis.crisis_level
    ).join(
        AIAnalysis, AIAnalysis.mention_id == Mention.id
    ).where(
        Mention.collected_at >= month_start
    ).order_by(
        AIAnalysis.risk_score.desc()
    ).limit(10)
    
    top_mentions_result = await db.execute(top_mentions_query)
    top_mentions_data = top_mentions_result.all()
    
    top_risky_mentions = [
        TopRiskyMention(
            mention_id=row.id,
            title=row.title,
            content_snippet=row.content[:200] if row.content else "",
            risk_score=row.risk_score,
            crisis_level=row.crisis_level,
            published_at=row.published_at
        )
        for row in top_mentions_data
    ]
    
    return DashboardResponse(
        metrics=metrics,
        sentiment_distribution=sentiment_distribution,
        risk_distribution=risk_distribution,
        mention_trends=mention_trends,
        top_risky_sources=top_risky_sources,
        top_risky_mentions=top_risky_mentions
    )
