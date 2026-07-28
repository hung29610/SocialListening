"""Authorization gate for dangerous production maintenance operations."""

from __future__ import annotations

import os

from fastapi import Depends, HTTPException, status

from app.core.security import get_current_superuser
from app.models.user import User


def get_enabled_superuser(
    current_user: User = Depends(get_current_superuser),
) -> User:
    """Require super-admin and an explicit disabled-by-default operations gate."""

    enabled = os.getenv("ENABLE_DANGEROUS_ADMIN_OPERATIONS", "false").lower() == "true"
    if not enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "ADMIN_OPERATIONS_DISABLED",
                "message": "Dangerous administrative operations are disabled.",
            },
        )
    return current_user
