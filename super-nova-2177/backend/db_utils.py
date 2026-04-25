from __future__ import annotations

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

try:
    from .supernova_runtime import load_supernova_runtime
except Exception:
    from supernova_runtime import load_supernova_runtime

try:
    _runtime = load_supernova_runtime()
    if not _runtime.get("available") or _runtime.get("session_local") is None:
        raise RuntimeError("SuperNova runtime session unavailable")
    SharedSessionLocal = _runtime["session_local"]
except Exception:
    DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./supernova_local.db")
    engine = create_engine(
        DATABASE_URL,
        future=True,
        connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
    )
    SharedSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


SessionLocal = SharedSessionLocal


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
