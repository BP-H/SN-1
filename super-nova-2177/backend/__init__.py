from __future__ import annotations

from .db_utils import SessionLocal, get_db

try:
    from .supernova_2177_ui_weighted.supernovacore import (
        DB_ENGINE_URL,
        get_settings,
        get_threshold,
        tally_votes,
        decide,
    )
except Exception:
    DB_ENGINE_URL = None
    get_settings = None
    get_threshold = None
    tally_votes = None
    decide = None

__all__ = [
    "DB_ENGINE_URL",
    "SessionLocal",
    "decide",
    "get_db",
    "get_settings",
    "get_threshold",
    "tally_votes",
]
