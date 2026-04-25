from __future__ import annotations

from .db_utils import SessionLocal, get_db
from .supernova_runtime import load_supernova_runtime

_runtime = load_supernova_runtime()

DB_ENGINE_URL = _runtime.get("db_engine_url")
get_settings = _runtime.get("get_settings")
get_threshold = _runtime.get("get_weighted_threshold")
tally_votes = _runtime.get("tally_votes")
decide = _runtime.get("weighted_decide")

__all__ = [
    "DB_ENGINE_URL",
    "SessionLocal",
    "decide",
    "get_db",
    "get_settings",
    "get_threshold",
    "tally_votes",
]
