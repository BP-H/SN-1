from __future__ import annotations

from typing import Any, Dict, TYPE_CHECKING

from sqlalchemy.orm import Session

from frontend_bridge import register_route_once
from .backend import toggle_follow

if TYPE_CHECKING:  # pragma: no cover - for type hints only
    from db_models import Harmonizer


async def follow_user_ui(
    payload: Dict[str, Any], db: Session, current_user: "Harmonizer"
) -> Dict[str, str]:
    """Follow or unfollow ``payload['username']`` for ``current_user``."""
    username = payload["username"]
    return toggle_follow(username, db=db, current_user=current_user)


register_route_once(
    "follow_user",
    follow_user_ui,
    "Follow or unfollow a user",
    "social",
)
