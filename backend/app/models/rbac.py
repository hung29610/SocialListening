from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Role(Base):
    """Roles for RBAC"""
    __tablename__ = "roles"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False, unique=True, index=True)
    display_name = Column(String(100), nullable=False)
    description = Column(Text)
    permissions = Column(JSON, nullable=False, default=list)  # Array of permission strings
    is_system = Column(Boolean, default=False, nullable=False)  # System roles cannot be deleted
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user_roles = relationship("UserRole", back_populates="role", cascade="all, delete-orphan")


class UserRole(Base):
    """Junction table for User-Role many-to-many relationship"""
    __tablename__ = "user_roles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    role_id = Column(Integer, ForeignKey('roles.id', ondelete='CASCADE'), nullable=False, index=True)
    assigned_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    assigned_by = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'))
    
    # Relationships
    role = relationship("Role", back_populates="user_roles")


class APIKey(Base):
    """API Keys for programmatic access"""
    __tablename__ = "api_keys"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    key = Column(String(64), nullable=False, unique=True, index=True)  # Hashed key
    prefix = Column(String(8), nullable=False)  # First 8 chars for display
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    permissions = Column(JSON, default=list)  # Subset of user's permissions
    is_active = Column(Boolean, default=True, nullable=False)
    expires_at = Column(DateTime(timezone=True))
    last_used_at = Column(DateTime(timezone=True))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class BrandingSettings(Base):
    """System branding and theme settings (single row table)"""
    __tablename__ = "branding_settings"
    
    id = Column(Integer, primary_key=True)  # Always 1
    primary_color = Column(String(7), default='#3B82F6')  # Hex color
    secondary_color = Column(String(7), default='#10B981')
    logo_light_url = Column(Text)
    logo_dark_url = Column(Text)
    favicon_url = Column(Text)
    login_background_url = Column(Text)
    custom_css = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class AuditLog(Base):
    """Audit logs for tracking user actions"""
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), index=True)
    action = Column(String(100), nullable=False, index=True)  # e.g., 'user.create', 'settings.update'
    resource_type = Column(String(50))  # e.g., 'user', 'source', 'keyword'
    resource_id = Column(Integer)
    details = Column(JSON)  # Additional context
    ip_address = Column(String(45))
    user_agent = Column(Text)
    
    # Timestamp
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
