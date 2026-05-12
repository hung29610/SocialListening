from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List
import secrets
import hashlib
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.rbac import APIKey
from app.schemas.rbac import (
    APIKeyResponse, APIKeyCreate, APIKeyCreateResponse, APIKeyUpdate
)

router = APIRouter()


def generate_api_key() -> tuple[str, str, str]:
    """
    Generate a new API key
    Returns: (full_key, hashed_key, prefix)
    """
    # Generate random 32-byte key
    random_bytes = secrets.token_bytes(32)
    full_key = secrets.token_urlsafe(32)  # Base64 URL-safe string
    
    # Hash the key for storage
    hashed_key = hashlib.sha256(full_key.encode()).hexdigest()
    
    # Get prefix (first 8 chars) for display
    prefix = full_key[:8]
    
    return full_key, hashed_key, prefix


# ─── API Key CRUD ─────────────────────────────────────────────────────────────

@router.get("/", response_model=List[APIKeyResponse])
def list_api_keys(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all API keys for current user"""
    query = select(APIKey).where(APIKey.user_id == current_user.id)
    
    if not include_inactive:
        query = query.where(APIKey.is_active == True)
    
    keys = db.execute(query.order_by(APIKey.created_at.desc())).scalars().all()
    return [APIKeyResponse.from_orm(key) for key in keys]


@router.get("/{key_id}", response_model=APIKeyResponse)
def get_api_key(
    key_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get API key by ID"""
    key = db.execute(
        select(APIKey).where(
            APIKey.id == key_id,
            APIKey.user_id == current_user.id
        )
    ).scalar_one_or_none()
    
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    return APIKeyResponse.from_orm(key)


@router.post("/", response_model=APIKeyCreateResponse, status_code=status.HTTP_201_CREATED)
def create_api_key(
    key_data: APIKeyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new API key for current user.
    WARNING: The full key is only shown ONCE on creation. Store it securely!
    """
    # Check if user already has too many keys (limit to 10)
    existing_count = db.execute(
        select(APIKey).where(
            APIKey.user_id == current_user.id,
            APIKey.is_active == True
        )
    ).scalars().all()
    
    if len(existing_count) >= 10:
        raise HTTPException(
            status_code=400,
            detail="Maximum number of active API keys (10) reached. Revoke unused keys first."
        )
    
    # Generate new key
    full_key, hashed_key, prefix = generate_api_key()
    
    # Create API key record
    api_key = APIKey(
        name=key_data.name,
        key=hashed_key,
        prefix=prefix,
        user_id=current_user.id,
        permissions=key_data.permissions,
        is_active=True,
        expires_at=key_data.expires_at
    )
    
    db.add(api_key)
    db.commit()
    db.refresh(api_key)
    
    # Return response with full key (only time it's shown)
    response = APIKeyCreateResponse.from_orm(api_key)
    response.full_key = full_key
    
    return response


@router.put("/{key_id}", response_model=APIKeyResponse)
def update_api_key(
    key_id: int,
    key_data: APIKeyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update API key metadata (name, permissions, active status)"""
    key = db.execute(
        select(APIKey).where(
            APIKey.id == key_id,
            APIKey.user_id == current_user.id
        )
    ).scalar_one_or_none()
    
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    # Update fields
    for field, value in key_data.dict(exclude_unset=True).items():
        setattr(key, field, value)
    
    db.commit()
    db.refresh(key)
    
    return APIKeyResponse.from_orm(key)


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_api_key(
    key_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Revoke (delete) an API key"""
    key = db.execute(
        select(APIKey).where(
            APIKey.id == key_id,
            APIKey.user_id == current_user.id
        )
    ).scalar_one_or_none()
    
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    db.delete(key)
    db.commit()
    
    return None


@router.post("/{key_id}/deactivate", response_model=APIKeyResponse)
def deactivate_api_key(
    key_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Deactivate an API key (soft delete - can be reactivated)"""
    key = db.execute(
        select(APIKey).where(
            APIKey.id == key_id,
            APIKey.user_id == current_user.id
        )
    ).scalar_one_or_none()
    
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    key.is_active = False
    db.commit()
    db.refresh(key)
    
    return APIKeyResponse.from_orm(key)


@router.post("/{key_id}/activate", response_model=APIKeyResponse)
def activate_api_key(
    key_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Reactivate a deactivated API key"""
    key = db.execute(
        select(APIKey).where(
            APIKey.id == key_id,
            APIKey.user_id == current_user.id
        )
    ).scalar_one_or_none()
    
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    # Check if expired
    if key.expires_at and key.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=400,
            detail="Cannot activate expired API key"
        )
    
    key.is_active = True
    db.commit()
    db.refresh(key)
    
    return APIKeyResponse.from_orm(key)


# ─── API Key Validation (for internal use) ────────────────────────────────────

def validate_api_key(api_key: str, db: Session) -> APIKey:
    """
    Validate an API key and return the associated APIKey object.
    This function is for internal use by authentication middleware.
    """
    # Hash the provided key
    hashed_key = hashlib.sha256(api_key.encode()).hexdigest()
    
    # Find matching key
    key = db.execute(
        select(APIKey).where(
            APIKey.key == hashed_key,
            APIKey.is_active == True
        )
    ).scalar_one_or_none()
    
    if not key:
        return None
    
    # Check if expired
    if key.expires_at and key.expires_at < datetime.utcnow():
        return None
    
    # Update last used timestamp
    key.last_used_at = datetime.utcnow()
    db.commit()
    
    return key
