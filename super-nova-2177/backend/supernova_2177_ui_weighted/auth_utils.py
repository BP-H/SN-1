from __future__ import annotations

import datetime
import hashlib
import os
from typing import Dict, Generator, Optional

from jose import jwt
from passlib.context import CryptContext

# Shared cryptography context used for password validation
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

PRODUCTION_ENVIRONMENT_NAMES = (
    "SUPERNOVA_ENV",
    "APP_ENV",
    "ENV",
    "RAILWAY_ENVIRONMENT",
)
PRODUCTION_ENVIRONMENT_VALUES = {"production", "prod"}
WEAK_SECRET_KEY_VALUES = {"", "changeme", "dev", "secret", "default"}


def _is_explicit_production_environment(environ: Optional[Dict[str, str]] = None) -> bool:
    source = os.environ if environ is None else environ
    return any(
        str(source.get(name, "")).strip().lower() in PRODUCTION_ENVIRONMENT_VALUES
        for name in PRODUCTION_ENVIRONMENT_NAMES
    )


def _is_weak_secret_key(value: Optional[str]) -> bool:
    return str(value or "").strip().lower() in WEAK_SECRET_KEY_VALUES


def _fallback_secret_key_from_env(environ: Optional[Dict[str, str]] = None) -> str:
    source = os.environ if environ is None else environ
    secret_key = source.get("SECRET_KEY")
    if _is_explicit_production_environment(source) and _is_weak_secret_key(secret_key):
        raise RuntimeError("SECRET_KEY must be set to a non-placeholder value in production.")
    return secret_key or "changeme"


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
            SECRET_KEY = _fallback_secret_key_from_env()
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
