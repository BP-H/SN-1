"""Re-export API helpers for convenience.

This module simply exposes the functions and variables from
``transcendental_resonance_frontend.src.utils.api`` under the ``utils.api``
namespace so imports remain stable regardless of where the frontend lives.
"""

from transcendental_resonance_frontend.src.utils import api as _api


def _sync_state() -> None:
    """Propagate local variables to the underlying API module."""
    _api.ui = ui
    _api.TOKEN = TOKEN
    _api.OFFLINE_MODE = OFFLINE_MODE
    _api.BACKEND_URL = BACKEND_URL
    _api.WS_CONNECTION = WS_CONNECTION

ui = _api.ui
TOKEN = _api.TOKEN
OFFLINE_MODE = _api.OFFLINE_MODE
BACKEND_URL = _api.BACKEND_URL
WS_CONNECTION = _api.WS_CONNECTION


async def api_call(*args, **kwargs):
    _sync_state()
    return await _api.api_call(*args, **kwargs)

def set_token(token: str) -> None:
    global TOKEN
    TOKEN = token
    _sync_state()

def clear_token() -> None:
    global TOKEN
    TOKEN = None
    _sync_state()

async def get_user(username: str):
    _sync_state()
    return await _api.get_user(username)

async def get_followers(username: str):
    _sync_state()
    return await _api.get_followers(username)

async def get_following(username: str):
    _sync_state()
    return await _api.get_following(username)

async def toggle_follow(username: str):
    _sync_state()
    return await _api.toggle_follow(username)

async def get_user_recommendations():
    _sync_state()
    return await _api.get_user_recommendations()

async def get_group_recommendations():
    _sync_state()
    return await _api.get_group_recommendations()

async def connect_ws(*args, **kwargs):
    _sync_state()
    return await _api.connect_ws(*args, **kwargs)

async def listen_ws(*args, **kwargs):
    _sync_state()
    return await _api.listen_ws(*args, **kwargs)

async def combined_search(query: str):
    _sync_state()
    return await _api.combined_search(query)

async def get_resonance_summary(name: str):
    _sync_state()
    return await _api.get_resonance_summary(name)

dispatch_route = getattr(_api, "dispatch_route", None)

async def get_flagged_items():
    _sync_state()
    return await (_api.get_flagged_items() if hasattr(_api, "get_flagged_items") else None)

async def perform_moderation_action(flag_id: str, action: str):
    _sync_state()
    if hasattr(_api, "perform_moderation_action"):
        return await _api.perform_moderation_action(flag_id, action)
    return None
on_request_start = _api.on_request_start
on_request_end = _api.on_request_end
on_ws_status_change = _api.on_ws_status_change



__all__ = [
    "ui",
    "TOKEN",
    "OFFLINE_MODE",
    "BACKEND_URL",
    "WS_CONNECTION",
    "api_call",
    "set_token",
    "clear_token",
    "get_user",
    "get_followers",
    "get_following",
    "toggle_follow",
    "get_user_recommendations",
    "get_group_recommendations",
    "connect_ws",
    "listen_ws",
    "combined_search",
    "get_resonance_summary",
    "dispatch_route",
    "get_flagged_items",
    "perform_moderation_action",
    "on_request_start",
    "on_request_end",
    "on_ws_status_change",
]
