"""
User Management API - Admin only
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from typing import List, Optional
from pydantic import BaseModel, EmailStr
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_superuser, get_password_hash
from app.models.user import User

router = APIRouter()


# Schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    is_superuser: bool = False
    is_active: bool = True


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    is_superuser: Optional[bool] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: Optional[str]
    is_active: bool
    is_superuser: bool
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        orm_mode = True


class PasswordReset(BaseModel):
    new_password: str


# Endpoints
@router.get("/users", response_model=List[UserResponse])
def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    is_superuser: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """List all users - Admin only"""
    query = select(User)
    
    if search:
        query = query.where(
            (User.email.ilike(f"%{search}%")) | 
            (User.full_name.ilike(f"%{search}%"))
        )
    
    if is_active is not None:
        query = query.where(User.is_active == is_active)
    
    if is_superuser is not None:
        query = query.where(User.is_superuser == is_superuser)
    
    query = query.offset(skip).limit(limit).order_by(User.created_at.desc())
    
    result = db.execute(query)
    users = result.scalars().all()
    
    return users


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Create a new user - Admin only"""
    # Check if email already exists
    existing = db.execute(
        select(User).where(User.email == user_data.email)
    ).scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )
    
    # Create user
    hashed_password = get_password_hash(user_data.password)
    
    new_user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        full_name=user_data.full_name,
        is_superuser=user_data.is_superuser,
        is_active=user_data.is_active
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Get user by ID - Admin only"""
    user = db.execute(
        select(User).where(User.id == user_id)
    ).scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Update user - Admin only"""
    user = db.execute(
        select(User).where(User.id == user_id)
    ).scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if email is being changed and already exists
    if user_data.email and user_data.email != user.email:
        existing = db.execute(
            select(User).where(User.email == user_data.email)
        ).scalar_one_or_none()
        
        if existing:
            raise HTTPException(
                status_code=400,
                detail="Email already registered"
            )
    
    # Update fields
    for field, value in user_data.dict(exclude_unset=True).items():
        setattr(user, field, value)
    
    db.commit()
    db.refresh(user)
    
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Delete user - Admin only"""
    # Prevent deleting yourself
    if user_id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete yourself"
        )
    
    user = db.execute(
        select(User).where(User.id == user_id)
    ).scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db.delete(user)
    db.commit()


@router.post("/users/{user_id}/reset-password")
def reset_user_password(
    user_id: int,
    password_data: PasswordReset,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Reset user password - Admin only"""
    user = db.execute(
        select(User).where(User.id == user_id)
    ).scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update password
    user.hashed_password = get_password_hash(password_data.new_password)
    db.commit()
    
    return {"message": "Password reset successfully"}


@router.post("/users/{user_id}/toggle-active")
def toggle_user_active(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Toggle user active status - Admin only"""
    # Prevent deactivating yourself
    if user_id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="Cannot deactivate yourself"
        )
    
    user = db.execute(
        select(User).where(User.id == user_id)
    ).scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.is_active = not user.is_active
    db.commit()
    
    return {
        "message": f"User {'activated' if user.is_active else 'deactivated'} successfully",
        "is_active": user.is_active
    }


@router.get("/users/stats/summary")
def get_users_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Get user statistics - Admin only"""
    total_users = db.execute(select(func.count(User.id))).scalar()
    active_users = db.execute(
        select(func.count(User.id)).where(User.is_active == True)
    ).scalar()
    superusers = db.execute(
        select(func.count(User.id)).where(User.is_superuser == True)
    ).scalar()
    
    return {
        "total_users": total_users or 0,
        "active_users": active_users or 0,
        "inactive_users": (total_users or 0) - (active_users or 0),
        "superusers": superusers or 0,
        "normal_users": (total_users or 0) - (superusers or 0)
    }
