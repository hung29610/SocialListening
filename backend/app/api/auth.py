from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta, datetime
from typing import Optional

from app.core.database import get_db
from app.core.security import (
    verify_password, get_password_hash, create_access_token,
    get_current_active_user
)
from app.core.config import settings
from app.models.user import User
from app.models.user_settings import UserNotificationSettings, UserPreferences, UserSession
from app.schemas.user_settings import (
    NotificationSettingsResponse, NotificationSettingsUpdate,
    UserPreferencesResponse, UserPreferencesUpdate,
    SessionResponse
)
from pydantic import BaseModel, EmailStr
from sqlalchemy import select

router = APIRouter()


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str | None
    is_active: bool
    is_superuser: bool
    role: str | None = "viewer"  # admin, super_admin, viewer, manager, analyst, communication, legal, customer_care
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        orm_mode = True


class Token(BaseModel):
    access_token: str
    token_type: str


@router.post("/register", response_model=UserResponse)
def register(user_data: UserCreate, db = Depends(get_db)):
    """Register a new user"""
    # Check if user exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    user = User(
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        is_active=True,
        is_superuser=False
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return UserResponse.from_orm(user)


@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db = Depends(get_db)
):
    """Login and get access token"""
    # Get user
    user = db.query(User).filter(User.email == form_data.username).first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """Get current user information"""
    return UserResponse.from_orm(current_user)


@router.put("/me/profile")
def update_my_profile(
    profile_data: dict,
    db = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update current user's profile"""
    if "full_name" in profile_data and profile_data["full_name"] is not None:
        current_user.full_name = profile_data["full_name"]
    if "phone" in profile_data and profile_data["phone"] is not None:
        # Note: phone field doesn't exist in User model yet
        pass
    if "department" in profile_data and profile_data["department"] is not None:
        # Note: department field doesn't exist in User model yet
        pass
    
    db.commit()
    db.refresh(current_user)
    
    return {"message": "Profile updated successfully", "user": UserResponse.from_orm(current_user)}


@router.post("/me/change-password")
def change_my_password(
    current_password: str,
    new_password: str,
    confirm_password: str,
    db = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Change current user's password"""
    from app.core.security import verify_password, get_password_hash
    
    # Verify current password
    if not verify_password(current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Verify new password matches confirm
    if new_password != confirm_password:
        raise HTTPException(status_code=400, detail="New passwords do not match")
    
    # Validate new password length
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    
    # Update password
    current_user.hashed_password = get_password_hash(new_password)
    db.commit()
    
    return {"message": "Password changed successfully"}


# ─── Notification Settings Endpoints ──────────────────────────────────────────

@router.get("/me/notification-settings", response_model=NotificationSettingsResponse)
def get_my_notification_settings(
    db = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get current user's notification settings"""
    settings = db.execute(
        select(UserNotificationSettings).where(UserNotificationSettings.user_id == current_user.id)
    ).scalar_one_or_none()
    
    # Create default settings if not exists
    if not settings:
        settings = UserNotificationSettings(user_id=current_user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    return NotificationSettingsResponse.from_orm(settings)


@router.put("/me/notification-settings", response_model=NotificationSettingsResponse)
def update_my_notification_settings(
    settings_data: NotificationSettingsUpdate,
    db = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update current user's notification settings"""
    settings = db.execute(
        select(UserNotificationSettings).where(UserNotificationSettings.user_id == current_user.id)
    ).scalar_one_or_none()
    
    # Create if not exists
    if not settings:
        settings = UserNotificationSettings(user_id=current_user.id)
        db.add(settings)
    
    # Update fields
    for field, value in settings_data.dict(exclude_unset=True).items():
        setattr(settings, field, value)
    
    db.commit()
    db.refresh(settings)
    
    return NotificationSettingsResponse.from_orm(settings)


# ─── User Preferences Endpoints ───────────────────────────────────────────────

@router.get("/me/preferences", response_model=UserPreferencesResponse)
def get_my_preferences(
    db = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get current user's UI preferences"""
    prefs = db.execute(
        select(UserPreferences).where(UserPreferences.user_id == current_user.id)
    ).scalar_one_or_none()
    
    # Create default preferences if not exists
    if not prefs:
        prefs = UserPreferences(user_id=current_user.id)
        db.add(prefs)
        db.commit()
        db.refresh(prefs)
    
    return UserPreferencesResponse.from_orm(prefs)


@router.put("/me/preferences", response_model=UserPreferencesResponse)
def update_my_preferences(
    prefs_data: UserPreferencesUpdate,
    db = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update current user's UI preferences"""
    prefs = db.execute(
        select(UserPreferences).where(UserPreferences.user_id == current_user.id)
    ).scalar_one_or_none()
    
    # Create if not exists
    if not prefs:
        prefs = UserPreferences(user_id=current_user.id)
        db.add(prefs)
    
    # Update fields
    for field, value in prefs_data.dict(exclude_unset=True).items():
        setattr(prefs, field, value)
    
    db.commit()
    db.refresh(prefs)
    
    return UserPreferencesResponse.from_orm(prefs)


# ─── Session Management Endpoints ─────────────────────────────────────────────

@router.get("/me/sessions")
def get_my_sessions(
    db = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get current user's active sessions"""
    # For now, return placeholder data since we don't track JWT sessions yet
    # TODO: Implement proper session tracking when JWT is issued
    return {
        "sessions": [],
        "message": "Session tracking not yet implemented. This feature requires JWT token tracking."
    }


@router.post("/me/logout-other-sessions")
def logout_other_sessions(
    db = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Logout all other sessions except current one"""
    # TODO: Implement session revocation
    # This requires storing JWT JTI and checking it on each request
    return {
        "message": "Session revocation not yet implemented. This feature requires JWT token tracking."
    }

