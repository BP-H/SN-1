import base64
import hashlib
import hmac
import json
import os
import smtplib
import time
import uuid
from email.message import EmailMessage
from typing import Any, Dict, Mapping, Optional
from urllib.parse import urlencode, urlparse


PASSWORD_RESET_PURPOSE = "supernova_password_reset"


def _safe_positive_int(value: Any, default: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return parsed if parsed > 0 else default


PASSWORD_RESET_TTL_SECONDS = _safe_positive_int(
    os.environ.get("SUPERNOVA_PASSWORD_RESET_TTL_SECONDS"),
    1800,
)


def _env(environ: Optional[Mapping[str, str]], key: str, default: str = "") -> str:
    source = environ or os.environ
    return str(source.get(key, default) or "").strip()


def _first_env(environ: Optional[Mapping[str, str]], *keys: str) -> str:
    for key in keys:
        value = _env(environ, key)
        if value:
            return value
    return ""


def _env_bool(environ: Optional[Mapping[str, str]], key: str, default: bool = False) -> bool:
    raw = _env(environ, key)
    if raw == "":
        return default
    return raw.lower() not in {"0", "false", "no", "off"}


def _is_local_reset_base_url(value: str) -> bool:
    parsed = urlparse(value)
    hostname = (parsed.hostname or "").strip().lower()
    return hostname in {"localhost", "127.0.0.1", "::1"} or hostname.endswith(".localhost")


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _b64decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}".encode("ascii"))


def _json_b64(payload: Dict[str, Any]) -> str:
    return _b64encode(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8"))


def _signature(payload_b64: str, *, hashed_password: str, secret_key: str) -> str:
    signing_secret = hashlib.sha256(
        f"{secret_key}:{hashed_password}:{PASSWORD_RESET_PURPOSE}".encode("utf-8")
    ).digest()
    return _b64encode(hmac.new(signing_secret, payload_b64.encode("ascii"), hashlib.sha256).digest())


def create_password_reset_code(
    *,
    user_id: int,
    email: str,
    hashed_password: str,
    secret_key: str,
    now: Optional[int] = None,
    ttl_seconds: int = PASSWORD_RESET_TTL_SECONDS,
) -> str:
    issued_at = int(now if now is not None else time.time())
    payload = {
        "purpose": PASSWORD_RESET_PURPOSE,
        "uid": int(user_id),
        "email": str(email or "").strip().lower(),
        "exp": issued_at + max(60, _safe_positive_int(ttl_seconds, PASSWORD_RESET_TTL_SECONDS)),
        "nonce": uuid.uuid4().hex,
    }
    payload_b64 = _json_b64(payload)
    return f"{payload_b64}.{_signature(payload_b64, hashed_password=hashed_password, secret_key=secret_key)}"


def read_password_reset_code_payload(code: str) -> Optional[Dict[str, Any]]:
    try:
        if len(str(code or "")) > 4096:
            return None
        payload_b64, _sig = str(code or "").split(".", 1)
        payload = json.loads(_b64decode(payload_b64).decode("utf-8"))
        if not isinstance(payload, dict):
            return None
        if payload.get("purpose") != PASSWORD_RESET_PURPOSE:
            return None
        return payload
    except Exception:
        return None


def verify_password_reset_code(
    code: str,
    *,
    user_id: int,
    email: str,
    hashed_password: str,
    secret_key: str,
    now: Optional[int] = None,
) -> bool:
    try:
        payload_b64, candidate_sig = str(code or "").split(".", 1)
        payload = read_password_reset_code_payload(code)
        if not payload:
            return False
        if int(payload.get("uid")) != int(user_id):
            return False
        if str(payload.get("email") or "").strip().lower() != str(email or "").strip().lower():
            return False
        if int(payload.get("exp") or 0) < int(now if now is not None else time.time()):
            return False
        expected_sig = _signature(payload_b64, hashed_password=hashed_password, secret_key=secret_key)
        return hmac.compare_digest(candidate_sig, expected_sig)
    except Exception:
        return False


def resolve_password_reset_base_url(
    requested_base_url: str = "",
    *,
    environ: Optional[Mapping[str, str]] = None,
) -> str:
    configured = _first_env(
        environ,
        "SUPERNOVA_PASSWORD_RESET_PUBLIC_BASE_URL",
        "PASSWORD_RESET_PUBLIC_BASE_URL",
        "NEXT_PUBLIC_SITE_URL",
        "PUBLIC_BASE_URL",
        "FRONTEND_URL",
        "APP_PUBLIC_URL",
    )
    fallback_allowed = _env_bool(environ, "SUPERNOVA_PASSWORD_RESET_ALLOW_REQUEST_BASE_URL", False)
    candidate = configured
    if not candidate and fallback_allowed and _is_local_reset_base_url(requested_base_url):
        candidate = requested_base_url
    parsed = urlparse(candidate)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return ""
    return candidate.rstrip("/")


def password_reset_email_configured(
    *,
    base_url: str = "",
    environ: Optional[Mapping[str, str]] = None,
) -> bool:
    host = _first_env(environ, "SUPERNOVA_PASSWORD_RESET_SMTP_HOST", "SMTP_HOST")
    sender = _first_env(environ, "SUPERNOVA_PASSWORD_RESET_FROM", "SMTP_FROM", "MAIL_FROM")
    return bool(host and sender and base_url)


def build_password_reset_url(base_url: str, code: str) -> str:
    return f"{base_url.rstrip('/')}/reset-password?{urlencode({'code': code})}"


def send_password_reset_email(
    *,
    to_email: str,
    username: str,
    reset_url: str,
    environ: Optional[Mapping[str, str]] = None,
) -> None:
    host = _first_env(environ, "SUPERNOVA_PASSWORD_RESET_SMTP_HOST", "SMTP_HOST")
    sender = _first_env(environ, "SUPERNOVA_PASSWORD_RESET_FROM", "SMTP_FROM", "MAIL_FROM")
    if not host or not sender:
        raise RuntimeError("Password reset SMTP is not configured")

    port_raw = _first_env(environ, "SUPERNOVA_PASSWORD_RESET_SMTP_PORT", "SMTP_PORT") or "587"
    try:
        port = int(port_raw)
    except ValueError:
        port = 587
    username_env = _first_env(
        environ,
        "SUPERNOVA_PASSWORD_RESET_SMTP_USERNAME",
        "SMTP_USERNAME",
        "SMTP_USER",
    )
    password_env = _first_env(environ, "SUPERNOVA_PASSWORD_RESET_SMTP_PASSWORD", "SMTP_PASSWORD")
    use_tls = _env_bool(environ, "SUPERNOVA_PASSWORD_RESET_SMTP_TLS", True)

    message = EmailMessage()
    message["From"] = sender
    message["To"] = to_email
    message["Subject"] = "Reset your SuperNova password"
    greeting = f"Hi {username}," if username else "Hi,"
    message.set_content(
        "\n".join(
            [
                greeting,
                "",
                "Use this link to reset your SuperNova password:",
                reset_url,
                "",
                "If you did not request this, you can ignore this email.",
                "This link expires soon.",
                "",
                "SuperNova 2177",
            ]
        )
    )

    if port == 465:
        with smtplib.SMTP_SSL(host, port, timeout=12) as smtp:
            if username_env or password_env:
                smtp.login(username_env, password_env)
            smtp.send_message(message)
        return

    with smtplib.SMTP(host, port, timeout=12) as smtp:
        if use_tls:
            smtp.starttls()
        if username_env or password_env:
            smtp.login(username_env, password_env)
        smtp.send_message(message)


def password_reset_request_response(email_configured: bool) -> Dict[str, Any]:
    if email_configured:
        message = "If an account exists for that sign-in, password reset instructions will be sent."
    else:
        message = "Password reset email delivery is not configured yet."
    return {
        "ok": True,
        "email_configured": bool(email_configured),
        "message": message,
    }
