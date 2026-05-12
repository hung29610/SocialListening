from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional, List


# ─── Role Schemas ─────────────────────────────────────────────────────────────

class RoleBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    display_name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    permissions: List[str] = []
    is_active: bool = True


class RoleCreate(RoleBase):
    pass


class RoleUpdate(BaseModel):
    display_name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    permissions: Optional[List[str]] = None
    is_active: Optional[bool] = None


class RoleResponse(RoleBase):
    id: int
    is_system: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        orm_mode = True


# ─── User Role Assignment Schemas ─────────────────────────────────────────────

class UserRoleAssign(BaseModel):
    user_id: int
    role_id: int


class UserRoleResponse(BaseModel):
    id: int
    user_id: int
    role_id: int
    assigned_at: datetime
    assigned_by: Optional[int] = None
    
    class Config:
        orm_mode = True


# ─── API Key Schemas ──────────────────────────────────────────────────────────

class APIKeyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    permissions: List[str] = []
    expires_at: Optional[datetime] = None


class APIKeyResponse(BaseModel):
    id: int
    name: str
    prefix: str  # Only show first 8 chars
    permissions: List[str]
    is_active: bool
    expires_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        orm_mode = True


class APIKeyCreateResponse(APIKeyResponse):
    """Response when creating a new API key - includes full key ONCE"""
    full_key: str  # Only returned on creation


class APIKeyUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    permissions: Optional[List[str]] = None
    is_active: Optional[bool] = None


# ─── Branding Settings Schemas ────────────────────────────────────────────────

class BrandingSettingsBase(BaseModel):
    primary_color: str = Field('#3B82F6', regex='^#[0-9A-Fa-f]{6}$')
    secondary_color: str = Field('#10B981', regex='^#[0-9A-Fa-f]{6}$')
    logo_light_url: Optional[str] = None
    logo_dark_url: Optional[str] = None
    favicon_url: Optional[str] = None
    login_background_url: Optional[str] = None
    custom_css: Optional[str] = None


class BrandingSettingsUpdate(BaseModel):
    primary_color: Optional[str] = Field(None, regex='^#[0-9A-Fa-f]{6}$')
    secondary_color: Optional[str] = Field(None, regex='^#[0-9A-Fa-f]{6}$')
    logo_light_url: Optional[str] = None
    logo_dark_url: Optional[str] = None
    favicon_url: Optional[str] = None
    login_background_url: Optional[str] = None
    custom_css: Optional[str] = None


class BrandingSettingsResponse(BrandingSettingsBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        orm_mode = True


# ─── Audit Log Schemas ────────────────────────────────────────────────────────

class AuditLogCreate(BaseModel):
    """Internal schema for creating audit logs"""
    user_id: Optional[int] = None
    action: str = Field(..., min_length=1, max_length=100)
    resource_type: Optional[str] = Field(None, max_length=50)
    resource_id: Optional[int] = None
    details: Optional[dict] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[int] = None
    details: Optional[dict] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime
    
    class Config:
        orm_mode = True


class AuditLogFilter(BaseModel):
    """Query parameters for filtering audit logs"""
    user_id: Optional[int] = None
    action: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    limit: int = Field(100, ge=1, le=1000)
    offset: int = Field(0, ge=0)
