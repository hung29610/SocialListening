from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.incident import TakedownRequest, TakedownStatus

router = APIRouter()


# â”€â”€â”€ Pydantic Request Schemas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class LegalDraftRequest(BaseModel):
    draft_type: str  # "public_response" | "customer_response" | "correction_request" | "legal_takedown"
    platform: Optional[str] = None
    content_url: Optional[str] = None
    incident_summary: Optional[str] = None
    brand_name: Optional[str] = None
    contact_info: Optional[Dict[str, str]] = None
    additional_context: Optional[str] = None


class TakedownRecordCreate(BaseModel):
    incident_id: int
    platform: str
    content_url: str
    reason: str
    description: str


# â”€â”€â”€ Legal Draft Generation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

DRAFT_TEMPLATES = {
    "public_response": """PHáº¢N Há»’I CÃ”NG KHAI

KÃ­nh gá»­i QuÃ½ khÃ¡ch hÃ ng vÃ  cÃ´ng chÃºng,

ChÃºng tÃ´i Ä‘Ã£ nháº­n Ä‘Æ°á»£c thÃ´ng tin vá» sá»± viá»‡c liÃªn quan Ä‘áº¿n {brand_name}.
{incident_summary}

ChÃºng tÃ´i xin kháº³ng Ä‘á»‹nh ráº±ng chÃºng tÃ´i luÃ´n cam káº¿t tuÃ¢n thá»§ phÃ¡p luáº­t vÃ  Ä‘áº¡o Ä‘á»©c kinh doanh.
ChÃºng tÃ´i Ä‘ang kháº©n trÆ°Æ¡ng xem xÃ©t vÃ  xá»­ lÃ½ vá»¥ viá»‡c theo Ä‘Ãºng quy trÃ¬nh.

Má»i tháº¯c máº¯c, vui lÃ²ng liÃªn há»‡: {contact}

TrÃ¢n trá»ng,
{brand_name}
NgÃ y: {date}""",

    "customer_response": """PHáº¢N Há»’I RIÃŠNG CHO KHÃCH HÃ€NG

KÃ­nh gá»­i QuÃ½ khÃ¡ch,

Cáº£m Æ¡n QuÃ½ khÃ¡ch Ä‘Ã£ liÃªn há»‡ vá»›i chÃºng tÃ´i vá» váº¥n Ä‘á»: {incident_summary}

ChÃºng tÃ´i Ä‘Ã£ nháº­n Ä‘Æ°á»£c pháº£n Ã¡nh cá»§a QuÃ½ khÃ¡ch vÃ  cam káº¿t:
1. Xem xÃ©t ká»¹ lÆ°á»¡ng vá»¥ viá»‡c trong vÃ²ng 48 giá» lÃ m viá»‡c
2. ThÃ´ng bÃ¡o káº¿t quáº£ xá»­ lÃ½ Ä‘áº¿n QuÃ½ khÃ¡ch
3. Thá»±c hiá»‡n cÃ¡c biá»‡n phÃ¡p kháº¯c phá»¥c cáº§n thiáº¿t

Má»i tháº¯c máº¯c, vui lÃ²ng liÃªn há»‡: {contact}

TrÃ¢n trá»ng,
{brand_name}""",

    "correction_request": """YÃŠU Cáº¦U ÄÃNH CHÃNH THÃ”NG TIN

KÃ­nh gá»­i: Ban BiÃªn táº­p / Quáº£n trá»‹ viÃªn {platform}

ChÃºng tÃ´i lÃ  Ä‘áº¡i diá»‡n cá»§a {brand_name} xin kÃ­nh Ä‘á» nghá»‹ quÃ½ vá»‹ xem xÃ©t Ä‘Ã­nh chÃ­nh thÃ´ng tin táº¡i:
URL: {content_url}

LÃ½ do yÃªu cáº§u Ä‘Ã­nh chÃ­nh:
{incident_summary}

ThÃ´ng tin Ä‘Ã­nh chÃ­nh Ä‘á» xuáº¥t:
[Vui lÃ²ng bá»• sung ná»™i dung Ä‘Ã­nh chÃ­nh cá»¥ thá»ƒ]

CÆ¡ sá»Ÿ phÃ¡p lÃ½:
- Luáº­t An ninh máº¡ng 2018
- Luáº­t BÃ¡o chÃ­ 2016

KÃ­nh Ä‘á» nghá»‹ quÃ½ vá»‹ xem xÃ©t vÃ  pháº£n há»“i trong vÃ²ng 7 ngÃ y lÃ m viá»‡c.

TrÃ¢n trá»ng,
{brand_name}
NgÃ y: {date}
LiÃªn há»‡: {contact}""",

    "legal_takedown": """YÃŠU Cáº¦U Gá»  Bá»Ž Ná»˜I DUNG VI PHáº M PHÃP LUáº¬T

KÃ­nh gá»­i: Quáº£n trá»‹ viÃªn ná»n táº£ng {platform}

ChÃºng tÃ´i, Ä‘áº¡i diá»‡n há»£p phÃ¡p cá»§a {brand_name}, trÃ¢n trá»ng yÃªu cáº§u quÃ½ ná»n táº£ng gá»¡ bá» ná»™i dung vi pháº¡m sau:

URL vi pháº¡m: {content_url}

MÃ´ táº£ vi pháº¡m:
{incident_summary}

CÄƒn cá»© phÃ¡p lÃ½:
- Luáº­t An ninh máº¡ng 2018 (Äiá»u 8, 16, 17)
- Bá»™ luáº­t DÃ¢n sá»± 2015 (Äiá»u 34 - Quyá»n Ä‘Æ°á»£c báº£o vá»‡ danh dá»±)
- Luáº­t Sá»Ÿ há»¯u trÃ­ tuá»‡ 2005 (sá»­a Ä‘á»•i 2022)

ChÃºng tÃ´i xÃ¡c nháº­n ráº±ng thÃ´ng tin trong yÃªu cáº§u nÃ y lÃ  Ä‘Ãºng sá»± tháº­t.
Náº¿u cáº§n thÃªm thÃ´ng tin, vui lÃ²ng liÃªn há»‡: {contact}

YÃªu cáº§u xá»­ lÃ½ trong vÃ²ng 48 giá».

TrÃ¢n trá»ng,
{brand_name}
NgÃ y: {date}"""
}


@router.post("/generate-draft")
def generate_legal_draft(
    request: LegalDraftRequest,
    current_user: User = Depends(get_current_active_user)
):
    """Generate a legal response draft document"""
    draft_type = request.draft_type

    if draft_type not in DRAFT_TEMPLATES:
        raise HTTPException(
            status_code=400,
            detail=f"Loáº¡i draft khÃ´ng há»£p lá»‡. Cho phÃ©p: {list(DRAFT_TEMPLATES.keys())}"
        )

    template = DRAFT_TEMPLATES[draft_type]

    contact = ""
    if request.contact_info:
        parts = []
        if request.contact_info.get("email"):
            parts.append(f"Email: {request.contact_info['email']}")
        if request.contact_info.get("phone"):
            parts.append(f"ÄT: {request.contact_info['phone']}")
        contact = " | ".join(parts)

    draft_content = template.format(
        brand_name=request.brand_name or "[TÃŠN THÆ¯Æ NG HIá»†U]",
        platform=request.platform or "[Ná»€N Táº¢NG]",
        content_url=request.content_url or "[URL Ná»˜I DUNG]",
        incident_summary=request.incident_summary or "[TÃ“M Táº®T Sá»° Cá»]",
        contact=contact or "[THÃ”NG TIN LIÃŠN Há»†]",
        date=datetime.now().strftime("%d/%m/%Y"),
        additional_context=request.additional_context or ""
    )

    return {
        "draft_type": draft_type,
        "content": draft_content,
        "generated_at": datetime.utcnow().isoformat(),
        "note": "ÄÃ¢y lÃ  báº£n draft cáº§n Ä‘Æ°á»£c luáº­t sÆ° hoáº·c ngÆ°á»i cÃ³ tháº©m quyá»n xem xÃ©t trÆ°á»›c khi sá»­ dá»¥ng."
    }


# â”€â”€â”€ Takedown Record Management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@router.post("/records", status_code=201)
def create_takedown_record(
    data: TakedownRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a takedown request record (legal workflow only)"""
    from app.models.incident import Incident
    incident = db.execute(
        select(Incident).where(Incident.id == data.incident_id)
    ).scalar_one_or_none()

    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    record = TakedownRequest(
        incident_id=data.incident_id,
        platform=data.platform,
        content_url=data.content_url,
        reason=data.reason,
        description=data.description,
        status=TakedownStatus.SUBMITTED,
        submitted_by=current_user.id
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "id": record.id,
        "incident_id": record.incident_id,
        "platform": record.platform,
        "content_url": record.content_url,
        "status": record.status,
        "created_at": record.created_at.isoformat() if record.created_at else None
    }


@router.get("/records")
def list_takedown_records(
    incident_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List takedown request records"""
    query = select(TakedownRequest)
    if incident_id:
        query = query.where(TakedownRequest.incident_id == incident_id)
    query = query.order_by(TakedownRequest.created_at.desc())

    records = db.execute(query).scalars().all()

    return [
        {
            "id": r.id,
            "incident_id": r.incident_id,
            "platform": r.platform,
            "content_url": r.content_url,
            "reason": r.reason,
            "status": r.status,
            "submitted_by": r.submitted_by,
            "created_at": r.created_at.isoformat() if r.created_at else None
        }
        for r in records
    ]


@router.put("/records/{record_id}/status")
def update_takedown_status(
    record_id: int,
    status: str = Body(..., embed=True),
    platform_response: str = Body(None, embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update takedown record status"""
    record = db.execute(
        select(TakedownRequest).where(TakedownRequest.id == record_id)
    ).scalar_one_or_none()

    if not record:
        raise HTTPException(status_code=404, detail="Takedown record not found")

    allowed_statuses = [s.value for s in TakedownStatus]
    if status not in allowed_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {allowed_statuses}")

    record.status = status
    if platform_response:
        record.platform_response = platform_response

    db.commit()
    db.refresh(record)

    return {"id": record.id, "status": record.status}

