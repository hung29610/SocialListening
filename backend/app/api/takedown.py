from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.incident import TakedownRequest, TakedownStatus, TakedownPlatform as DBTakedownPlatform
from app.services.takedown_service import takedown_service, TakedownPlatform, TakedownReason

router = APIRouter()


class FacebookReportRequest(BaseModel):
    post_url: str
    reason: TakedownReason
    description: str
    evidence_urls: List[str] = []


class YouTubeReportRequest(BaseModel):
    video_url: str
    reason: TakedownReason
    description: str
    timestamp: str | None = None


class GoogleDMCARequest(BaseModel):
    infringing_url: str
    original_url: str
    description: str
    contact_info: Dict[str, str]


class LegalRequestData(BaseModel):
    platform: str
    content_url: str
    reason: TakedownReason
    legal_basis: str
    evidence: List[str]
    lawyer_info: Dict[str, str]


class MassReportRequest(BaseModel):
    content_url: str
    platform: TakedownPlatform
    reason: TakedownReason
    reporter_accounts: List[Dict[str, str]]


@router.post("/facebook/report")
async def report_facebook_content(
    request: FacebookReportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Submit content report to Facebook"""
    result = await takedown_service.submit_facebook_report(
        post_url=request.post_url,
        reason=request.reason,
        description=request.description,
        evidence_urls=request.evidence_urls
    )
    
    return result


@router.post("/youtube/report")
async def report_youtube_content(
    request: YouTubeReportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Submit content report to YouTube"""
    result = await takedown_service.submit_youtube_report(
        video_url=request.video_url,
        reason=request.reason,
        description=request.description,
        timestamp=request.timestamp
    )
    
    return result


@router.post("/google/dmca")
async def submit_google_dmca(
    request: GoogleDMCARequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Submit DMCA takedown to Google"""
    result = await takedown_service.submit_google_dmca(
        infringing_url=request.infringing_url,
        original_url=request.original_url,
        description=request.description,
        contact_info=request.contact_info
    )
    
    return result


@router.post("/legal/prepare")
async def prepare_legal_request(
    request: LegalRequestData,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Prepare legal takedown request package"""
    result = await takedown_service.submit_legal_request(
        platform=request.platform,
        content_url=request.content_url,
        reason=request.reason,
        legal_basis=request.legal_basis,
        evidence=request.evidence,
        lawyer_info=request.lawyer_info
    )
    
    return result


@router.post("/mass-report")
async def mass_report_content(
    request: MassReportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Coordinate mass reporting from multiple accounts
    
    WARNING: Use responsibly and only for legitimate violations
    """
    result = await takedown_service.mass_report_content(
        content_url=request.content_url,
        platform=request.platform,
        reason=request.reason,
        reporter_accounts=request.reporter_accounts
    )
    
    return result


@router.get("/status/{platform}/{content_url:path}")
async def check_takedown_status(
    platform: str,
    content_url: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Check if content has been taken down"""
    try:
        platform_enum = TakedownPlatform(platform)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid platform: {platform}")
    
    result = await takedown_service.monitor_takedown_status(
        platform=platform_enum,
        content_url=content_url
    )
    
    return result


@router.post("/incident/{incident_id}/submit-takedown")
async def submit_incident_takedown(
    incident_id: int,
    platform: str = Body(...),
    reason: str = Body(...),
    description: str = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Submit takedown request for an incident"""
    from app.models.incident import Incident
    
    # Get incident
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    incident = result.scalar_one_or_none()
    
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    # Get mention URL
    from app.models.mention import Mention
    result = await db.execute(select(Mention).where(Mention.id == incident.mention_id))
    mention = result.scalar_one_or_none()
    
    if not mention:
        raise HTTPException(status_code=404, detail="Mention not found")
    
    # Create takedown request record
    takedown_request = TakedownRequest(
        incident_id=incident_id,
        platform=platform,
        content_url=mention.url,
        reason=reason,
        description=description,
        status=TakedownStatus.SUBMITTED,
        submitted_by=current_user.id
    )
    
    db.add(takedown_request)
    await db.commit()
    await db.refresh(takedown_request)
    
    # Submit to platform based on type
    if platform == "facebook":
        result = await takedown_service.submit_facebook_report(
            post_url=mention.url,
            reason=TakedownReason(reason),
            description=description
        )
    elif platform == "youtube":
        result = await takedown_service.submit_youtube_report(
            video_url=mention.url,
            reason=TakedownReason(reason),
            description=description
        )
    else:
        result = {
            "success": False,
            "note": "Platform not supported for automated submission",
            "manual_action_required": True
        }
    
    return {
        "takedown_request_id": takedown_request.id,
        "submission_result": result
    }
