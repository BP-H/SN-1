# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards
"""Adapters bridging UI events to backend services.

This module provides:
- `search_users_adapter(query)` to fetch matching users
- `follow_adapter(username)` to toggle follow state
- `use_real_backend()` to detect backend mode

All functions gracefully fall back to stub mode when the backend is unavailable.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# ---------------------------
# Config and Shared Constants
# ---------------------------

DUMMY_USERS: List[str] = ["taha_gungor", "artist_dev"]
ERROR_MESSAGE = "Unable to fetch users"
_STUB_FOLLOWING: set[str] = set()

# Try to import the follow toggle API (optional)
try:
    from utils.api import toggle_follow  # type: ignore
except Exception:
    toggle_follow = None  # fallback to stub

# ---------------------------
# Backend Toggle
# ---------------------------

def use_real_backend() -> bool:
    """Return True if the real backend should be used."""
    return os.getenv("USE_REAL_BACKEND", "").strip().lower() in {"1", "true", "yes", "on"}

# ---------------------------
# User Search Adapter
# ---------------------------

def search_users_adapter(query: str) -> Tuple[Optional[List[str]], Optional[str]]:
    """Search for users via backend or return stub results.

    Parameters
    ----------
    query:
        The raw query string from the UI.

    Returns
    -------
    usernames, error_message:
        List of usernames if available, or a stub list in fallback mode.
        An error message if the backend call fails.
    """
    if not isinstance(query, str) or not query.strip():
        return None, "Query cannot be empty"

    if not use_real_backend():
        return DUMMY_USERS, None

    try:
        import superNova_2177 as sn_mod
        with sn_mod.SessionLocal() as db:
            results = sn_mod.search_users(query, db)
        return [r.get("username", "") for r in results], None
    except Exception as exc:
        logger.exception("search_users_adapter failed: %s", exc)
        return None, ERROR_MESSAGE

# ---------------------------
# Follow/Unfollow Adapter
# ---------------------------

def _run_async(coro):
    """Execute `coro` whether or not an event loop is already running."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)
    else:
        if loop.is_running():
            return asyncio.run_coroutine_threadsafe(coro, loop).result()
        return loop.run_until_complete(coro)


def follow_adapter(target_username: str) -> Tuple[bool, str]:
    """Toggle following `target_username`.

    Returns
    -------
    success, message:
        Whether the operation succeeded, and the status message.
    """
    if not target_username:
        logger.warning("follow_adapter called without a username")
        return False, "No username provided"

    if toggle_follow is None:
        # Fallback stub path
        if target_username in _STUB_FOLLOWING:
            _STUB_FOLLOWING.remove(target_username)
            message = "Unfollowed"
        else:
            _STUB_FOLLOWING.add(target_username)
            message = "Followed"
        logger.info("Stub follow toggle for %s: %s", target_username, message)
        return True, message

    try:
        resp: Dict[str, Any] | None = _run_async(toggle_follow(target_username))
        message = (resp or {}).get("message", "Updated")
        logger.info("Follow toggle for %s succeeded: %s", target_username, message)
        return True, message
    except Exception as exc:
        logger.exception("Follow toggle failed for %s", target_username)
        return False, f"Follow failed: {exc}"

# ---------------------------
# Public API
# ---------------------------

__all__ = ["search_users_adapter", "follow_adapter", "use_real_backend"]

