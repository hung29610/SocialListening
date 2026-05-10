from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime
from typing import List
from math import ceil

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.report import Report, ReportType, ReportStatus
from app.schemas.report import (
    ReportCreate, ReportResponse, ReportListResponse
)

router = APIRouter()


@router.get("", response_model=ReportListResponse)
async def list_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    report_type: ReportType | None = None,
    status: ReportStatus | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List reports with filtering and pagination"""
    query = select(Report)
    
    if report_type:
        query = query.where(Report.report_type == report_type)
    
    if status:
        query = query.where(Report.status == status)
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(Report.created_at.desc())
    
    result = await db.execute(query)
    reports = result.scalars().all()
    
    total_pages = ceil(total / page_size) if total > 0 else 1
    
    return ReportListResponse(
        items=[ReportResponse.from_orm(r) for r in reports],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.post("", response_model=ReportResponse, status_code=201)
async def create_report(
    report_data: ReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new report (triggers background generation)"""
    report = Report(
        **report_data.dict(),
        generated_by=current_user.id,
        status=ReportStatus.GENERATING
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    
    # Trigger background task to generate report
    from app.workers.tasks import generate_report
    generate_report.delay(report.id)
    
    return ReportResponse.from_orm(report)


@router.get("/{report_id}", response_model=ReportResponse)
async def get_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a report by ID"""
    query = select(Report).where(Report.id == report_id)
    result = await db.execute(query)
    report = result.scalar_one_or_none()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    return ReportResponse.from_orm(report)


@router.delete("/{report_id}", status_code=204)
async def delete_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a report"""
    query = select(Report).where(Report.id == report_id)
    result = await db.execute(query)
    report = result.scalar_one_or_none()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    await db.delete(report)
    await db.commit()


@router.post("/{report_id}/send-email", response_model=ReportResponse)
async def send_report_email(
    report_id: int,
    recipients: str = Query(..., description="Comma-separated email addresses"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Send report via email"""
    query = select(Report).where(Report.id == report_id)
    result = await db.execute(query)
    report = result.scalar_one_or_none()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    if report.status != ReportStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Report is not completed yet")
    
    # Send email
    from app.services.notification_service import notification_service
    
    recipient_list = [email.strip() for email in recipients.split(',')]
    
    email_html = f"""
    <html>
    <body>
        <h2>Báo Cáo Social Listening</h2>
        <p>Xin chào,</p>
        <p>Đính kèm báo cáo <strong>{report.title}</strong></p>
        <p>Thời gian: {report.start_date.strftime('%d/%m/%Y')} - {report.end_date.strftime('%d/%m/%Y')}</p>
        <p>File báo cáo: {report.file_path}</p>
        <p>Trân trọng,<br/>Social Listening Platform</p>
    </body>
    </html>
    """
    
    await notification_service.send_email(
        to_emails=recipient_list,
        subject=f"Báo Cáo: {report.title}",
        body_html=email_html,
        body_text=f"Báo cáo {report.title} đã được tạo. File: {report.file_path}"
    )
    
    report.email_sent = True
    report.email_recipients = recipients
    report.email_sent_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(report)
    
    return ReportResponse.from_orm(report)
