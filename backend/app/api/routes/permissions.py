"""
Permission management routes.

- GET  /permissions               — list all defined permissions (admin+)
- GET  /permissions/me            — current user's effective permission names
- POST /permissions/overrides     — grant or revoke a permission for a user
- GET  /permissions/overrides     — list overrides for a user (admin+)
- DELETE /permissions/overrides/{id} — remove an override
"""
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_permission, get_db
from app.core.rls import get_rls_db
from app.models.rbac import Permission, RolePermission, UserPermissionOverride
from app.models.user import User
from app.schemas.permissions import OverrideCreate, OverrideOut, PermissionOut
from app.services.permissions import get_user_permissions, has_permission, invalidate_cache
from app.core.audit import log_data_change

router = APIRouter()


@router.get("/", response_model=List[PermissionOut])
def list_permissions(
    resource: Optional[str] = Query(None),
    _user: User = Depends(require_permission("users:read:own_clinic")),
    db: Session = Depends(get_db),
):
    q = db.query(Permission)
    if resource:
        q = q.filter(Permission.resource == resource)
    return q.order_by(Permission.resource, Permission.name).all()


@router.get("/me", response_model=List[str])
def my_permissions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the caller's effective permission names (role defaults + overrides)."""
    return sorted(get_user_permissions(db, current_user))


@router.post("/overrides", response_model=OverrideOut, status_code=status.HTTP_201_CREATED)
def create_override(
    data: OverrideCreate,
    current_user: User = Depends(require_permission("users:manage:all")),
    db: Session = Depends(get_db),
):
    perm = db.query(Permission).filter(Permission.name == data.permission_name).first()
    if not perm:
        raise HTTPException(status_code=404, detail=f"Permission '{data.permission_name}' not found")

    # Upsert: remove existing override for this user+permission before inserting
    existing = (
        db.query(UserPermissionOverride)
        .filter(
            UserPermissionOverride.user_id == data.user_id,
            UserPermissionOverride.permission_id == perm.id,
        )
        .first()
    )
    if existing:
        db.delete(existing)

    override = UserPermissionOverride(
        user_id=data.user_id,
        permission_id=perm.id,
        granted=data.granted,
        granted_by=current_user.id,
        reason=data.reason,
        expires_at=data.expires_at,
    )
    db.add(override)

    log_data_change(
        db,
        action="permission.override.create",
        resource_type="user_permission_overrides",
        resource_id=str(data.user_id),
        user=current_user,
        new_values={
            "permission": data.permission_name,
            "granted": data.granted,
            "reason": data.reason,
        },
    )

    db.commit()
    db.refresh(override)
    invalidate_cache(str(data.user_id))
    return override


@router.get("/overrides", response_model=List[OverrideOut])
def list_overrides(
    user_id: uuid.UUID = Query(..., description="Target user ID"),
    current_user: User = Depends(require_permission("users:manage:all")),
    db: Session = Depends(get_db),
):
    return (
        db.query(UserPermissionOverride)
        .filter(UserPermissionOverride.user_id == user_id)
        .all()
    )


@router.delete("/overrides/{override_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_override(
    override_id: uuid.UUID,
    current_user: User = Depends(require_permission("users:manage:all")),
    db: Session = Depends(get_db),
):
    override = db.query(UserPermissionOverride).filter(UserPermissionOverride.id == override_id).first()
    if not override:
        raise HTTPException(status_code=404, detail="Override not found")

    affected_user_id = str(override.user_id)
    db.delete(override)

    log_data_change(
        db,
        action="permission.override.delete",
        resource_type="user_permission_overrides",
        resource_id=str(override_id),
        user=current_user,
    )

    db.commit()
    invalidate_cache(affected_user_id)
