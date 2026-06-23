"""
Permission checking service with in-memory TTL cache.

Cache is per-process (not shared across workers) — acceptable for this load.
Cache is invalidated explicitly whenever overrides change.
"""
import time
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.rbac import Permission, RolePermission, UserPermissionOverride
from app.models.user import User

_CACHE_TTL = 60  # seconds — short TTL so role changes propagate quickly
_perm_cache: dict[str, tuple[frozenset[str], float]] = {}


def _cache_get(user_id: str) -> Optional[frozenset[str]]:
    entry = _perm_cache.get(user_id)
    if entry and entry[1] > time.monotonic():
        return entry[0]
    return None


def _cache_set(user_id: str, perms: frozenset[str]) -> None:
    _perm_cache[user_id] = (perms, time.monotonic() + _CACHE_TTL)


def invalidate_cache(user_id: str) -> None:
    """Call this whenever a user's overrides are added/removed/updated."""
    _perm_cache.pop(str(user_id), None)


def get_user_permissions(db: Session, user: User) -> frozenset[str]:
    """
    Return the complete set of permission names for *user*.

    Logic (in order):
      1. Load all permissions assigned to the user's role.
      2. Apply user-level overrides: granted=True adds, granted=False removes.
      3. Cache the result for _CACHE_TTL seconds.
    """
    uid = str(user.id)
    cached = _cache_get(uid)
    if cached is not None:
        return cached

    # ── 1. Role defaults ──────────────────────────────────────────────────────
    rows = (
        db.query(Permission.name)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .filter(RolePermission.role == user.role)
        .all()
    )
    perm_set: set[str] = {row[0] for row in rows}

    # ── 2. User overrides (unexpired only) ────────────────────────────────────
    now = datetime.now(timezone.utc)
    overrides = (
        db.query(UserPermissionOverride)
        .join(Permission, Permission.id == UserPermissionOverride.permission_id)
        .filter(
            UserPermissionOverride.user_id == user.id,
            (UserPermissionOverride.expires_at.is_(None))
            | (UserPermissionOverride.expires_at > now),
        )
        .all()
    )
    for ov in overrides:
        if ov.granted:
            perm_set.add(ov.permission.name)
        else:
            perm_set.discard(ov.permission.name)

    result = frozenset(perm_set)
    _cache_set(uid, result)
    return result


def has_permission(db: Session, user: User, permission_name: str) -> bool:
    return permission_name in get_user_permissions(db, user)
