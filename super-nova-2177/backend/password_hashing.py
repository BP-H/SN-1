import base64
import hashlib
import hmac
import os
from typing import Tuple


LEGACY_SHA256_LENGTH = 64
PBKDF2_HASH_PREFIX = "pbkdf2_sha256"
PBKDF2_ITERATIONS = int(os.environ.get("PASSWORD_PBKDF2_ITERATIONS", "260000"))


try:
    import auth_utils
except Exception:  # pragma: no cover - auth helpers may be unavailable in partial environments
    auth_utils = None


def is_legacy_sha256_hash(value: str) -> bool:
    candidate = (value or "").strip().lower()
    return len(candidate) == LEGACY_SHA256_LENGTH and all(
        char in "0123456789abcdef" for char in candidate
    )


def b64encode_bytes(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def b64decode_bytes(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}".encode("ascii"))


def hash_password_pbkdf2(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PBKDF2_ITERATIONS,
    )
    return (
        f"{PBKDF2_HASH_PREFIX}${PBKDF2_ITERATIONS}$"
        f"{b64encode_bytes(salt)}${b64encode_bytes(digest)}"
    )


def verify_password_pbkdf2(password: str, hashed_password: str) -> bool:
    try:
        prefix, iterations, salt, digest = (hashed_password or "").split("$", 3)
        if prefix != PBKDF2_HASH_PREFIX:
            return False
        iteration_count = int(iterations)
        expected = b64decode_bytes(digest)
        actual = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            b64decode_bytes(salt),
            iteration_count,
        )
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


def hash_password_strict(password: str) -> str:
    """Create new password hashes without falling back to unsalted SHA-256."""
    return hash_password_pbkdf2(password)


def verify_legacy_sha256_password(password: str, hashed_password: str) -> bool:
    stored_hash = (hashed_password or "").strip().lower()
    if not is_legacy_sha256_hash(stored_hash):
        return False
    candidate = hashlib.sha256(password.encode()).hexdigest()
    return hmac.compare_digest(candidate, stored_hash)


def verify_password_with_legacy_upgrade(
    password: str,
    hashed_password: str,
) -> Tuple[bool, bool]:
    stored_hash = (hashed_password or "").strip()
    if not stored_hash:
        return False, False
    if stored_hash.startswith(f"{PBKDF2_HASH_PREFIX}$"):
        return verify_password_pbkdf2(password, stored_hash), False
    if is_legacy_sha256_hash(stored_hash):
        return verify_legacy_sha256_password(password, stored_hash), True
    if not auth_utils or not hasattr(auth_utils, "pwd_context"):
        return False, False
    try:
        return bool(auth_utils.pwd_context.verify(password, stored_hash)), False
    except Exception:
        return False, False
