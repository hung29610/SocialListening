from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_superuser, get_current_user
from app.models.user import User
from app.models.rbac import BrandingSettings
from app.schemas.rbac import BrandingSettingsResponse, BrandingSettingsUpdate

router = APIRouter()


# ─── Branding Settings ────────────────────────────────────────────────────────

@router.get("/", response_model=BrandingSettingsResponse)
def get_branding_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)  # Any authenticated user can read
):
    """Get branding settings - Available to all authenticated users"""
    settings = db.execute(
        select(BrandingSettings).where(BrandingSettings.id == 1)
    ).scalar_one_or_none()
    
    if not settings:
        # Create default if not exists
        settings = BrandingSettings(
            id=1,
            primary_color='#3B82F6',
            secondary_color='#10B981'
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    return BrandingSettingsResponse.from_orm(settings)


@router.put("/", response_model=BrandingSettingsResponse)
def update_branding_settings(
    settings_data: BrandingSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)  # Admin only for updates
):
    """Update branding settings - Admin only"""
    settings = db.execute(
        select(BrandingSettings).where(BrandingSettings.id == 1)
    ).scalar_one_or_none()
    
    if not settings:
        # Create if not exists
        settings = BrandingSettings(id=1)
        db.add(settings)
    
    # Update fields
    for field, value in settings_data.dict(exclude_unset=True).items():
        setattr(settings, field, value)
    
    db.commit()
    db.refresh(settings)
    
    return BrandingSettingsResponse.from_orm(settings)


@router.post("/reset", response_model=BrandingSettingsResponse)
def reset_branding_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Reset branding to default values - Admin only"""
    settings = db.execute(
        select(BrandingSettings).where(BrandingSettings.id == 1)
    ).scalar_one_or_none()
    
    if not settings:
        settings = BrandingSettings(id=1)
        db.add(settings)
    
    # Reset to defaults
    settings.primary_color = '#3B82F6'
    settings.secondary_color = '#10B981'
    settings.logo_light_url = None
    settings.logo_dark_url = None
    settings.favicon_url = None
    settings.login_background_url = None
    settings.custom_css = None
    
    db.commit()
    db.refresh(settings)
    
    return BrandingSettingsResponse.from_orm(settings)
