from __future__ import annotations

import datetime
import hashlib
import os
from typing import Dict, Generator, Optional

from jose import jwt
from passlib.context import CryptContext

# Shared cryptography context used for password validation
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


try:  # pragma: no cover - defensive import for shared exception
    from superNova_2177 import InvalidConsentError  # type: ignore
except Exception:  # pragma: no cover - fallback when superNova_2177 is unavailable
    class InvalidConsentError(Exception):
        """Raised when a harmonizer has not granted consent."""


def get_auth_settings():
    """Return settings object with ``SECRET_KEY`` and ``ALGORITHM`` attributes."""

    try:
        from superNova_2177 import get_settings  # type: ignore

        return get_settings()
    except Exception:
        # Fallback values primarily used in standalone mode/tests
        class Settings:
            SECRET_KEY = os.environ.get("SECRET_KEY", "changeme")
            ALGORITHM = os.environ.get("ALGORITHM", "HS256")

        return Settings()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Return ``True`` if ``plain_password`` matches ``hashed_password``."""

    if hasattr(pwd_context, "verify"):
        try:
            return pwd_context.verify(plain_password, hashed_password)
        except Exception:
            pass

    return hashlib.sha256(plain_password.encode()).hexdigest() == hashed_password


def create_access_token(
    data: Dict, expires_delta: Optional[datetime.timedelta] = None
) -> str:
    """Create a JWT using the configured auth settings."""

    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + (
        expires_delta or datetime.timedelta(minutes=15)
    )
    to_encode.update({"exp": expire})
    settings = get_auth_settings()
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def get_db() -> Generator:
    """Yield a database session using the available backend factory."""

    try:
        from superNova_2177 import get_db as supernova_get_db  # type: ignore

        generator = supernova_get_db()
    except Exception:
        from backend.db_utils import get_db as fallback_get_db

        generator = fallback_get_db()

    yield from generator

