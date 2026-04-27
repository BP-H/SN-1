from __future__ import annotations

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

try:
    from .supernova_runtime import load_supernova_runtime
except Exception:
    from supernova_runtime import load_supernova_runtime


def _create_fallback_session_local(database_url: str):
    fallback_engine = create_engine(
        database_url,
        future=True,
        connect_args={"check_same_thread": False} if database_url.startswith("sqlite") else {},
    )
    return fallback_engine, sessionmaker(autocommit=False, autoflush=False, bind=fallback_engine)


try:
    _runtime = load_supernova_runtime()
    if not _runtime.get("available") or _runtime.get("session_local") is None:
        raise RuntimeError("SuperNova runtime session unavailable")
    SharedSessionLocal = _runtime["session_local"]
except Exception:
    DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./supernova_local.db")
    engine, SharedSessionLocal = _create_fallback_session_local(DATABASE_URL)


SessionLocal = SharedSessionLocal


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
