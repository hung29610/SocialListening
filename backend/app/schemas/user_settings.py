from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


# Notification Settings Schemas
class NotificationSettingsBase(BaseModel):
    email_notifications: bool = True
    in_app_notifications: bool = True
    alert_notifications: bool = True
    incident_notifications: bool = True
    report_notifications: bool = False


class NotificationSettingsUpdate(BaseModel):
    email_notifications: Optional[bool] = None
    in_app_notifications: Optional[bool] = None
    alert_notifications: Optional[bool] = None
    incident_notifications: Optional[bool] = None
    report_notifications: Optional[bool] = None


class NotificationSettingsResponse(NotificationSettingsBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        orm_mode = True


# User Preferences Schemas
class UserPreferencesBase(BaseModel):
    theme: str = Field('system', pattern='^(light|dark|system)$')
    language: str = Field('vi', pattern='^(vi|en)$')
    sidebar_collapsed: bool = False
    items_per_page: int = Field(20, ge=10, le=100)


class UserPreferencesUpdate(BaseModel):
    theme: Optional[str] = Field(None, pattern='^(light|dark|system)$')
    language: Optional[str] = Field(None, pattern='^(vi|en)$')
    sidebar_collapsed: Optional[bool] = None
    items_per_page: Optional[int] = Field(None, ge=10, le=100)


class UserPreferencesResponse(UserPreferencesBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        orm_mode = True


# Session Schemas
class SessionResponse(BaseModel):
    id: int
    user_id: int
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    device_type: Optional[str] = None
    location: Optional[str] = None
    is_revoked: bool
    created_at: datetime
    last_active_at: datetime
    expires_at: datetime
    is_current: bool = False  # Will be set by API
    
    class Config:
        orm_mode = True

