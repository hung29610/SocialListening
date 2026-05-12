from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List

from app.core.database import get_db
from app.core.security import get_current_superuser
from app.models.user import User
from app.models.rbac import Role, UserRole
from app.schemas.rbac import (
    RoleResponse, RoleCreate, RoleUpdate,
    UserRoleAssign, UserRoleResponse
)

router = APIRouter()


# ─── Role CRUD ────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[RoleResponse])
def list_roles(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """List all roles - Admin only"""
    query = select(Role)
    if not include_inactive:
        query = query.where(Role.is_active == True)
    
    roles = db.execute(query.order_by(Role.name)).scalars().all()
    return [RoleResponse.from_orm(role) for role in roles]


@router.get("/{role_id}", response_model=RoleResponse)
def get_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Get role by ID - Admin only"""
    role = db.execute(
        select(Role).where(Role.id == role_id)
    ).scalar_one_or_none()
    
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    return RoleResponse.from_orm(role)


@router.post("/", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
def create_role(
    role_data: RoleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Create a new custom role - Admin only"""
    # Check if role name already exists
    existing = db.execute(
        select(Role).where(Role.name == role_data.name)
    ).scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Role with name '{role_data.name}' already exists"
        )
    
    # Create new role
    role = Role(
        name=role_data.name,
        display_name=role_data.display_name,
        description=role_data.description,
        permissions=role_data.permissions,
        is_system=False,  # Custom roles are never system roles
        is_active=role_data.is_active
    )
    
    db.add(role)
    db.commit()
    db.refresh(role)
    
    return RoleResponse.from_orm(role)


@router.put("/{role_id}", response_model=RoleResponse)
def update_role(
    role_id: int,
    role_data: RoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Update a role - Admin only. System roles can only update permissions."""
    role = db.execute(
        select(Role).where(Role.id == role_id)
    ).scalar_one_or_none()
    
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # System roles can only update permissions and is_active
    if role.is_system:
        if role_data.permissions is not None:
            role.permissions = role_data.permissions
        if role_data.is_active is not None:
            role.is_active = role_data.is_active
    else:
        # Custom roles can update everything
        for field, value in role_data.dict(exclude_unset=True).items():
            setattr(role, field, value)
    
    db.commit()
    db.refresh(role)
    
    return RoleResponse.from_orm(role)


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Delete a custom role - Admin only. Cannot delete system roles."""
    role = db.execute(
        select(Role).where(Role.id == role_id)
    ).scalar_one_or_none()
    
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    if role.is_system:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete system roles"
        )
    
    # Check if any users have this role
    user_count = db.execute(
        select(UserRole).where(UserRole.role_id == role_id)
    ).scalars().all()
    
    if user_count:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete role. {len(user_count)} user(s) still have this role."
        )
    
    db.delete(role)
    db.commit()
    
    return None


# ─── User Role Assignment ─────────────────────────────────────────────────────

@router.get("/users/{user_id}/roles", response_model=List[RoleResponse])
def get_user_roles(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Get all roles assigned to a user - Admin only"""
    # Check if user exists
    user = db.execute(
        select(User).where(User.id == user_id)
    ).scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get user's roles
    user_roles = db.execute(
        select(Role)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == user_id)
    ).scalars().all()
    
    return [RoleResponse.from_orm(role) for role in user_roles]


@router.post("/users/assign", response_model=UserRoleResponse, status_code=status.HTTP_201_CREATED)
def assign_role_to_user(
    assignment: UserRoleAssign,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Assign a role to a user - Admin only"""
    # Check if user exists
    user = db.execute(
        select(User).where(User.id == assignment.user_id)
    ).scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if role exists
    role = db.execute(
        select(Role).where(Role.id == assignment.role_id)
    ).scalar_one_or_none()
    
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # Check if already assigned
    existing = db.execute(
        select(UserRole).where(
            UserRole.user_id == assignment.user_id,
            UserRole.role_id == assignment.role_id
        )
    ).scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail="User already has this role"
        )
    
    # Create assignment
    user_role = UserRole(
        user_id=assignment.user_id,
        role_id=assignment.role_id,
        assigned_by=current_user.id
    )
    
    db.add(user_role)
    db.commit()
    db.refresh(user_role)
    
    return UserRoleResponse.from_orm(user_role)


@router.delete("/users/{user_id}/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_role_from_user(
    user_id: int,
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Remove a role from a user - Admin only"""
    user_role = db.execute(
        select(UserRole).where(
            UserRole.user_id == user_id,
            UserRole.role_id == role_id
        )
    ).scalar_one_or_none()
    
    if not user_role:
        raise HTTPException(
            status_code=404,
            detail="User does not have this role"
        )
    
    # Prevent removing last role from user
    user_roles_count = db.execute(
        select(UserRole).where(UserRole.user_id == user_id)
    ).scalars().all()
    
    if len(user_roles_count) <= 1:
        raise HTTPException(
            status_code=400,
            detail="Cannot remove last role from user. Assign another role first."
        )
    
    db.delete(user_role)
    db.commit()
    
    return None


# ─── Permission Management ────────────────────────────────────────────────────

@router.get("/permissions/available", response_model=List[str])
def list_available_permissions(
    current_user: User = Depends(get_current_superuser)
):
    """List all available permissions in the system - Admin only"""
    # Define all available permissions
    permissions = [
        "*",  # Super admin wildcard
        "users.read",
        "users.write",
        "users.delete",
        "settings.read",
        "settings.write",
        "roles.read",
        "roles.write",
        "mentions.read",
        "mentions.write",
        "mentions.delete",
        "keywords.read",
        "keywords.write",
        "keywords.delete",
        "sources.read",
        "sources.write",
        "sources.delete",
        "reports.read",
        "reports.write",
        "reports.delete",
        "incidents.read",
        "incidents.write",
        "incidents.delete",
        "alerts.read",
        "alerts.write",
        "alerts.delete",
        "crawl.read",
        "crawl.write",
        "audit.read"
    ]
    
    return sorted(permissions)
