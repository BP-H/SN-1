import os
from typing import Any, Dict

# Toggle to switch between real backend and lightweight mock implementation.
USE_MOCK = os.getenv("SOCIAL_MOCK", "0") == "1"

# In-memory storage for mock mode
_mock_users: Dict[str, Dict[str, set[str]]] = {}

def _mock_get_user(username: str, db: Any = None):
    """Return a lightweight user object for mock mode."""
    _mock_users.setdefault(username, {"followers": set(), "following": set()})
    return type("User", (), {"id": username, "username": username, "bio": ""})()

def _mock_get_followers(username: str, db: Any = None) -> Dict[str, Any]:
    data = _mock_users.setdefault(username, {"followers": set(), "following": set()})
    followers = sorted(data["followers"])
    return {"count": len(followers), "followers": followers}

def _mock_get_following(username: str, db: Any = None) -> Dict[str, Any]:
    data = _mock_users.setdefault(username, {"followers": set(), "following": set()})
    following = sorted(data["following"])
    return {"count": len(following), "following": following}

def _mock_toggle_follow(username: str, db: Any = None, current_user: Any = None) -> Dict[str, str]:
    if current_user is None:
        raise RuntimeError("current_user required")
    cu = getattr(current_user, "username", current_user)
    target = _mock_users.setdefault(username, {"followers": set(), "following": set()})
    actor = _mock_users.setdefault(cu, {"followers": set(), "following": set()})
    if cu in target["followers"]:
        target["followers"].remove(cu)
        actor["following"].remove(username)
        action = "unfollowed"
    else:
        target["followers"].add(cu)
        actor["following"].add(username)
        action = "followed"
    return {"status": action}

# Import real backend functions lazily; they may not be available during tests.
try:  # pragma: no cover - optional heavy dependency
    from superNova_2177 import (
        follow_unfollow_user as _real_toggle,
        get_user_by_username as _real_get_user,
        get_user_followers as _real_get_followers,
        get_user_following as _real_get_following,
    )
except Exception:  # pragma: no cover - fallback stub
    _real_toggle = _real_get_user = _real_get_followers = _real_get_following = None  # type: ignore


def get_user(username: str, db: Any = None):
    """Fetch a user record, delegating to real backend or mock."""
    if USE_MOCK:
        return _mock_get_user(username, db=db)
    if _real_get_user is None:
        raise RuntimeError("get_user_by_username unavailable")
    return _real_get_user(username, db=db)


def get_followers(username: str, db: Any = None) -> Dict[str, Any]:
    """Return follower info for ``username``."""
    if USE_MOCK:
        return _mock_get_followers(username, db=db)
    if _real_get_followers is None:
        raise RuntimeError("get_user_followers unavailable")
    return _real_get_followers(username, db=db)


def get_following(username: str, db: Any = None) -> Dict[str, Any]:
    """Return following info for ``username``."""
    if USE_MOCK:
        return _mock_get_following(username, db=db)
    if _real_get_following is None:
        raise RuntimeError("get_user_following unavailable")
    return _real_get_following(username, db=db)


def toggle_follow(username: str, db: Any = None, current_user: Any = None) -> Dict[str, str]:
    """Follow or unfollow ``username`` for ``current_user``."""
    if USE_MOCK:
        return _mock_toggle_follow(username, db=db, current_user=current_user)
    if _real_toggle is None:
        raise RuntimeError("follow_unfollow_user unavailable")
    return _real_toggle(username, db=db, current_user=current_user)


__all__ = [
    "get_user",
    "get_followers",
    "get_following",
    "toggle_follow",
]
