from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.services.component_health import collect_component_health


router = APIRouter()


@router.get("/worker-status")
def get_worker_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Return independently evidenced web, broker, worker, Beat, and pipeline state."""
    return collect_component_health(db)
