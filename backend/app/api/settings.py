from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_superuser
from app.models.user import User
from app.models.system_settings import OrganizationSettings, EmailSettings, SystemNotificationSettings
from app.schemas.system_settings import (
    OrganizationSettingsResponse, OrganizationSettingsUpdate,
    EmailSettingsResponse, EmailSettingsUpdate,
    SystemNotificationSettingsResponse, SystemNotificationSettingsUpdate
)

router = APIRouter()


# ─── Organization Settings ────────────────────────────────────────────────────

@router.get("/organization", response_model=OrganizationSettingsResponse)
def get_organization_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Get organization settings - Admin only"""
    settings = db.execute(
        select(OrganizationSettings).where(OrganizationSettings.id == 1)
    ).scalar_one_or_none()
    
    if not settings:
        # Create default if not exists
        settings = OrganizationSettings(
            id=1,
            organization_name='Social Listening Platform',
            timezone='Asia/Ho_Chi_Minh',
            language='vi'
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    return OrganizationSettingsResponse.from_orm(settings)


@router.put("/organization", response_model=OrganizationSettingsResponse)
def update_organization_settings(
    settings_data: OrganizationSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Update organization settings - Admin only"""
    settings = db.execute(
        select(OrganizationSettings).where(OrganizationSettings.id == 1)
    ).scalar_one_or_none()
    
    if not settings:
        # Create if not exists
        settings = OrganizationSettings(id=1)
        db.add(settings)
    
    # Update fields
    for field, value in settings_data.dict(exclude_unset=True).items():
        setattr(settings, field, value)
    
    db.commit()
    db.refresh(settings)
    
    return OrganizationSettingsResponse.from_orm(settings)


# ─── Email Settings ───────────────────────────────────────────────────────────

@router.get("/email", response_model=EmailSettingsResponse)
def get_email_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Get email/SMTP settings - Admin only"""
    settings = db.execute(
        select(EmailSettings).where(EmailSettings.id == 1)
    ).scalar_one_or_none()
    
    if not settings:
        # Create default if not exists
        settings = EmailSettings(
            id=1,
            smtp_port=587,
            use_tls=True,
            use_ssl=False,
            is_configured=False
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    return EmailSettingsResponse.from_orm(settings)


@router.put("/email", response_model=EmailSettingsResponse)
def update_email_settings(
    settings_data: EmailSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Update email/SMTP settings - Admin only"""
    settings = db.execute(
        select(EmailSettings).where(EmailSettings.id == 1)
    ).scalar_one_or_none()
    
    if not settings:
        # Create if not exists
        settings = EmailSettings(id=1)
        db.add(settings)
    
    # Update fields
    update_dict = settings_data.dict(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(settings, field, value)
    
    # Mark as configured if all required fields are present
    if settings.smtp_host and settings.smtp_username and settings.from_email:
        settings.is_configured = True
    
    db.commit()
    db.refresh(settings)
    
    return EmailSettingsResponse.from_orm(settings)


@router.post("/email/test")
def test_email_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Test email configuration by sending a test email - Admin only"""
    settings = db.execute(
        select(EmailSettings).where(EmailSettings.id == 1)
    ).scalar_one_or_none()
    
    if not settings or not settings.is_configured:
        raise HTTPException(
            status_code=400,
            detail="Email settings not configured. Please configure SMTP settings first."
        )
    
    # TODO: Implement actual email sending
    # For now, just return success
    return {
        "success": True,
        "message": "Email test functionality not yet implemented. SMTP settings are saved.",
        "smtp_host": settings.smtp_host,
        "smtp_port": settings.smtp_port,
        "from_email": settings.from_email
    }


# ─── System Notification Settings ─────────────────────────────────────────────

@router.get("/notifications", response_model=SystemNotificationSettingsResponse)
def get_system_notification_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Get system notification settings - Admin only"""
    settings = db.execute(
        select(SystemNotificationSettings).where(SystemNotificationSettings.id == 1)
    ).scalar_one_or_none()
    
    if not settings:
        # Create default if not exists
        settings = SystemNotificationSettings(
            id=1,
            system_alerts_enabled=True,
            alert_channels=['email'],
            daily_report_enabled=False,
            daily_report_time='09:00',
            weekly_report_enabled=False,
            weekly_report_day=0,
            weekly_report_time='09:00'
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    return SystemNotificationSettingsResponse.from_orm(settings)


@router.put("/notifications", response_model=SystemNotificationSettingsResponse)
def update_system_notification_settings(
    settings_data: SystemNotificationSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Update system notification settings - Admin only"""
    settings = db.execute(
        select(SystemNotificationSettings).where(SystemNotificationSettings.id == 1)
    ).scalar_one_or_none()
    
    if not settings:
        # Create if not exists
        settings = SystemNotificationSettings(id=1)
        db.add(settings)
    
    # Update fields
    for field, value in settings_data.dict(exclude_unset=True).items():
        setattr(settings, field, value)
    
    db.commit()
    db.refresh(settings)
    
    return SystemNotificationSettingsResponse.from_orm(settings)


@router.post("/notifications/test")
def test_notification_settings(
    channel: str,  # 'telegram', 'slack', 'discord', 'webhook'
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Test notification channel by sending a test message - Admin only"""
    settings = db.execute(
        select(SystemNotificationSettings).where(SystemNotificationSettings.id == 1)
    ).scalar_one_or_none()
    
    if not settings:
        raise HTTPException(status_code=404, detail="Notification settings not found")
    
    # TODO: Implement actual notification sending
    # For now, just return success
    webhook_map = {
        'telegram': settings.telegram_webhook,
        'slack': settings.slack_webhook,
        'discord': settings.discord_webhook,
        'webhook': settings.webhook_url
    }
    
    webhook = webhook_map.get(channel)
    if not webhook:
        raise HTTPException(
            status_code=400,
            detail=f"{channel.capitalize()} webhook not configured"
        )
    
    return {
        "success": True,
        "message": f"{channel.capitalize()} test functionality not yet implemented. Webhook URL is saved.",
        "channel": channel,
        "webhook": webhook[:50] + "..." if len(webhook) > 50 else webhook
    }
