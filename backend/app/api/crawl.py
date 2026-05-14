from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from typing import List, Optional
from datetime import datetime
import hashlib
import requests
from bs4 import BeautifulSoup
import feedparser
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.source import Source
from app.models.keyword import Keyword, KeywordGroup
from app.models.mention import Mention, AIAnalysis, SentimentScore
from app.models.alert import Alert, AlertSeverity, AlertStatus
from app.services.ai_service import analyze_mention_with_dummy_ai

router = APIRouter()


class ManualScanRequest(BaseModel):
    keyword_group_ids: List[int]
    source_ids: Optional[List[int]] = None
    url: Optional[str] = None


@router.post("/manual-scan")
def manual_scan(
    body: ManualScanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Manual scan: User selects keyword groups and either:
    - Selects existing sources, OR
    - Enters a custom URL to scan
    """
    
    # Get keyword groups and keywords
    keyword_groups = db.execute(
        select(KeywordGroup).where(KeywordGroup.id.in_(body.keyword_group_ids))
    ).scalars().all()

    if not keyword_groups:
        raise HTTPException(status_code=404, detail="KhÃ´ng tÃ¬m tháº¥y nhÃ³m tá»« khÃ³a")

    # Get all keywords from these groups
    all_keywords = []
    for group in keyword_groups:
        keywords = db.execute(
            select(Keyword).where(Keyword.group_id == group.id, Keyword.is_active == True)
        ).scalars().all()
        all_keywords.extend(keywords)

    if not all_keywords:
        raise HTTPException(status_code=400, detail="KhÃ´ng cÃ³ tá»« khÃ³a hoáº¡t Ä‘á»™ng trong nhÃ³m Ä‘Ã£ chá»n")

    keyword_texts = [kw.keyword.lower() for kw in all_keywords]

    # Determine sources to scan
    sources_to_scan = []

    if body.url:
        temp_source = Source(
            name=f"Manual scan: {body.url}",
            url=body.url,
            source_type="website",
            is_active=True
        )
        db.add(temp_source)
        db.commit()
        db.refresh(temp_source)
        sources_to_scan.append(temp_source)
    elif body.source_ids:
        sources_to_scan = db.execute(
            select(Source).where(Source.id.in_(body.source_ids), Source.is_active == True)
        ).scalars().all()
    else:
        raise HTTPException(status_code=400, detail="Pháº£i cung cáº¥p source_ids hoáº·c url")

    if not sources_to_scan:
        raise HTTPException(status_code=404, detail="KhÃ´ng tÃ¬m tháº¥y nguá»“n hoáº¡t Ä‘á»™ng")
    
    # Scan each source
    total_mentions = 0
    new_mentions = []
    
    for source in sources_to_scan:
        try:
            # Crawl the source
            mentions = crawl_source(source, keyword_texts, all_keywords, db)
            
            for mention_data in mentions:
                # Check if mention already exists (by content hash)
                content_hash = hashlib.sha256(mention_data['content'].encode()).hexdigest()
                
                existing = db.execute(
                    select(Mention).where(Mention.content_hash == content_hash)
                ).scalar_one_or_none()
                
                if existing:
                    continue
                
                # Create mention
                mention = Mention(
                    source_id=source.id,
                    title=mention_data.get('title'),
                    content=mention_data['content'],
                    content_hash=content_hash,
                    url=mention_data['url'],
                    author=mention_data.get('author'),
                    published_at=mention_data.get('published_at'),
                    matched_keywords=mention_data.get('matched_keywords', [])
                )
                db.add(mention)
                db.commit()
                db.refresh(mention)
                
                # AI Analysis
                analysis_result = analyze_mention_with_dummy_ai(mention.content, mention.title)
                
                ai_analysis = AIAnalysis(
                    mention_id=mention.id,
                    sentiment=analysis_result['sentiment'],
                    risk_score=analysis_result['risk_score'],
                    crisis_level=analysis_result['crisis_level'],
                    summary_vi=analysis_result['summary_vi'],
                    suggested_action=analysis_result['suggested_action'],
                    responsible_department=analysis_result['responsible_department'],
                    confidence_score=analysis_result['confidence_score'],
                    ai_provider="dummy_ai",
                    model_version="1.0",
                    processing_time_ms=analysis_result['processing_time_ms']
                )
                db.add(ai_analysis)
                db.commit()
                
                # Create alert if high risk
                if analysis_result['risk_score'] >= 70:
                    severity = AlertSeverity.CRITICAL if analysis_result['risk_score'] >= 85 else AlertSeverity.HIGH
                    
                    alert = Alert(
                        mention_id=mention.id,
                        severity=severity,
                        status=AlertStatus.NEW,
                        title=f"High risk mention detected: {mention.title or 'No title'}",
                        message=f"Risk score: {analysis_result['risk_score']}, Crisis level: {analysis_result['crisis_level']}"
                    )
                    db.add(alert)
                    db.commit()
                
                new_mentions.append(mention.id)
                total_mentions += 1
            
            # Update source last crawled
            source.last_crawled_at = datetime.utcnow()
            source.last_success_at = datetime.utcnow()
            source.crawl_count = (source.crawl_count or 0) + 1
            db.commit()
            
        except Exception as e:
            # Update source with error
            source.last_error = str(e)
            source.error_count = (source.error_count or 0) + 1
            db.commit()
            continue
    
    return {
        "success": True,
        "total_mentions_found": total_mentions,
        "new_mention_ids": new_mentions,
        "sources_scanned": len(sources_to_scan),
        "message": f"Scan completed. Found {total_mentions} new mentions."
    }


def crawl_source(source: Source, keyword_texts: List[str], keywords: List[Keyword], db: Session) -> List[dict]:
    """Crawl a source and extract mentions matching keywords"""
    mentions = []
    
    try:
        # Try RSS first
        if source.source_type == 'rss' or 'rss' in source.url.lower() or 'feed' in source.url.lower():
            feed = feedparser.parse(source.url)
            
            for entry in feed.entries[:20]:  # Limit to 20 entries
                title = entry.get('title', '')
                content = entry.get('summary', '') or entry.get('description', '')
                full_text = f"{title} {content}".lower()
                
                # Check if any keyword matches
                matched = []
                for i, kw_text in enumerate(keyword_texts):
                    if kw_text in full_text:
                        matched.append({
                            'keyword_id': keywords[i].id,
                            'keyword': keywords[i].keyword
                        })
                
                if matched:
                    mentions.append({
                        'title': title,
                        'content': content[:5000],  # Limit content length
                        'url': entry.get('link', source.url),
                        'author': entry.get('author'),
                        'published_at': datetime(*entry.published_parsed[:6]) if hasattr(entry, 'published_parsed') else None,
                        'matched_keywords': matched
                    })
        
        # Try regular web scraping
        else:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            response = requests.get(source.url, headers=headers, timeout=30)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Remove script and style elements
            for script in soup(["script", "style"]):
                script.decompose()
            
            # Get text
            text = soup.get_text()
            lines = (line.strip() for line in text.splitlines())
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            text = ' '.join(chunk for chunk in chunks if chunk)
            
            text_lower = text.lower()
            
            # Check if any keyword matches
            matched = []
            for i, kw_text in enumerate(keyword_texts):
                if kw_text in text_lower:
                    matched.append({
                        'keyword_id': keywords[i].id,
                        'keyword': keywords[i].keyword
                    })
            
            if matched:
                # Try to extract title
                title = soup.find('title')
                title_text = title.string if title else source.name
                
                mentions.append({
                    'title': title_text,
                    'content': text[:5000],  # Limit content length
                    'url': source.url,
                    'author': None,
                    'published_at': datetime.utcnow(),
                    'matched_keywords': matched
                })
    
    except Exception as e:
        print(f"Error crawling {source.url}: {str(e)}")
        raise
    
    return mentions


@router.get("/scan-history")
def get_scan_history(
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get scan history (recent mentions)"""
    from math import ceil
    
    total = db.execute(select(func.count(Mention.id))).scalar()
    
    offset = (page - 1) * page_size
    mentions = db.execute(
        select(Mention)
        .order_by(Mention.collected_at.desc())
        .offset(offset)
        .limit(page_size)
    ).scalars().all()
    
    return {
        "items": [
            {
                "id": m.id,
                "title": m.title,
                "url": m.url,
                "source_id": m.source_id,
                "collected_at": m.collected_at.isoformat() if m.collected_at else None,
                "matched_keywords": m.matched_keywords
            }
            for m in mentions
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": ceil(total / page_size) if total > 0 else 1
    }


@router.get("/scheduler/status")
def get_scheduler_status(
    current_user: User = Depends(get_current_active_user)
):
    """Get background scheduler status"""
    from app.services.scheduler_service import get_scheduler_status
    return get_scheduler_status()


@router.get("/jobs")
def get_crawl_jobs(
    page: int = 1,
    page_size: int = 20,
    source_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get crawl job history"""
    from app.models.crawl import CrawlJob
    from math import ceil
    
    query = select(CrawlJob)
    
    if source_id:
        query = query.where(CrawlJob.source_id == source_id)
    
    if status:
        query = query.where(CrawlJob.status == status)
    
    total = db.execute(select(func.count()).select_from(query.subquery())).scalar() or 0
    
    offset = (page - 1) * page_size
    jobs = db.execute(
        query.order_by(CrawlJob.scheduled_at.desc())
        .offset(offset)
        .limit(page_size)
    ).scalars().all()
    
    return {
        "items": [
            {
                "id": j.id,
                "source_id": j.source_id,
                "status": j.status.value if hasattr(j.status, 'value') else j.status,
                "is_manual": j.is_manual,
                "scheduled_at": j.scheduled_at.isoformat() if j.scheduled_at else None,
                "started_at": j.started_at.isoformat() if j.started_at else None,
                "completed_at": j.completed_at.isoformat() if j.completed_at else None,
                "mentions_found": j.mentions_found,
                "mentions_new": j.mentions_new,
                "error_message": j.error_message
            }
            for j in jobs
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": ceil(total / page_size) if total > 0 else 1
    }
