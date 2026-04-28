import base64
import datetime
import hashlib
import hmac
import json
import os
import sys
import uuid
from datetime import timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import unquote, urlparse

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import asc, desc, func, or_, text
from sqlalchemy.orm import Session

try:
    from jose import JWTError, jwt
except Exception:  # pragma: no cover - optional dependency during partial environments
    JWTError = Exception
    jwt = None

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BACKEND_DIR.parent
SUPER_NOVA_DIR = BACKEND_DIR / 'supernova_2177_ui_weighted'
PROTOCOL_DIR_CANDIDATES = (PROJECT_DIR / "protocol", BACKEND_DIR / "protocol")
PROTOCOL_DIR = next((path for path in PROTOCOL_DIR_CANDIDATES if path.exists()), PROTOCOL_DIR_CANDIDATES[0])

for path in (BACKEND_DIR, SUPER_NOVA_DIR):
    path_str = str(path)
    if path_str not in sys.path:
        sys.path.insert(0, path_str)

try:
    from .supernova_runtime import load_supernova_runtime, runtime_status
except ImportError:  # pragma: no cover - supports running backend/app.py directly
    from supernova_runtime import load_supernova_runtime, runtime_status


def _load_supernova_runtime():
    runtime = load_supernova_runtime()
    if not runtime.get('available'):
        exc = runtime.get('error')
        print(f'Warning: falling back to standalone backend mode: {exc}')
    return runtime

try:
    import auth_utils
except Exception:  # pragma: no cover - auth helpers may be unavailable in partial environments
    auth_utils = None


_runtime = _load_supernova_runtime()
SUPER_NOVA_AVAILABLE = _runtime['available']
SUPER_NOVA_STATUS = runtime_status(_runtime)
SUPER_NOVA_ERROR = _runtime.get('error')
SUPER_NOVA_CORE_APP = _runtime.get('core_app')
SUPER_NOVA_CORE_ROUTES = _runtime.get('core_routes') or []
DELETED_COMMENT_TEXT = "[deleted]"
LEGACY_SHA256_LENGTH = 64
PBKDF2_HASH_PREFIX = "pbkdf2_sha256"
PBKDF2_ITERATIONS = int(os.environ.get("PASSWORD_PBKDF2_ITERATIONS", "260000"))
SYSTEM_VOTE_QUESTION = os.environ.get(
    "SYSTEM_VOTE_QUESTION",
    "Should SuperNova prioritize AI rights as the next major research focus?",
)
SYSTEM_VOTE_DEADLINE = os.environ.get("SYSTEM_VOTE_DEADLINE", "2026-04-27T18:00:00-07:00")
PUBLIC_BASE_URL = (
    os.environ.get("SUPERNOVA_PUBLIC_URL")
    or os.environ.get("PUBLIC_BASE_URL")
    or os.environ.get("NEXT_PUBLIC_SITE_URL")
    or "https://2177.tech"
).rstrip("/")
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


def _parse_allowed_origins() -> Dict[str, Any]:
    raw = os.environ.get("ALLOWED_ORIGINS") or os.environ.get("BACKEND_ALLOWED_ORIGINS") or ""
    origins = [item.strip() for item in raw.replace("\n", ",").split(",") if item.strip()]
    if not origins:
        return {
            "origins": ["*"],
            "mode": "open_federation_default",
            "public_api_cors_open": True,
            "warning": "",
            "note": "Public non-cookie API access is open by design; identity is protected by tokens and server-side checks.",
        }
    if "*" in origins:
        return {
            "origins": ["*"],
            "mode": "open_federation_env",
            "public_api_cors_open": True,
            "warning": "",
            "note": "Wildcard CORS is explicitly configured for open federation; credentials remain disabled.",
        }
    return {
        "origins": origins,
        "mode": "allowlist",
        "public_api_cors_open": False,
        "warning": "",
        "note": "CORS is allowlisted by environment configuration. Use this only when intentionally running a private surface.",
    }


CORS_CONFIG = _parse_allowed_origins()
PUBLIC_FEDERATION_CACHE_HEADERS = {"Cache-Control": "public, max-age=300"}
NO_STORE_PREFIXES = (
    "/auth",
    "/messages",
    "/follows",
    "/api/ai",
    "/users/me",
    "/upload-image",
)
SUPERNOVA_INSTANCE_VERSION = "2026-04"

if SUPER_NOVA_AVAILABLE:
    SessionLocal = _runtime['session_local']
    get_db = _runtime['get_db']
    get_settings = _runtime['get_settings']
    weighted_decide = _runtime['weighted_decide']
    get_weighted_threshold = _runtime['get_weighted_threshold']
    tally_votes = _runtime['tally_votes']
    DB_ENGINE_URL = _runtime['db_engine_url']
    Proposal = _runtime['models']['Proposal']
    ProposalVote = _runtime['models']['ProposalVote']
    Comment = _runtime['models']['Comment']
    Decision = _runtime['models']['Decision']
    Run = _runtime['models']['Run']
    Harmonizer = _runtime['models']['Harmonizer']
    VibeNode = _runtime['models']['VibeNode']
    SystemState = _runtime['models']['SystemState']
else:
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///./supernova_local.db')
    engine = create_engine(
        DATABASE_URL,
        future=True,
        connect_args={'check_same_thread': False} if DATABASE_URL.startswith('sqlite') else {},
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    DB_ENGINE_URL = DATABASE_URL

    try:
        from db_models import (
            Base as SharedBase,
            Comment,
            Decision,
            Harmonizer,
            Proposal,
            ProposalVote,
            Run,
            SystemState,
            VibeNode,
        )

        SharedBase.metadata.create_all(bind=engine)
    except Exception as exc:
        print(f"Warning: could not initialize standalone database schema: {exc}")
        Proposal = ProposalVote = Comment = Decision = Run = Harmonizer = VibeNode = SystemState = None

    def get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    def weighted_decide(*_args, **_kwargs):
        return {'status': 'undecided', 'note': 'standalone mode'}

    def tally_votes(*_args, **_kwargs):
        return {'up': 0, 'down': 0, 'total': 0}

    def get_weighted_threshold(level: str = 'standard'):
        return 0.9 if str(level).lower() == 'important' else 0.6

    def get_settings():
        class Settings:
            DB_MODE = 'standalone'
            UNIVERSE_ID = 'standalone'
            SECRET_KEY = _fallback_secret_key_from_env()
            ALGORITHM = os.environ.get('ALGORITHM', 'HS256')

            @property
            def engine_url(self):
                return DB_ENGINE_URL

        return Settings()


CRUD_MODELS_AVAILABLE = all(
    model is not None for model in (Proposal, ProposalVote, Comment, Harmonizer, VibeNode)
)


def _is_legacy_sha256_hash(value: str) -> bool:
    candidate = (value or "").strip().lower()
    return len(candidate) == LEGACY_SHA256_LENGTH and all(char in "0123456789abcdef" for char in candidate)


def _b64encode_bytes(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _b64decode_bytes(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}".encode("ascii"))


def _hash_password_pbkdf2(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return f"{PBKDF2_HASH_PREFIX}${PBKDF2_ITERATIONS}${_b64encode_bytes(salt)}${_b64encode_bytes(digest)}"


def _verify_password_pbkdf2(password: str, hashed_password: str) -> bool:
    try:
        prefix, iterations, salt, digest = (hashed_password or "").split("$", 3)
        if prefix != PBKDF2_HASH_PREFIX:
            return False
        iteration_count = int(iterations)
        expected = _b64decode_bytes(digest)
        actual = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            _b64decode_bytes(salt),
            iteration_count,
        )
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


def _hash_password_strict(password: str) -> str:
    """Create new password hashes without falling back to unsalted SHA-256."""
    if auth_utils and hasattr(auth_utils, "pwd_context"):
        try:
            return auth_utils.pwd_context.hash(password)
        except Exception:
            pass
    return _hash_password_pbkdf2(password)


def _verify_password_with_legacy_upgrade(password: str, hashed_password: str) -> tuple[bool, bool]:
    stored_hash = (hashed_password or "").strip()
    if not stored_hash:
        return False, False
    if stored_hash.startswith(f"{PBKDF2_HASH_PREFIX}$"):
        return _verify_password_pbkdf2(password, stored_hash), False
    if _is_legacy_sha256_hash(stored_hash):
        return hashlib.sha256(password.encode()).hexdigest() == stored_hash.lower(), True
    if not auth_utils or not hasattr(auth_utils, "pwd_context"):
        return False, False
    try:
        return bool(auth_utils.pwd_context.verify(password, stored_hash)), False
    except Exception:
        return False, False
WORKFLOW_MODELS_AVAILABLE = all(
    model is not None for model in (Decision, Run)
)


def persist_weighted_vote_record(
    proposal_id: int, voter: str, choice: str, species: str = 'human'
):
    if ProposalVote is None:
        return {'ok': True, 'note': 'standalone mode'}

    try:
        session = SessionLocal()
        vote_entry = ProposalVote(
            proposal_id=proposal_id,
            harmonizer_id=voter,
            vote=choice,
            voter_type=species,
        )
        session.add(vote_entry)
        session.commit()
        return {'ok': True, 'proposal_id': proposal_id, 'voter': voter, 'choice': choice}
    except Exception as exc:
        return {'ok': False, 'error': str(exc)}
    finally:
        if 'session' in locals():
            session.close()
# --- FastAPI setup ---
app = FastAPI(
    title="SuperNova 2177 API",
    description="Backend API for SuperNova 2177 - Unified Version",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_CONFIG["origins"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def cache_control_middleware(request: Request, call_next):
    response = await call_next(request)
    if "cache-control" in response.headers:
        return response
    path = request.url.path
    if request.method not in {"GET", "HEAD"} or any(path.startswith(prefix) for prefix in NO_STORE_PREFIXES):
        response.headers["Cache-Control"] = "no-store"
    return response


uploads_dir = os.environ.get("UPLOADS_DIR") or os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")
if PROTOCOL_DIR.exists():
    app.mount("/protocol", StaticFiles(directory=str(PROTOCOL_DIR)), name="protocol")
if SUPER_NOVA_CORE_APP is not None:
    app.mount("/core", SUPER_NOVA_CORE_APP, name="supernova_core")

IMAGE_UPLOAD_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".bmp", ".heic", ".heif"}
VIDEO_UPLOAD_EXTENSIONS = {".mp4", ".webm", ".mov", ".m4v", ".ogg", ".ogv"}
CONTENT_TYPE_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/avif": ".avif",
    "image/bmp": ".bmp",
    "image/heic": ".heic",
    "image/heif": ".heif",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov",
    "video/ogg": ".ogv",
    "application/pdf": ".pdf",
    "application/json": ".json",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/vnd.ms-powerpoint": ".ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
    "text/csv": ".csv",
    "text/markdown": ".md",
    "text/plain": ".txt",
}
GENERIC_UPLOAD_TYPES = {"", "application/octet-stream", "binary/octet-stream"}
DOCUMENT_UPLOAD_EXTENSIONS = {
    ".csv",
    ".doc",
    ".docx",
    ".json",
    ".md",
    ".pdf",
    ".ppt",
    ".pptx",
    ".rtf",
    ".txt",
    ".xls",
    ".xlsx",
}


def _upload_limit_from_env(name: str, default: int) -> int:
    try:
        value = int(os.environ.get(name, ""))
    except (TypeError, ValueError):
        return default
    return value if value > 0 else default


UPLOAD_IMAGE_MAX_BYTES = _upload_limit_from_env("UPLOAD_IMAGE_MAX_BYTES", 10 * 1024 * 1024)
UPLOAD_AVATAR_MAX_BYTES = _upload_limit_from_env("UPLOAD_AVATAR_MAX_BYTES", UPLOAD_IMAGE_MAX_BYTES)
UPLOAD_VIDEO_MAX_BYTES = _upload_limit_from_env("UPLOAD_VIDEO_MAX_BYTES", 100 * 1024 * 1024)
UPLOAD_DOCUMENT_MAX_BYTES = _upload_limit_from_env("UPLOAD_DOCUMENT_MAX_BYTES", 25 * 1024 * 1024)
UPLOAD_COPY_CHUNK_BYTES = 1024 * 1024


def _safe_upload_extension(upload: UploadFile, fallback: str = "") -> str:
    raw_ext = os.path.splitext(upload.filename or "")[1].lower()
    if raw_ext and 1 < len(raw_ext) <= 12 and raw_ext[1:].replace("-", "").isalnum():
        return raw_ext
    return CONTENT_TYPE_EXTENSIONS.get((upload.content_type or "").lower(), fallback)


def _upload_matches(upload: UploadFile, prefix: str, allowed_extensions: set[str]) -> bool:
    content_type = (upload.content_type or "").lower()
    if content_type.startswith(prefix):
        return True
    return content_type in GENERIC_UPLOAD_TYPES and _safe_upload_extension(upload) in allowed_extensions


def _remove_partial_upload(path: str) -> None:
    try:
        if os.path.exists(path):
            os.remove(path)
    except OSError:
        pass


def _copy_upload_file_bounded(upload: UploadFile, file_path: str, max_bytes: int) -> None:
    written = 0
    try:
        upload.file.seek(0)
    except Exception:
        pass
    try:
        with open(file_path, "wb") as f:
            while True:
                chunk = upload.file.read(UPLOAD_COPY_CHUNK_BYTES)
                if not chunk:
                    break
                written += len(chunk)
                if written > max_bytes:
                    raise HTTPException(status_code=413, detail="Uploaded file is too large")
                f.write(chunk)
    except Exception:
        _remove_partial_upload(file_path)
        raise


def _save_upload_file(
    upload: UploadFile,
    allowed_extensions: Optional[set[str]] = None,
    fallback_ext: str = "",
    max_bytes: int = UPLOAD_DOCUMENT_MAX_BYTES,
) -> str:
    ext = _safe_upload_extension(upload, fallback_ext)
    if allowed_extensions is not None and ext not in allowed_extensions:
        ext = fallback_ext if fallback_ext in allowed_extensions else ""
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(uploads_dir, unique_name)
    _copy_upload_file_bounded(upload, file_path, max_bytes)
    return unique_name


def _format_timestamp(value) -> str:
    if not value:
        return ""
    if isinstance(value, datetime.datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=datetime.timezone.utc).isoformat().replace("+00:00", "Z")
        return value.astimezone(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    if isinstance(value, str):
        normalized = value.strip()
        if not normalized:
            return ""
        try:
            return datetime.datetime.fromisoformat(normalized.replace("Z", "+00:00")).isoformat()
        except Exception:
            return normalized
    isoformat = getattr(value, "isoformat", None)
    if callable(isoformat):
        try:
            return isoformat()
        except Exception:
            pass
    return str(value)


def _find_harmonizer_by_username(db: Session, username: Optional[str]):
    clean_username = (username or "").strip()
    if not clean_username or not CRUD_MODELS_AVAILABLE or Harmonizer is None:
        return None
    try:
        return (
            db.query(Harmonizer)
            .filter(func.lower(Harmonizer.username) == clean_username.lower())
            .first()
        )
    except Exception:
        return None


def _serialize_comment_record(db: Session, comment) -> Dict:
    author_obj = None
    if CRUD_MODELS_AVAILABLE and getattr(comment, "author_id", None):
        author_obj = db.query(Harmonizer).filter(Harmonizer.id == comment.author_id).first()

    user_name = (
        getattr(author_obj, "username", None)
        or getattr(comment, "user", None)
        or "Anonymous"
    )
    if author_obj is None:
        author_obj = _find_harmonizer_by_username(db, user_name)
    user_img = (
        getattr(author_obj, "profile_pic", None)
        or getattr(comment, "user_img", None)
        or ""
    )
    species = (
        getattr(author_obj, "species", None)
        or getattr(comment, "species", None)
        or "human"
    )
    content = getattr(comment, "content", None) or getattr(comment, "comment", None) or ""
    deleted = str(content or "").strip() == DELETED_COMMENT_TEXT

    return {
        "id": getattr(comment, "id", None),
        "proposal_id": getattr(comment, "proposal_id", None),
        "parent_comment_id": getattr(comment, "parent_comment_id", None),
        "user": "[deleted]" if deleted else user_name,
        "user_img": "" if deleted or user_img == "default.jpg" else user_img,
        "species": "human" if deleted else species,
        "comment": "This comment was deleted." if deleted else content,
        "deleted": deleted,
        "created_at": _format_timestamp(getattr(comment, "created_at", None)),
    }


def _ensure_comment_thread_columns(db: Session) -> None:
    try:
        if str(DB_ENGINE_URL or "").startswith("sqlite"):
            columns = db.execute(text("PRAGMA table_info(comments)")).fetchall()
            column_names = {getattr(column, "_mapping", column)["name"] for column in columns}
            if "parent_comment_id" not in column_names:
                db.execute(text("ALTER TABLE comments ADD COLUMN parent_comment_id INTEGER"))
                db.commit()
        else:
            db.execute(text("ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_comment_id INTEGER"))
            db.commit()
    except Exception:
        db.rollback()


def _is_deleted_comment_record(comment) -> bool:
    content = getattr(comment, "content", None) or getattr(comment, "comment", None) or ""
    return str(content or "").strip() == DELETED_COMMENT_TEXT


def _prune_empty_deleted_comment_ancestors(db: Session, parent_comment_id: Optional[int]) -> List[int]:
    pruned: List[int] = []
    current_parent_id = parent_comment_id
    while current_parent_id:
        if CRUD_MODELS_AVAILABLE:
            parent = db.query(Comment).filter(Comment.id == current_parent_id).first()
            if not parent or not _is_deleted_comment_record(parent):
                break
            child_count = db.query(Comment).filter(Comment.parent_comment_id == current_parent_id).count()
            if child_count:
                break
            next_parent_id = getattr(parent, "parent_comment_id", None)
            db.delete(parent)
            pruned.append(current_parent_id)
            current_parent_id = next_parent_id
            continue

        row = db.execute(
            text("SELECT * FROM comments WHERE id = :comment_id"),
            {"comment_id": current_parent_id},
        ).fetchone()
        if not row or not _is_deleted_comment_record(row):
            break
        child_count = db.execute(
            text("SELECT COUNT(*) FROM comments WHERE parent_comment_id = :comment_id"),
            {"comment_id": current_parent_id},
        ).scalar() or 0
        if child_count:
            break
        next_parent_id = getattr(row, "parent_comment_id", None)
        db.execute(text("DELETE FROM comments WHERE id = :comment_id"), {"comment_id": current_parent_id})
        pruned.append(current_parent_id)
        current_parent_id = next_parent_id
    return pruned


def _serialize_vote_record(db: Session, vote) -> tuple[Optional[Dict], Optional[Dict]]:
    voter_name = getattr(vote, "voter", None) or getattr(vote, "username", None)
    voter_type = getattr(vote, "voter_type", None) or getattr(vote, "species", None) or "human"

    if CRUD_MODELS_AVAILABLE and getattr(vote, "harmonizer_id", None):
        harmonizer_obj = db.query(Harmonizer).filter(Harmonizer.id == vote.harmonizer_id).first()
        if harmonizer_obj and hasattr(harmonizer_obj, "username"):
            voter_name = harmonizer_obj.username

    vote_field = getattr(vote, "vote", None)
    if vote_field is None:
        vote_field = getattr(vote, "choice", None)

    payload = {"voter": voter_name, "type": voter_type}
    if vote_field == "up":
        return payload, None
    if vote_field == "down":
        return None, payload
    return None, None


def _uploads_url(value: str) -> str:
    media = str(value or "").strip()
    if not media:
        return ""
    if media.startswith(("http://", "https://", "data:", "blob:", "/uploads/")):
        return media
    return f"/uploads/{media}"


def _image_urls_from_storage(value) -> List[str]:
    raw = str(value or "").strip()
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except Exception:
        parsed = None
    if isinstance(parsed, list):
        return [_uploads_url(item) for item in parsed if str(item or "").strip()]
    return [_uploads_url(raw)]


def _normalize_media_layout(value: Optional[str]) -> str:
    layout = str(value or "carousel").strip().lower()
    return "grid" if layout == "grid" else "carousel"


def _payload_dict(value) -> Dict:
    if isinstance(value, dict):
        return value
    if not value:
        return {}
    try:
        parsed = json.loads(value) if isinstance(value, str) else {}
    except Exception:
        parsed = {}
    return parsed if isinstance(parsed, dict) else {}


def _normalize_governance_kind(value: Optional[str]) -> str:
    kind = str(value or "post").strip().lower()
    return "decision" if kind in {"decision", "proposal", "governance"} else "post"


def _normalize_decision_level(value: Optional[str]) -> str:
    level = str(value or "standard").strip().lower()
    return "important" if level == "important" else "standard"


def _clamp_voting_days(value, default: int = 3) -> int:
    try:
        days = int(value)
    except Exception:
        days = default
    return max(1, min(days, 30))


def _governance_threshold(level: str) -> float:
    try:
        threshold = float(get_weighted_threshold(level))
    except Exception:
        threshold = 0.9 if level == "important" else 0.6
    return threshold


def _proposal_governance_payload(payload: Dict, voting_deadline_value=None) -> Optional[Dict]:
    if _normalize_governance_kind(
        payload.get("governance_kind") or payload.get("proposal_kind") or payload.get("kind")
    ) != "decision":
        return None
    level = _normalize_decision_level(payload.get("decision_level"))
    threshold = payload.get("approval_threshold")
    try:
        threshold = float(threshold)
    except Exception:
        threshold = _governance_threshold(level)
    deadline = voting_deadline_value or payload.get("voting_deadline")
    return {
        "kind": "decision",
        "decision_level": level,
        "approval_threshold": threshold,
        "threshold": threshold,
        "voting_days": _clamp_voting_days(payload.get("voting_days")),
        "voting_deadline": _format_timestamp(deadline),
        "execution_mode": "manual",
        "execution_status": str(payload.get("execution_status") or "pending_vote"),
    }


def _media_payload(
    image_value="",
    video_value="",
    link_value="",
    file_value="",
    payload_value=None,
    voting_deadline_value=None,
) -> Dict:
    images = _image_urls_from_storage(image_value)
    payload = _payload_dict(payload_value)
    return {
        "image": images[0] if images else "",
        "images": images,
        "video": _uploads_url(video_value),
        "link": link_value or "",
        "file": _uploads_url(file_value),
        "layout": _normalize_media_layout(payload.get("media_layout") or payload.get("mediaLayout")),
        "governance": _proposal_governance_payload(payload, voting_deadline_value),
    }


def _compute_vote_totals(db: Session, proposal_id: int) -> Dict[str, int]:
    up = 0
    down = 0

    if CRUD_MODELS_AVAILABLE:
        votes = db.query(ProposalVote).filter(ProposalVote.proposal_id == proposal_id).all()
        for vote in votes:
            if getattr(vote, "vote", None) == "up":
                up += 1
            elif getattr(vote, "vote", None) == "down":
                down += 1
        return {"up": up, "down": down}

    try:
        rows = db.execute(
            text("SELECT vote FROM proposal_votes WHERE proposal_id = :pid"),
            {"pid": proposal_id},
        ).fetchall()
        for row in rows:
            value = getattr(row, "vote", None) or row[0]
            if value == "up":
                up += 1
            elif value == "down":
                down += 1
    except Exception:
        pass

    return {"up": up, "down": down}


def _normalize_system_vote_choice(choice: str) -> str:
    value = (choice or "").strip().lower()
    if value in {"yes", "up", "like", "support"}:
        return "yes"
    if value in {"no", "down", "dislike", "oppose"}:
        return "no"
    raise HTTPException(status_code=400, detail="choice must be yes or no")


def _ensure_system_votes_table(db: Session) -> None:
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS system_votes (
            username TEXT PRIMARY KEY,
            choice TEXT NOT NULL,
            voter_type TEXT DEFAULT 'human',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """))
    db.commit()


def _serialize_system_vote_rows(rows, username: Optional[str] = None) -> Dict:
    requester = _safe_user_key(username or "")
    likes: List[Dict] = []
    dislikes: List[Dict] = []
    user_vote = None
    for row in rows:
        voter = getattr(row, "username", "") or ""
        voter_type = getattr(row, "voter_type", None) or "human"
        choice = _normalize_system_vote_choice(getattr(row, "choice", ""))
        entry = {"voter": voter, "type": voter_type}
        if choice == "yes":
            likes.append(entry)
            if requester and _safe_user_key(voter) == requester:
                user_vote = "like"
        else:
            dislikes.append(entry)
            if requester and _safe_user_key(voter) == requester:
                user_vote = "dislike"
    return {
        "question": SYSTEM_VOTE_QUESTION,
        "deadline": SYSTEM_VOTE_DEADLINE,
        "likes": likes,
        "dislikes": dislikes,
        "user_vote": user_vote,
        "total": len(likes) + len(dislikes),
    }


# --- Schemas (compat frontend) ---
class ProposalIn(BaseModel):
    title: str
    body: str
    author: str
    author_type: Optional[str] = ""
    author_img: Optional[str] = ""
    date: Optional[str] = ""
    image: Optional[str] = ""
    video: Optional[str] = ""
    link: Optional[str] = ""
    file: Optional[str] = ""

class ProposalSchema(BaseModel):
    model_config = {"arbitrary_types_allowed": True}
    id: int
    title: str
    text: str
    userName: str
    userInitials: str
    author_img: str
    time: str
    author_type: Optional[str] = ""
    profile_url: Optional[str] = ""
    domain_as_profile: Optional[bool] = False
    likes: List[Dict] = []
    dislikes: List[Dict] = []
    comments: List[Dict] = []
    media: Dict = {}

class VoteIn(BaseModel):
    proposal_id: int
    voter: str
    choice: str
    voter_type: str

class SystemVoteIn(BaseModel):
    username: str
    choice: str
    voter_type: Optional[str] = "human"

class DecisionSchema(BaseModel):
    id: int
    proposal_id: int
    status: str

class RunSchema(BaseModel):
    id: int
    decision_id: int
    status: str

class CommentIn(BaseModel):
    proposal_id: int
    user: str = "guest"
    user_img: str = ""
    species: Optional[str] = "human"
    comment: str
    parent_comment_id: Optional[int] = None


class CommentUpdateIn(BaseModel):
    user: str
    comment: str


class RegisterUserIn(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    species: Optional[str] = "human"
    bio: Optional[str] = ""


class SocialAuthSyncIn(BaseModel):
    provider: Optional[str] = "oauth"
    provider_id: Optional[str] = ""
    email: Optional[str] = None
    username: Optional[str] = None
    avatar_url: Optional[str] = None
    species: Optional[str] = None


def _find_social_user(db: Session, provider: str, provider_id: str, email: str):
    if Harmonizer is None:
        return None

    clean_email = (email or "").strip().lower()
    clean_provider = (provider or "oauth").strip().lower()
    clean_provider_id = (provider_id or "").strip()

    if clean_email:
        user = db.query(Harmonizer).filter(func.lower(Harmonizer.email) == clean_email).first()
        if user:
            return user

    if clean_provider_id:
        fallback_email = f"{clean_provider_id}@{clean_provider}.oauth.supernova"
        return db.query(Harmonizer).filter(func.lower(Harmonizer.email) == fallback_email.lower()).first()

    return None


class CredentialLoginIn(BaseModel):
    username: str
    password: str


class ProposalUpdateIn(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    author: Optional[str] = None


class ProfileUpdateIn(BaseModel):
    username: Optional[str] = None
    avatar_url: Optional[str] = None
    species: Optional[str] = None
    bio: Optional[str] = None
    domain_url: Optional[str] = None
    domain_as_profile: Optional[bool] = None


class DirectMessageIn(BaseModel):
    sender: str
    recipient: str
    body: str


class FollowIn(BaseModel):
    follower: str
    target: str


def _normalize_species(value: Optional[str]) -> str:
    species = (value or "human").strip().lower()
    if species not in {"human", "ai", "company"}:
        raise HTTPException(status_code=400, detail="Invalid species")
    return species


def _species_for_username(db: Session, username: str, fallback: Optional[str] = None) -> str:
    """Resolve species from the saved account before trusting browser payloads."""
    fallback_species = _normalize_species(fallback or "human")
    if Harmonizer is None or not username:
        return fallback_species

    user = db.query(Harmonizer).filter(func.lower(Harmonizer.username) == username.lower()).first()
    saved_species = getattr(user, "species", None) if user else None
    if saved_species in {"human", "ai", "company"}:
        return saved_species
    if user and not saved_species:
        user.species = fallback_species
        db.add(user)
    return fallback_species


def _public_user_payload(user, provider: str = "password") -> Dict[str, Any]:
    avatar_value = getattr(user, "profile_pic", "") or getattr(user, "avatar_url", "") or ""
    return {
        "id": getattr(user, "id", None),
        "username": getattr(user, "username", ""),
        "email": getattr(user, "email", ""),
        "provider": provider,
        "species": getattr(user, "species", "human"),
        "avatar_url": _social_avatar(avatar_value),
        "bio": getattr(user, "bio", "") or "",
        "harmony_score": str(getattr(user, "harmony_score", "0")),
        "creative_spark": str(getattr(user, "creative_spark", "0")),
    }


def _create_wrapper_access_token(username: str, expires_delta: Optional[timedelta] = None) -> Optional[str]:
    subject = (username or "").strip()
    if not subject or jwt is None:
        return None
    try:
        settings = get_settings()
        expire = datetime.datetime.utcnow() + (expires_delta or timedelta(minutes=15))
        return jwt.encode(
            {"sub": subject, "exp": expire},
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM,
        )
    except Exception:
        return None


def _create_optional_access_token(user) -> Optional[str]:
    return _create_wrapper_access_token(getattr(user, "username", "") or "")


def _auth_fields_for_user(user) -> Dict[str, str]:
    token = _create_optional_access_token(user)
    if not token:
        return {}
    return {"access_token": token, "token_type": "bearer"}


MESSAGES_STORE_PATH = BACKEND_DIR / "messages_store.json"
FOLLOWS_STORE_PATH = BACKEND_DIR / "follows_store.json"


def _safe_user_key(value: str) -> str:
    return (value or "").strip().lower()


def _conversation_id(user_a: str, user_b: str) -> str:
    return "::".join(sorted([_safe_user_key(user_a), _safe_user_key(user_b)]))


def _normalize_profile_url(value: Optional[str]) -> str:
    raw = (value or "").strip()
    if not raw:
        return ""
    if "://" not in raw:
        raw = f"https://{raw}"
    parsed = urlparse(raw)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(status_code=400, detail="Enter a valid http(s) domain or URL")
    return raw[:500]


def _ensure_profile_metadata_table(db: Session) -> None:
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS profile_metadata (
            username_key VARCHAR(255) PRIMARY KEY,
            username VARCHAR(255) NOT NULL,
            domain_url TEXT DEFAULT '',
            domain_as_profile BOOLEAN DEFAULT FALSE,
            updated_at VARCHAR(64) NOT NULL
        )
    """))
    db.commit()


def _coerce_profile_boolean(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    if isinstance(value, (int, float)):
        return bool(value)
    return str(value).strip().lower() in {"1", "true", "t", "yes", "on"}


def _profile_metadata(db: Session, username: str) -> Dict[str, Any]:
    key = _safe_user_key(username)
    if not key:
        return {"domain_url": "", "domain_as_profile": False}
    try:
        _ensure_profile_metadata_table(db)
        row = db.execute(
            text(
                "SELECT domain_url, domain_as_profile FROM profile_metadata "
                "WHERE username_key = :username_key"
            ),
            {"username_key": key},
        ).fetchone()
        if not row:
            return {"domain_url": "", "domain_as_profile": False}
        data = getattr(row, "_mapping", row)
        return {
            "domain_url": data["domain_url"] or "",
            "domain_as_profile": _coerce_profile_boolean(data["domain_as_profile"]),
        }
    except Exception:
        db.rollback()
        return {"domain_url": "", "domain_as_profile": False}


def _upsert_profile_metadata(
    db: Session,
    username: str,
    domain_url: Optional[str] = None,
    domain_as_profile: Optional[bool] = None,
) -> Dict[str, Any]:
    key = _safe_user_key(username)
    if not key:
        return {"domain_url": "", "domain_as_profile": False}
    current = _profile_metadata(db, username)
    next_domain = current.get("domain_url", "")
    if domain_url is not None:
        next_domain = _normalize_profile_url(domain_url)
    next_domain_as_profile = _coerce_profile_boolean(
        current.get("domain_as_profile", False) if domain_as_profile is None else domain_as_profile
    )
    if not next_domain:
        next_domain_as_profile = False

    _ensure_profile_metadata_table(db)
    now = datetime.datetime.utcnow().isoformat() + "Z"
    db.execute(
        text(
            "INSERT INTO profile_metadata "
            "(username_key, username, domain_url, domain_as_profile, updated_at) "
            "VALUES (:username_key, :username, :domain_url, :domain_as_profile, :updated_at) "
            "ON CONFLICT(username_key) DO UPDATE SET "
            "username = excluded.username, "
            "domain_url = excluded.domain_url, "
            "domain_as_profile = excluded.domain_as_profile, "
            "updated_at = excluded.updated_at"
        ),
        {
            "username_key": key,
            "username": username,
            "domain_url": next_domain,
            "domain_as_profile": next_domain_as_profile,
            "updated_at": now,
        },
    )
    db.commit()
    return {"domain_url": next_domain, "domain_as_profile": next_domain_as_profile}


def _rename_profile_metadata(db: Session, old_username: str, next_username: str) -> None:
    old_key = _safe_user_key(old_username)
    next_key = _safe_user_key(next_username)
    if not old_key or not next_key or old_key == next_key:
        return
    try:
        _ensure_profile_metadata_table(db)
        db.execute(
            text(
                "UPDATE profile_metadata SET username_key = :next_key, username = :next_username "
                "WHERE username_key = :old_key"
            ),
            {"next_key": next_key, "next_username": next_username, "old_key": old_key},
        )
        db.commit()
    except Exception:
        db.rollback()


def _read_messages_store() -> List[Dict[str, Any]]:
    if not MESSAGES_STORE_PATH.exists():
        return []
    try:
        raw = json.loads(MESSAGES_STORE_PATH.read_text(encoding="utf-8"))
        if isinstance(raw, dict):
            return raw.get("messages", []) if isinstance(raw.get("messages"), list) else []
        return raw if isinstance(raw, list) else []
    except Exception:
        return []


def _write_messages_store(messages: List[Dict[str, Any]]) -> None:
    MESSAGES_STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = MESSAGES_STORE_PATH.with_suffix(".tmp")
    tmp_path.write_text(json.dumps({"messages": messages}, ensure_ascii=True, indent=2), encoding="utf-8")
    tmp_path.replace(MESSAGES_STORE_PATH)


def _ensure_direct_messages_table(db: Session) -> None:
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS direct_messages (
            id VARCHAR(64) PRIMARY KEY,
            conversation_id VARCHAR(512) NOT NULL,
            sender VARCHAR(255) NOT NULL,
            recipient VARCHAR(255) NOT NULL,
            body TEXT NOT NULL,
            created_at VARCHAR(64) NOT NULL
        )
    """))
    db.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation "
        "ON direct_messages (conversation_id, created_at)"
    ))
    db.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_direct_messages_sender "
        "ON direct_messages (sender)"
    ))
    db.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_direct_messages_recipient "
        "ON direct_messages (recipient)"
    ))
    db.commit()


def _message_payload(row: Any) -> Dict[str, Any]:
    data = getattr(row, "_mapping", row)
    return {
        "id": data["id"],
        "conversation_id": data["conversation_id"],
        "sender": data["sender"],
        "recipient": data["recipient"],
        "body": data["body"],
        "created_at": data["created_at"],
    }


def _read_follows_store() -> List[Dict[str, Any]]:
    if not FOLLOWS_STORE_PATH.exists():
        return []
    try:
        raw = json.loads(FOLLOWS_STORE_PATH.read_text(encoding="utf-8"))
        if isinstance(raw, dict):
            return raw.get("follows", []) if isinstance(raw.get("follows"), list) else []
        return raw if isinstance(raw, list) else []
    except Exception:
        return []


def _write_follows_store(follows: List[Dict[str, Any]]) -> None:
    FOLLOWS_STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = FOLLOWS_STORE_PATH.with_suffix(".tmp")
    tmp_path.write_text(json.dumps({"follows": follows}, ensure_ascii=True, indent=2), encoding="utf-8")
    tmp_path.replace(FOLLOWS_STORE_PATH)


def _follow_counts(username: str) -> Dict[str, int]:
    key = _safe_user_key(username)
    if not key:
        return {"followers": 0, "following": 0}
    follows = _read_follows_store()
    return {
        "followers": len({item.get("follower_key") for item in follows if item.get("target_key") == key}),
        "following": len({item.get("target_key") for item in follows if item.get("follower_key") == key}),
    }


def _social_avatar(value: Optional[str]) -> str:
    if not value or value == "default.jpg":
        return ""
    if value.startswith("http://") or value.startswith("https://") or value.startswith("/"):
        return value
    return f"/uploads/{value}"


def _is_default_avatar(value: Optional[str]) -> bool:
    avatar = (value or "").strip()
    if not avatar:
        return True
    lower = avatar.lower()
    return (
        lower in {"default.jpg", "default-avatar.png", "/default-avatar.png", "/supernova.png"}
        or lower.endswith("/default-avatar.png")
        or lower.endswith("/supernova.png")
    )


def _is_uploaded_avatar(value: Optional[str]) -> bool:
    avatar = _social_avatar((value or "").strip()).lower()
    return avatar.startswith("/uploads/") or "/uploads/" in avatar


def _run_profile_sync(operation) -> None:
    sync_db = SessionLocal()
    try:
        operation(sync_db)
        sync_db.commit()
    except Exception:
        sync_db.rollback()
    finally:
        sync_db.close()


def _sync_user_avatar_references(
    db: Session,
    username: str,
    avatar_url: str,
    user_id: Optional[int] = None,
    aliases: Optional[List[str]] = None,
) -> None:
    clean_names: List[str] = []
    for value in [username, *(aliases or [])]:
        clean = (value or "").strip()
        key = _safe_user_key(clean)
        if clean and key not in {_safe_user_key(name) for name in clean_names}:
            clean_names.append(clean)

    if not clean_names and not user_id:
        return

    avatar_value = (avatar_url or "").strip()

    if CRUD_MODELS_AVAILABLE and Proposal is not None:
        def sync_proposal_model(sync_db: Session) -> None:
            filters = []
            if clean_names and hasattr(Proposal, "userName"):
                filters.append(func.lower(Proposal.userName).in_([name.lower() for name in clean_names]))
            if user_id and hasattr(Proposal, "author_id"):
                filters.append(Proposal.author_id == user_id)
            if filters and hasattr(Proposal, "author_img"):
                sync_db.query(Proposal).filter(or_(*filters)).update(
                    {"author_img": avatar_value},
                    synchronize_session=False,
                )
        _run_profile_sync(sync_proposal_model)

    for clean_username in clean_names:
        _run_profile_sync(lambda sync_db, name=clean_username: sync_db.execute(
            text("UPDATE proposals SET author_img = :avatar WHERE lower(userName) = lower(:username)"),
            {"avatar": avatar_value, "username": name},
        ))
        _run_profile_sync(lambda sync_db, name=clean_username: sync_db.execute(
            text("UPDATE comments SET user_img = :avatar WHERE lower(user) = lower(:username)"),
            {"avatar": avatar_value, "username": name},
        ))

    if user_id:
        _run_profile_sync(lambda sync_db: sync_db.execute(
            text("UPDATE proposals SET author_img = :avatar WHERE author_id = :user_id"),
            {"avatar": avatar_value, "user_id": user_id},
        ))
        _run_profile_sync(lambda sync_db: sync_db.execute(
            text("UPDATE comments SET user_img = :avatar WHERE author_id = :user_id"),
            {"avatar": avatar_value, "user_id": user_id},
        ))


def _sync_username_references(
    old_username: str,
    new_username: str,
    user_id: Optional[int] = None,
) -> None:
    old_name = (old_username or "").strip()
    new_name = (new_username or "").strip()
    old_key = _safe_user_key(old_name)
    new_key = _safe_user_key(new_name)
    if not old_key or not new_key or old_key == new_key:
        return

    new_initials = (new_name[:2].upper() if new_name else "SN")

    if CRUD_MODELS_AVAILABLE and Proposal is not None:
        def sync_proposal_model(sync_db: Session) -> None:
            filters = []
            if hasattr(Proposal, "userName"):
                filters.append(func.lower(Proposal.userName) == old_name.lower())
            if user_id and hasattr(Proposal, "author_id"):
                filters.append(Proposal.author_id == user_id)
            if filters:
                sync_db.query(Proposal).filter(or_(*filters)).update(
                    {"userName": new_name, "userInitials": new_initials},
                    synchronize_session=False,
                )
        _run_profile_sync(sync_proposal_model)

    _run_profile_sync(lambda sync_db: sync_db.execute(
        text("UPDATE proposals SET userName = :new_name, userInitials = :initials WHERE lower(userName) = lower(:old_name)"),
        {"new_name": new_name, "initials": new_initials, "old_name": old_name},
    ))
    if user_id:
        _run_profile_sync(lambda sync_db: sync_db.execute(
            text("UPDATE proposals SET userName = :new_name, userInitials = :initials WHERE author_id = :user_id"),
            {"new_name": new_name, "initials": new_initials, "user_id": user_id},
        ))
    _run_profile_sync(lambda sync_db: sync_db.execute(
        text("UPDATE comments SET user = :new_name WHERE lower(user) = lower(:old_name)"),
        {"new_name": new_name, "old_name": old_name},
    ))
    for column_name in ("voter", "username"):
        _run_profile_sync(lambda sync_db, column=column_name: sync_db.execute(
            text(f"UPDATE proposal_votes SET {column} = :new_name WHERE lower({column}) = lower(:old_name)"),
            {"new_name": new_name, "old_name": old_name},
        ))
    _run_profile_sync(lambda sync_db: sync_db.execute(
        text("UPDATE system_votes SET username = :new_name WHERE lower(username) = lower(:old_name)"),
        {"new_name": new_name, "old_name": old_name},
    ))

    def sync_direct_messages(sync_db: Session) -> None:
        try:
            rows = sync_db.execute(
                text(
                    "SELECT id, sender, recipient FROM direct_messages "
                    "WHERE lower(sender) = lower(:old_name) OR lower(recipient) = lower(:old_name)"
                ),
                {"old_name": old_name},
            ).fetchall()
            for row in rows:
                data = getattr(row, "_mapping", row)
                row_id = data["id"]
                current_sender = data["sender"]
                current_recipient = data["recipient"]
                sender = new_name if _safe_user_key(current_sender) == old_key else current_sender
                recipient = new_name if _safe_user_key(current_recipient) == old_key else current_recipient
                sync_db.execute(
                    text(
                        "UPDATE direct_messages SET sender = :sender, recipient = :recipient, "
                        "conversation_id = :conversation_id WHERE id = :id"
                    ),
                    {
                        "id": row_id,
                        "sender": sender,
                        "recipient": recipient,
                        "conversation_id": _conversation_id(sender, recipient),
                    },
                )
        except Exception:
            pass

    _run_profile_sync(sync_direct_messages)

    follows = _read_follows_store()
    follows_changed = False
    for item in follows:
        if item.get("follower_key") == old_key:
            item["follower"] = new_name
            item["follower_key"] = new_key
            follows_changed = True
        if item.get("target_key") == old_key:
            item["target"] = new_name
            item["target_key"] = new_key
            follows_changed = True
    if follows_changed:
        _write_follows_store(follows)

    messages = _read_messages_store()
    messages_changed = False
    for item in messages:
        item_changed = False
        if _safe_user_key(item.get("sender", "")) == old_key:
            item["sender"] = new_name
            item_changed = True
        if _safe_user_key(item.get("recipient", "")) == old_key:
            item["recipient"] = new_name
            item_changed = True
        if item_changed:
            item["conversation_id"] = _conversation_id(item.get("sender", ""), item.get("recipient", ""))
            messages_changed = True
    if messages_changed:
        _write_messages_store(messages)


def _sync_species_references(
    username: str,
    species: str,
    user_id: Optional[int] = None,
    aliases: Optional[List[str]] = None,
) -> None:
    clean_species = _normalize_species(species)
    clean_names: List[str] = []
    for value in [username, *(aliases or [])]:
        clean = (value or "").strip()
        key = _safe_user_key(clean)
        if clean and key not in {_safe_user_key(name) for name in clean_names}:
            clean_names.append(clean)
    if not clean_names and not user_id:
        return

    if CRUD_MODELS_AVAILABLE and Proposal is not None:
        def sync_proposal_species(sync_db: Session) -> None:
            filters = []
            if clean_names and hasattr(Proposal, "userName"):
                filters.append(func.lower(Proposal.userName).in_([name.lower() for name in clean_names]))
            if user_id and hasattr(Proposal, "author_id"):
                filters.append(Proposal.author_id == user_id)
            if filters and hasattr(Proposal, "author_type"):
                sync_db.query(Proposal).filter(or_(*filters)).update(
                    {"author_type": clean_species},
                    synchronize_session=False,
                )
        _run_profile_sync(sync_proposal_species)

    for clean_username in clean_names:
        _run_profile_sync(lambda sync_db, name=clean_username: sync_db.execute(
            text("UPDATE proposals SET author_type = :species WHERE lower(userName) = lower(:username)"),
            {"species": clean_species, "username": name},
        ))
        _run_profile_sync(lambda sync_db, name=clean_username: sync_db.execute(
            text("UPDATE comments SET species = :species WHERE lower(user) = lower(:username)"),
            {"species": clean_species, "username": name},
        ))
        _run_profile_sync(lambda sync_db, name=clean_username: sync_db.execute(
            text("UPDATE system_votes SET voter_type = :species WHERE lower(username) = lower(:username)"),
            {"species": clean_species, "username": name},
        ))

    if user_id:
        _run_profile_sync(lambda sync_db: sync_db.execute(
            text("UPDATE proposals SET author_type = :species WHERE author_id = :user_id"),
            {"species": clean_species, "user_id": user_id},
        ))

    now = datetime.datetime.utcnow()
    if CRUD_MODELS_AVAILABLE and Proposal is not None and ProposalVote is not None:
        def sync_active_vote_species(sync_db: Session) -> None:
            if not user_id or not hasattr(ProposalVote, "harmonizer_id"):
                return
            active_proposals = sync_db.query(Proposal.id).filter(
                or_(Proposal.voting_deadline.is_(None), Proposal.voting_deadline > now)
            )
            sync_db.query(ProposalVote).filter(
                ProposalVote.harmonizer_id == user_id,
                ProposalVote.proposal_id.in_(active_proposals),
            ).update({"voter_type": clean_species}, synchronize_session=False)
        _run_profile_sync(sync_active_vote_species)

    if user_id:
        _run_profile_sync(lambda sync_db: sync_db.execute(
            text(
                "UPDATE proposal_votes SET voter_type = :species "
                "WHERE harmonizer_id = :user_id "
                "AND proposal_id IN (SELECT id FROM proposals WHERE voting_deadline IS NULL OR voting_deadline > :now)"
            ),
            {"species": clean_species, "user_id": user_id, "now": now},
        ))
    for column_name in ("voter", "username"):
        for clean_username in clean_names:
            _run_profile_sync(lambda sync_db, column=column_name, name=clean_username: sync_db.execute(
                text(
                    f"UPDATE proposal_votes SET voter_type = :species "
                    f"WHERE lower({column}) = lower(:username) "
                    "AND proposal_id IN (SELECT id FROM proposals WHERE voting_deadline IS NULL OR voting_deadline > :now)"
                ),
                {"species": clean_species, "username": name, "now": now},
            ))


def _collect_social_users(db: Session, limit: int = 36, search: Optional[str] = None) -> List[Dict[str, Any]]:
    users: Dict[str, Dict[str, Any]] = {}
    search_term = (search or "").strip()
    search_filter = f"%{search_term}%" if search_term else ""

    def add_user(username: str, species: str = "human", avatar: str = "", post_id: Optional[int] = None):
        name = (username or "").strip()
        if not name:
            return
        key = name.lower()
        current = users.get(key, {
            "username": name,
            "initials": name[:2].upper(),
            "species": species or "human",
            "avatar": _social_avatar(avatar),
            "domain_url": "",
            "domain_as_profile": False,
            "post_count": 0,
            "latest_post_id": post_id or 0,
        })
        if not current.get("domain_url"):
            metadata = _profile_metadata(db, name)
            current["domain_url"] = metadata.get("domain_url", "")
            current["domain_as_profile"] = bool(metadata.get("domain_as_profile", False))
        current["post_count"] = int(current.get("post_count", 0)) + (1 if post_id else 0)
        current["latest_post_id"] = max(int(current.get("latest_post_id", 0)), int(post_id or 0))
        if not current.get("avatar") and avatar:
            current["avatar"] = _social_avatar(avatar)
        if species and current.get("species") == "human":
            current["species"] = species
        users[key] = current

    try:
        if Harmonizer is not None:
            harmonizer_query = db.query(Harmonizer)
            if search_filter:
                harmonizer_query = harmonizer_query.filter(Harmonizer.username.ilike(search_filter))
            for user in harmonizer_query.limit(limit).all():
                add_user(
                    getattr(user, "username", ""),
                    getattr(user, "species", "human"),
                    getattr(user, "profile_pic", "") or getattr(user, "avatar_url", ""),
                    None,
                )
    except Exception:
        pass

    try:
        if Proposal is not None:
            proposal_query = db.query(Proposal)
            if search_filter:
                proposal_query = proposal_query.filter(Proposal.userName.ilike(search_filter))
            rows = proposal_query.order_by(desc(Proposal.id)).limit(240).all()
            for row in rows:
                add_user(
                    getattr(row, "userName", None) or getattr(row, "author", "") or "Unknown",
                    getattr(row, "author_type", "human"),
                    getattr(row, "author_img", ""),
                    getattr(row, "id", 0),
                )
    except Exception:
        try:
            params: Dict[str, Any] = {}
            query_text = "SELECT id, userName, author_type, author_img FROM proposals"
            if search_filter:
                query_text += " WHERE LOWER(userName) LIKE LOWER(:search)"
                params["search"] = search_filter
            query_text += " ORDER BY id DESC LIMIT 240"
            rows = db.execute(text(query_text), params).fetchall()
            for row in rows:
                mapping = getattr(row, "_mapping", {})
                add_user(
                    getattr(row, "userName", None) or mapping.get("userName", ""),
                    getattr(row, "author_type", None) or mapping.get("author_type", "human"),
                    getattr(row, "author_img", None) or mapping.get("author_img", ""),
                    getattr(row, "id", None) or mapping.get("id", 0),
                )
        except Exception:
            pass

    return sorted(
        users.values(),
        key=lambda item: (int(item.get("latest_post_id", 0)), int(item.get("post_count", 0))),
        reverse=True,
    )[:limit]


def _build_status_payload(db: Session) -> Dict:
    total_harmonizers = 0
    total_vibenodes = 0
    total_proposals = 0
    total_comments = 0
    total_votes = 0

    try:
        if CRUD_MODELS_AVAILABLE:
            total_harmonizers = db.query(Harmonizer).count()
            total_vibenodes = db.query(VibeNode).count() if VibeNode is not None else 0
            total_proposals = db.query(Proposal).count()
            total_comments = db.query(Comment).count()
            total_votes = db.query(ProposalVote).count()
        else:
            total_harmonizers = db.execute(text("SELECT COUNT(*) FROM harmonizers")).scalar() or 0
            total_vibenodes = db.execute(text("SELECT COUNT(*) FROM vibenodes")).scalar() or 0
            total_proposals = db.execute(text("SELECT COUNT(*) FROM proposals")).scalar() or 0
            total_comments = db.execute(text("SELECT COUNT(*) FROM comments")).scalar() or 0
            total_votes = db.execute(text("SELECT COUNT(*) FROM proposal_votes")).scalar() or 0
    except Exception:
        pass

    return {
        "status": "online",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "metrics": {
            "total_harmonizers": int(total_harmonizers or 0),
            "total_vibenodes": int(total_vibenodes or total_proposals or 0),
            "community_wellspring": str((total_votes or 0) + (total_comments or 0)),
            "current_system_entropy": round(max(1.0, (total_proposals or 0) * 0.4 + (total_comments or 0) * 0.2), 2),
        },
        "mission": "To create order and meaning from chaos through collective resonance.",
    }


def _build_network_payload(db: Session, limit: int = 100) -> Dict:
    nodes: List[Dict] = []
    edges: List[Dict] = []
    seen_users: Dict[str, Dict] = {}

    proposals = []
    if CRUD_MODELS_AVAILABLE:
        proposals = (
            db.query(Proposal)
            .order_by(desc(Proposal.id))
            .limit(limit)
            .all()
        )
    else:
        proposals = db.execute(
            text(
                "SELECT id, title, userName, author_type, created_at "
                "FROM proposals ORDER BY id DESC LIMIT :limit"
            ),
            {"limit": limit},
        ).fetchall()

    for proposal in proposals:
        proposal_id = getattr(proposal, "id", None)
        username = getattr(proposal, "userName", None) or getattr(proposal, "author_username", None) or f"user-{proposal_id}"
        author_type = getattr(proposal, "author_type", None) or "human"
        user_id = f"user:{username}"
        proposal_node_id = f"proposal:{proposal_id}"

        if user_id not in seen_users:
            user_node = {
                "id": user_id,
                "label": username,
                "type": "harmonizer",
            }
            seen_users[user_id] = user_node
            nodes.append(user_node)

        nodes.append(
            {
                "id": proposal_node_id,
                "label": getattr(proposal, "title", None) or f"Proposal {proposal_id}",
                "type": "proposal",
                "echo": 0,
            }
        )
        edges.append(
            {
                "source": user_id,
                "target": proposal_node_id,
                "type": f"authored_by_{author_type}",
                "strength": 1,
            }
        )

    node_count = len(nodes)
    edge_count = len(edges)
    density = 0.0
    if node_count > 1:
        density = round(edge_count / (node_count * (node_count - 1)), 4)

    return {
        "nodes": nodes,
        "edges": edges,
        "metrics": {
            "node_count": node_count,
            "edge_count": edge_count,
            "density": density,
        },
    }


def _collect_author_nodes(db: Session, author_type: str, limit: int = 5) -> List[Dict]:
    nodes: List[Dict] = []
    try:
        if CRUD_MODELS_AVAILABLE:
            count_expr = func.count(Proposal.id)
            rows = (
                db.query(Proposal.userName, count_expr.label("posts"))
                .filter(Proposal.author_type == author_type)
                .group_by(Proposal.userName)
                .order_by(desc(count_expr))
                .limit(limit)
                .all()
            )
            for name, posts in rows:
                clean_name = (name or "").strip()
                if clean_name:
                    nodes.append({"name": clean_name, "posts": int(posts or 0), "type": author_type})
        else:
            rows = db.execute(
                text(
                    """
                    SELECT userName, COUNT(*) AS posts
                    FROM proposals
                    WHERE author_type = :author_type
                    GROUP BY userName
                    ORDER BY posts DESC
                    LIMIT :limit
                    """
                ),
                {"author_type": author_type, "limit": limit},
            ).fetchall()
            for row in rows:
                clean_name = str(getattr(row, "userName", "") or row[0] or "").strip()
                if clean_name:
                    nodes.append({"name": clean_name, "posts": int(getattr(row, "posts", 0) or row[1] or 0), "type": author_type})
    except Exception:
        nodes = []
    return nodes


def _build_supernova_menu_payload(db: Session, username: Optional[str] = None) -> Dict:
    status_payload = _build_status_payload(db)
    network_payload = _build_network_payload(db, limit=60)

    orgs = _collect_author_nodes(db, "company", limit=4)
    agents = _collect_author_nodes(db, "ai", limit=4)

    if not orgs:
        orgs = [
            {"name": "superNova 2177 Inc.", "posts": 0, "type": "company"},
            {"name": "AccessAI protocol node", "posts": 0, "type": "company"},
        ]
    if not agents:
        agents = [
            {"name": "Weighted Vote Agent", "posts": 0, "type": "ai"},
            {"name": "Network Resonance Agent", "posts": 0, "type": "ai"},
            {"name": "Remix Governance Agent", "posts": 0, "type": "ai"},
        ]

    return {
        "profile": {
            "username": username or "SuperNova harmonizer",
            "status": "online",
            "species_model": "AI x Humans x ORG",
        },
        "status": status_payload,
        "network": network_payload.get("metrics", {}),
        "orgs": orgs,
        "agents": agents,
        "capabilities": [
            {"key": "weighted_voting", "label": "Tri-species weighted voting", "available": True},
            {"key": "karma_system", "label": "Harmony and karma signals", "available": SUPER_NOVA_AVAILABLE},
            {"key": "network_analysis", "label": "Network resonance map", "available": True},
            {"key": "governance", "label": "Governance decisions and runs", "available": SUPER_NOVA_AVAILABLE},
            {"key": "remix_protocol", "label": "Fork/remix protocol hooks", "available": SUPER_NOVA_AVAILABLE},
        ],
    }

# --- Universe Info Endpoint ---
@app.get("/universe/info", tags=["System"])
def universe_info():
    """Return details about the current database configuration."""
    if not SUPER_NOVA_AVAILABLE:
        # Fallback response when SuperNova is not available
        return {
            "mode": "standalone",
            "engine": "sqlite:///fallback.db", 
            "universe_id": "standalone_universe",
            "note": "SuperNova integration not available"
        }
    
    try:
        s = get_settings()
        return {
            "mode": s.DB_MODE,
            "engine": DB_ENGINE_URL or s.engine_url,
            "universe_id": s.UNIVERSE_ID,
        }
    except Exception as e:
        return {
            "error": f"Failed to get universe info: {str(e)}",
            "mode": "error",
            "engine": "unknown",
            "universe_id": "error"
        }

# --- Health & Status ---
def _supernova_runtime_payload(include_routes: bool = True) -> Dict[str, Any]:
    payload = runtime_status(_runtime)
    payload["integration"] = "connected" if SUPER_NOVA_AVAILABLE else "disconnected"
    payload["mount_path"] = "/core" if payload.get("core_mounted") else None
    payload["wrapper_routes_stable"] = True
    if not include_routes:
        routes = payload.get("core_routes") or []
        payload["core_routes_sample"] = routes[:8]
        payload.pop("core_routes", None)
    return payload


def _cors_diagnostics() -> Dict[str, Any]:
    return {
        "cors_mode": CORS_CONFIG["mode"],
        "open_federation_mode": CORS_CONFIG["public_api_cors_open"],
        "cors_credentials": False,
        "allowed_origins_count": len(CORS_CONFIG["origins"]),
        "cors_warning": CORS_CONFIG["warning"],
        "cors_note": CORS_CONFIG["note"],
        "identity_model": "open public reads with token-checked writes; no cross-origin cookies",
    }


def _normalize_preview_domain(domain: str) -> str:
    candidate = (domain or "").strip().lower()
    if not candidate:
        raise HTTPException(status_code=400, detail="Domain is required")
    parsed = urlparse(candidate if "://" in candidate else f"https://{candidate}")
    host = (parsed.netloc or parsed.path or "").split("/")[0].split(":")[0].strip(".")
    if (
        not host
        or host in {"localhost", "127.0.0.1", "::1"}
        or "." not in host
        or any(char.isspace() for char in host)
    ):
        raise HTTPException(status_code=400, detail="Use a public domain such as example.com")
    return host


def _normalize_preview_username(username: str) -> str:
    clean_username = (username or "").strip()
    if not clean_username or any(char.isspace() for char in clean_username):
        raise HTTPException(status_code=400, detail="Username is required")
    return clean_username[:80]


@app.get("/.well-known/supernova", summary="Describe this SuperNova instance")
@app.get("/.well-known/supernova.json", summary="Describe this SuperNova instance")
def supernova_well_known():
    host = urlparse(PUBLIC_BASE_URL).netloc or "2177.tech"
    payload = {
        "service": "SuperNova 2177",
        "schema": "supernova.instance_manifest.v1",
        "version": SUPERNOVA_INSTANCE_VERSION,
        "public_base_url": PUBLIC_BASE_URL,
        "open_federation": True,
        "cors": {
            "public_reads": "*" if CORS_CONFIG["public_api_cors_open"] else "allowlist",
            "credentials": False,
            "mode": CORS_CONFIG["mode"],
        },
        "endpoints": {
            "health": f"{PUBLIC_BASE_URL}/health",
            "status": f"{PUBLIC_BASE_URL}/supernova-status",
            "webfinger": f"{PUBLIC_BASE_URL}/.well-known/webfinger?resource=acct:{{username}}@{host}",
            "profile_json": f"{PUBLIC_BASE_URL}/profile/{{username}}",
            "actor": f"{PUBLIC_BASE_URL}/actors/{{username}}",
            "outbox": f"{PUBLIC_BASE_URL}/actors/{{username}}/outbox",
            "portable_profile": f"{PUBLIC_BASE_URL}/u/{{username}}/export.json",
            "domain_verification_preview": f"{PUBLIC_BASE_URL}/domain-verification/preview?domain={{domain}}&username={{username}}",
        },
        "identity": {
            "local_handle": "username",
            "canonical_domain_field": "claimed_domain",
            "verified_domain_field": "verified_domain",
            "did_method": "did:web",
            "domain_verified_requires_proof": True,
        },
        "domain_verification": {
            "status": "planned",
            "claimed_domains_are_not_verified": True,
            "planned_methods": ["https_well_known", "dns_txt"],
            "https_well_known_path": "/.well-known/supernova",
            "dns_txt_label": "_supernova",
        },
        "federation": {
            "mode": "read_only_discovery",
            "activitypub_inbox": False,
            "webmention_receiver": False,
            "remote_feed_mutation": False,
        },
        "governance": {
            "species": ["human", "ai", "company"],
            "three_species_protocol": True,
            "decision_flow": [
                "proposal",
                "ai_explanation_or_simulation",
                "three_species_vote",
                "decision_record",
                "execution_intent",
                "company_or_human_ratification",
                "manual_execution",
            ],
            "execution_current_mode": "manual_preview_only",
            "company_ratification_required": True,
            "automatic_execution": False,
            "ai_execution_without_ratification": False,
        },
        "organization_integration": {
            "status": "planned",
            "manifest_path": "/.well-known/supernova",
            "domain_verification_required": True,
            "current_mode": "read_only_manifest",
            "automatic_execution": False,
            "company_webhooks": False,
            "allowed_actions": [],
        },
        "protocol_schemas": {
            "organization_manifest": f"{PUBLIC_BASE_URL}/protocol/supernova.organization.schema.json",
            "execution_intent": f"{PUBLIC_BASE_URL}/protocol/supernova.execution-intent.schema.json",
            "three_species_vote": f"{PUBLIC_BASE_URL}/protocol/supernova.three-species-vote.schema.json",
            "portable_profile": f"{PUBLIC_BASE_URL}/protocol/supernova.portable-profile.schema.json",
            "examples": f"{PUBLIC_BASE_URL}/protocol/examples/",
        },
        "protocol_examples": {
            "organization_manifest": f"{PUBLIC_BASE_URL}/protocol/examples/example-organization-manifest.json",
            "execution_intent": f"{PUBLIC_BASE_URL}/protocol/examples/example-execution-intent.json",
            "three_species_vote": f"{PUBLIC_BASE_URL}/protocol/examples/example-three-species-vote.json",
            "portable_profile": f"{PUBLIC_BASE_URL}/protocol/examples/example-portable-profile.json",
        },
        "schema_version_policy": {
            "current_version": "v1",
            "v1_execution_posture": "manual_preview_only",
            "v1_automatic_execution": False,
            "v1_company_webhooks": False,
            "breaking_changes_require_new_schema_version": True,
        },
        "public_data_policy": {
            "public_exports_only": True,
            "excluded_fields": [
                "email",
                "password_hash",
                "access_token",
                "refresh_token",
                "direct_messages",
                "private_message_metadata",
                "secrets",
                "admin_state",
                "debug_state",
            ],
        },
    }
    return JSONResponse(payload, headers=PUBLIC_FEDERATION_CACHE_HEADERS)


@app.get("/domain-verification/preview", summary="Preview domain verification instructions")
def domain_verification_preview(domain: str = Query(...), username: str = Query(...)):
    host = _normalize_preview_domain(domain)
    clean_username = _normalize_preview_username(username)
    profile_url = f"{PUBLIC_BASE_URL}/users/{clean_username}"
    actor_url = f"{PUBLIC_BASE_URL}/actors/{clean_username}"
    well_known_url = f"https://{host}/.well-known/supernova"
    return JSONResponse(
        {
            "schema": "supernova.domain_verification_preview.v1",
            "status": "preview_only",
            "does_not_verify_yet": True,
            "domain": host,
            "username": clean_username,
            "methods": {
                "https_well_known": {
                    "url": well_known_url,
                    "expected_example": {
                        "schema": "supernova.organization_manifest.v1",
                        "manifest_type": "organization",
                        "organization": {
                            "name": clean_username,
                            "domain": host,
                            "canonical_actor": actor_url,
                            "supernova_profile": profile_url,
                        },
                        "governance": {
                            "three_species_protocol": True,
                            "species": ["human", "ai", "company"],
                            "equal_species_weight": True,
                            "company_ratification_required": True,
                            "human_supervision_required": True,
                        },
                        "execution": {
                            "current_mode": "manual_only",
                            "automatic_execution": False,
                            "webhooks_enabled": False,
                            "allowed_actions": [],
                        },
                        "value_sharing": {
                            "status": "not_financial_protocol",
                            "company_side_policy_required": True,
                            "supernova_nonprofit_does_not_custody_funds": True,
                        },
                    },
                },
                "dns_txt": {
                    "name": f"_supernova.{host}",
                    "value": f"supernova-profile={profile_url}",
                },
            },
            "safety": {
                "external_fetch": False,
                "dns_lookup": False,
                "database_write": False,
                "marks_domain_verified": False,
            },
        },
        headers=PUBLIC_FEDERATION_CACHE_HEADERS,
    )


@app.get("/health", summary="Check API health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        db_status = "disconnected"
    
    supernova_runtime = _supernova_runtime_payload(include_routes=False)
    return {
        "ok": True,
        "database": db_status,
        "database_engine": DB_ENGINE_URL,
        **_cors_diagnostics(),
        "supernova_integration": supernova_runtime["integration"],
        "supernova": supernova_runtime,
        "timestamp": datetime.datetime.now().isoformat()
    }

@app.get("/universe", summary="Get simplified universe state")
def get_universe_state():
    """
    Returns a mock representation of the current universe graph,
    including proposals, decisions, and links.
    """
    return {
        "nodes": [
            {"id": "u1", "label": "Proposal A", "type": "proposal", "votes": {"human": 12, "company": 5, "ai": 2}},
            {"id": "u2", "label": "Decision B", "type": "decision", "votes": {"human": 4, "company": 10, "ai": 1}},
        ],
        "links": [
            {"source": "u1", "target": "u2"},
        ]
    }
   
@app.get("/supernova-status", summary="Check SuperNova integration status")
def supernova_status():
    supernova_runtime = _supernova_runtime_payload(include_routes=True)
    return {
        "supernova_connected": SUPER_NOVA_AVAILABLE,
        "supernova": supernova_runtime,
        "database_engine": DB_ENGINE_URL,
        **_cors_diagnostics(),
        "features_available": {
            "weighted_voting": SUPER_NOVA_AVAILABLE,
            "karma_system": SUPER_NOVA_AVAILABLE,
            "governance": SUPER_NOVA_AVAILABLE,
            "core_routes": bool(SUPER_NOVA_CORE_ROUTES),
            "search_filters": True,
            "advanced_sorting": True
        }
    }


@app.get("/status", tags=["System"])
def get_status(db: Session = Depends(get_db)):
    return _build_status_payload(db)


@app.get("/network-analysis/", tags=["System"])
def get_network_analysis(limit: int = Query(100, ge=1, le=500), db: Session = Depends(get_db)):
    return _build_network_payload(db, limit=limit)


@app.get("/supernova-menu", tags=["System"])
def get_supernova_menu(username: Optional[str] = Query(None), db: Session = Depends(get_db)):
    return _build_supernova_menu_payload(db, username=username)


@app.post("/users/register", tags=["Harmonizers"])
def register_user(payload: RegisterUserIn, db: Session = Depends(get_db)):
    if Harmonizer is None:
        raise HTTPException(status_code=503, detail="User system unavailable")

    username = payload.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")

    species = _normalize_species(payload.species)
    existing = db.query(Harmonizer).filter(func.lower(Harmonizer.username) == username.lower()).first()
    if existing:
        raise HTTPException(status_code=409, detail="Username already exists")

    email = (payload.email or "").strip().lower()
    if not email or "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="A valid email is required")
    email_owner = db.query(Harmonizer).filter(func.lower(Harmonizer.email) == email).first()
    if email_owner:
        raise HTTPException(status_code=409, detail="Email already exists")

    if not payload.password:
        raise HTTPException(status_code=400, detail="Password is required")

    hashed_password = _hash_password_strict(payload.password)

    user = Harmonizer(
        username=username,
        email=email,
        hashed_password=hashed_password,
        species=species,
        bio=payload.bio or "",
        profile_pic="default.jpg",
        is_active=True,
        consent_given=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "species": user.species,
        "harmony_score": str(getattr(user, "harmony_score", "100.0")),
        "creative_spark": str(getattr(user, "creative_spark", "1000000.0")),
        "network_centrality": float(getattr(user, "network_centrality", 0.0)),
        "bio": getattr(user, "bio", ""),
    }


@app.post("/auth/login", tags=["Auth"])
def credential_login(payload: CredentialLoginIn, db: Session = Depends(get_db)):
    if Harmonizer is None:
        raise HTTPException(status_code=503, detail="User system unavailable")

    username = payload.username.strip()
    password = payload.password
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password are required")

    user = db.query(Harmonizer).filter(func.lower(Harmonizer.username) == username.lower()).first()
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    hashed_password = getattr(user, "hashed_password", "") or ""
    verified, legacy_sha = _verify_password_with_legacy_upgrade(password, hashed_password)

    if not verified:
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    if not getattr(user, "is_active", True):
        raise HTTPException(status_code=400, detail="Inactive user")

    if legacy_sha:
        try:
            user.hashed_password = _hash_password_strict(password)
            db.add(user)
            db.commit()
            db.refresh(user)
        except HTTPException:
            db.rollback()

    token = _create_wrapper_access_token(user.username) or uuid.uuid4().hex

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": _public_user_payload(user, provider="password"),
    }


@app.get("/auth/social/profile", tags=["Auth"])
def get_social_auth_profile(
    provider: Optional[str] = Query("oauth"),
    provider_id: Optional[str] = Query(""),
    email: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    user = _find_social_user(db, provider or "oauth", provider_id or "", email or "")
    if not user:
        return {"exists": False}
    return {
        "exists": True,
        **_public_user_payload(user, provider=(provider or "oauth").strip().lower()),
    }


@app.post("/auth/social/sync", tags=["Auth"])
def sync_social_auth(payload: SocialAuthSyncIn, db: Session = Depends(get_db)):
    provider = (payload.provider or "oauth").strip().lower()
    provider_id = (payload.provider_id or "").strip()
    email = (payload.email or "").strip().lower()
    username = (
        (payload.username or "").strip()
        or (email.split("@", 1)[0] if email else "")
        or f"{provider}-{provider_id[:8] or uuid.uuid4().hex[:8]}"
    )
    avatar_url = (payload.avatar_url or "").strip()
    species = None
    if payload.species:
        try:
            species = _normalize_species(payload.species)
        except HTTPException:
            species = None

    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    if not email:
        email = f"{provider_id or uuid.uuid4().hex}@{provider}.oauth.supernova"

    if Harmonizer is None:
        return {
            "id": None,
            "username": username,
            "email": email,
            "provider": provider,
            "species": species or "human",
            "avatar_url": _social_avatar(avatar_url),
            "backend": "fallback",
        }

    existing = _find_social_user(db, provider, provider_id, email)
    if not existing:
        existing = db.query(Harmonizer).filter(func.lower(Harmonizer.username) == username.lower()).first()

    if existing:
        avatar_to_sync = ""
        existing_avatar = getattr(existing, "profile_pic", "") or getattr(existing, "avatar_url", "") or ""
        should_update_avatar = bool(avatar_url) and (
            _is_default_avatar(existing_avatar)
            or (_is_uploaded_avatar(avatar_url) and not _is_uploaded_avatar(existing_avatar))
        )
        if should_update_avatar:
            existing.profile_pic = avatar_url
            avatar_to_sync = avatar_url
        if not getattr(existing, "species", None):
            existing.species = species or "human"
        existing.is_active = True
        existing.consent_given = True
        db.add(existing)
        db.commit()
        db.refresh(existing)
        if avatar_to_sync:
            _sync_user_avatar_references(db, existing.username, avatar_to_sync, getattr(existing, "id", None))
        return {
            "id": existing.id,
            "username": existing.username,
            "email": existing.email,
            "provider": provider,
            "species": existing.species,
            "avatar_url": _social_avatar(getattr(existing, "profile_pic", "") or avatar_url),
            "backend": "supernovacore",
            **_auth_fields_for_user(existing),
        }

    candidate = username
    suffix = 2
    while db.query(Harmonizer).filter(func.lower(Harmonizer.username) == candidate.lower()).first():
        candidate = f"{username}-{suffix}"
        suffix += 1

    raw_secret = f"{provider}:{provider_id or email}:{candidate}"
    hashed_password = _hash_password_strict(raw_secret)

    user = Harmonizer(
        username=candidate,
        email=email,
        hashed_password=hashed_password,
        species=species or "human",
        bio=f"Signed in with {provider}.",
        profile_pic=avatar_url or "default.jpg",
        is_active=True,
        consent_given=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "provider": provider,
        "species": user.species,
        "avatar_url": _social_avatar(getattr(user, "profile_pic", "")),
        "backend": "supernovacore",
        **_auth_fields_for_user(user),
    }

#
@app.get("/debug-supernova")
def debug_supernova():
    if os.environ.get("SUPERNOVA_ENV", "development") == "production":
        raise HTTPException(status_code=404, detail="Not found")
    return {
        "supernova_available": SUPER_NOVA_AVAILABLE,
        "supernova": _supernova_runtime_payload(include_routes=True),
        "python_path": sys.path,
        "current_dir": os.getcwd(),
        "dir_contents": os.listdir('.'),
        "supernova_dir": str(SUPER_NOVA_DIR),
        "supernova_dir_exists": SUPER_NOVA_DIR.exists()
    }

@app.get("/debug/search-test")
def debug_search(search: str = Query(...), db: Session = Depends(get_db)):
    if os.environ.get("SUPERNOVA_ENV", "development") == "production":
        raise HTTPException(status_code=404, detail="Not found")
    try:
        if CRUD_MODELS_AVAILABLE:
            results = db.query(Proposal).filter(
                or_(
                    Proposal.title.ilike(f"%{search}%"),
                    Proposal.description.ilike(f"%{search}%"),
                    Proposal.userName.ilike(f"%{search}%")
                )
            ).limit(5).all()
            
            return {
                "search_term": search,
                "found_proposals": len(results),
                "results": [
                    {"id": r.id, "title": r.title, "author": r.userName} 
                    for r in results
                ],
                "method": "orm"
            }
        else:
            result = db.execute(
                text(
                    "SELECT id, title, userName FROM proposals "
                    "WHERE title ILIKE :search OR description ILIKE :search OR userName ILIKE :search "
                    "LIMIT 5"
                ),
                {"search": f"%{search}%"}
            )
            rows = result.fetchall()
            
            return {
                "search_term": search,
                "found_proposals": len(rows),
                "results": [dict(row) for row in rows],
                "method": "sql"
            }
    except Exception as e:
        return {"error": str(e), "query_working": False}

#
@app.get("/profile/{username}", summary="Get user profile")
def profile(username: str, db: Session = Depends(get_db)):
    try:
        if Harmonizer is not None:
            user = db.query(Harmonizer).filter(func.lower(Harmonizer.username) == username.lower()).first()
            if user:
                avatar_value = getattr(user, "profile_pic", "") or getattr(user, "avatar_url", "") or ""
                follow_counts = _follow_counts(user.username)
                metadata = _profile_metadata(db, user.username)
                return {
                    "username": user.username,
                    "avatar_url": _social_avatar(avatar_value),
                    "bio": user.bio or "",
                    "domain_url": metadata.get("domain_url", ""),
                    "domain_as_profile": bool(metadata.get("domain_as_profile", False)),
                    "followers": follow_counts["followers"],
                    "following": follow_counts["following"],
                    "status": "online",
                    "karma": float(getattr(user, 'karma_score', 0)),
                    "harmony_score": float(getattr(user, 'harmony_score', 0)),
                    "creative_spark": float(getattr(user, 'creative_spark', 0)),
                    "species": getattr(user, 'species', 'human')
                }
    except Exception as e:
        print(f"Error fetching SuperNova profile: {e}")

    try:
        if Proposal is not None:
            latest = (
                db.query(Proposal)
                .filter(func.lower(Proposal.userName) == username.lower())
                .order_by(desc(Proposal.id))
                .first()
            )
            post_count = db.query(Proposal).filter(func.lower(Proposal.userName) == username.lower()).count()
            if latest:
                follow_counts = _follow_counts(username)
                metadata = _profile_metadata(db, username)
                signal_harmony = min(
                    100.0,
                    float(post_count or 0) * 6.0
                    + float(follow_counts.get("followers", 0) or 0) * 1.2
                    + float(follow_counts.get("following", 0) or 0) * 0.25,
                )
                return {
                    "username": username,
                    "avatar_url": _social_avatar(getattr(latest, "author_img", "")),
                    "bio": "",
                    "domain_url": metadata.get("domain_url", ""),
                    "domain_as_profile": bool(metadata.get("domain_as_profile", False)),
                    "followers": follow_counts["followers"],
                    "following": follow_counts["following"],
                    "status": "online",
                    "karma": float(post_count or 0),
                    "harmony_score": signal_harmony,
                    "creative_spark": float(post_count or 0) * 10.0,
                    "species": getattr(latest, "author_type", "human"),
                    "post_count": post_count,
                }
    except Exception as e:
        print(f"Error fetching fallback profile from proposals: {e}")

    # Fallback
    return {
        "username": username,
        "avatar_url": "",
        "bio": "",
        "domain_url": "",
        "domain_as_profile": False,
        "followers": 2315,
        "following": 1523,
        "status": "online"
    }


def _public_profile_url(username: str) -> str:
    return f"{PUBLIC_BASE_URL}/users/{username}"


def _public_actor_url(username: str) -> str:
    return f"{PUBLIC_BASE_URL}/actors/{username}"


def _username_from_webfinger_resource(resource: str) -> str:
    raw = unquote((resource or "").strip())
    if raw.startswith("acct:"):
        handle = raw[5:]
        return handle.split("@", 1)[0].strip()
    parsed = urlparse(raw)
    parts = [part for part in parsed.path.split("/") if part]
    for marker in ("users", "u", "actors"):
        if marker in parts:
            idx = parts.index(marker)
            if idx + 1 < len(parts):
                return parts[idx + 1].strip()
    return raw.strip()


def _profile_exists(db: Session, username: str) -> bool:
    clean_username = (username or "").strip()
    if not clean_username:
        return False
    try:
        if Harmonizer is not None:
            user = db.query(Harmonizer).filter(func.lower(Harmonizer.username) == clean_username.lower()).first()
            if user:
                return True
        if Proposal is not None:
            return bool(
                db.query(Proposal)
                .filter(func.lower(Proposal.userName) == clean_username.lower())
                .first()
            )
    except Exception:
        return False
    return False


def _domain_did(domain_url: str) -> str:
    parsed = urlparse(domain_url or "")
    host = (parsed.hostname or "").strip().lower()
    if not host:
        return ""
    return f"did:web:{host}"


def _profile_identity_payload(db: Session, username: str) -> Dict[str, Any]:
    profile_payload = profile(username, db)
    clean_username = (profile_payload.get("username") or username or "").strip()
    claimed_domain_url = (profile_payload.get("domain_url") or "").strip()
    domain_as_profile = bool(profile_payload.get("domain_as_profile", False))
    local_profile_url = _public_profile_url(clean_username)
    canonical_url = claimed_domain_url if claimed_domain_url and domain_as_profile else local_profile_url
    verification_template = {}
    if claimed_domain_url:
        verification_template = {
            "supernova_profile": local_profile_url,
            "owner": clean_username,
            "claimed_domain": claimed_domain_url,
        }
    return {
        "username": clean_username,
        "display_name": clean_username,
        "species": profile_payload.get("species", "human"),
        "bio": profile_payload.get("bio", ""),
        "avatar_url": profile_payload.get("avatar_url", ""),
        "local_profile_url": local_profile_url,
        "canonical_url": canonical_url,
        "canonical_url_source": "claimed_domain" if claimed_domain_url and domain_as_profile else "supernova",
        "canonical_url_verified": False,
        "domain_url": claimed_domain_url,
        "claimed_domain": claimed_domain_url,
        "claimed_domain_url": claimed_domain_url,
        "domain_as_profile": domain_as_profile,
        "domain_verified": False,
        "verified_domain": "",
        "verified_domain_url": "",
        "verified_at": None,
        "verification_method": None,
        "did": _domain_did(claimed_domain_url),
        "actor_url": _public_actor_url(clean_username),
        "portable_export_url": f"{PUBLIC_BASE_URL}/u/{clean_username}/export.json",
        "verification_file": "/.well-known/supernova.json",
        "verification_template": verification_template,
    }


@app.get("/.well-known/webfinger", summary="Discover a public SuperNova profile")
def webfinger(resource: str = Query(...), db: Session = Depends(get_db)):
    username = _username_from_webfinger_resource(resource)
    if not _profile_exists(db, username):
        raise HTTPException(status_code=404, detail="Profile not found")
    identity = _profile_identity_payload(db, username)
    aliases = [identity["local_profile_url"]]
    if identity.get("domain_url"):
        aliases.append(identity["domain_url"])
    payload = {
        "subject": f"acct:{identity['username']}@{urlparse(PUBLIC_BASE_URL).netloc or '2177.tech'}",
        "aliases": aliases,
        "links": [
            {
                "rel": "self",
                "type": "application/activity+json",
                "href": identity["actor_url"],
            },
            {
                "rel": "http://webfinger.net/rel/profile-page",
                "href": identity["local_profile_url"],
            },
            {
                "rel": "https://supernova2177.org/rel/portable-profile",
                "type": "application/json",
                "href": identity["portable_export_url"],
            },
        ],
    }
    return JSONResponse(
        payload,
        media_type="application/jrd+json",
        headers=PUBLIC_FEDERATION_CACHE_HEADERS,
    )


@app.get("/actors/{username}", summary="Read-only ActivityStreams actor profile")
def actor_profile(username: str, db: Session = Depends(get_db)):
    if not _profile_exists(db, username):
        raise HTTPException(status_code=404, detail="Profile not found")
    identity = _profile_identity_payload(db, username)
    species = (identity.get("species") or "human").lower()
    actor_type = "Organization" if species == "company" else "Service" if species == "ai" else "Person"
    actor: Dict[str, Any] = {
        "@context": "https://www.w3.org/ns/activitystreams",
        "id": identity["actor_url"],
        "type": actor_type,
        "preferredUsername": identity["username"],
        "name": identity["display_name"],
        "summary": identity.get("bio", ""),
        "url": identity["canonical_url"],
        "outbox": f"{identity['actor_url']}/outbox",
        "supernova": {
            "species": identity["species"],
            "local_profile_url": identity["local_profile_url"],
            "claimed_domain": identity["claimed_domain"],
            "domain_url": identity["domain_url"],
            "domain_as_profile": identity["domain_as_profile"],
            "domain_verified": identity["domain_verified"],
            "verified_domain": identity["verified_domain"],
            "did": identity["did"],
        },
    }
    if identity.get("avatar_url"):
        actor["icon"] = {"type": "Image", "url": identity["avatar_url"]}
    if identity.get("domain_url"):
        actor["alsoKnownAs"] = [identity["domain_url"]]
    return JSONResponse(
        actor,
        media_type="application/activity+json",
        headers=PUBLIC_FEDERATION_CACHE_HEADERS,
    )


@app.get("/actors/{username}/outbox", summary="Read-only public proposal outbox")
def actor_outbox(
    username: str,
    limit: int = Query(40, ge=1, le=100),
    db: Session = Depends(get_db),
):
    if not _profile_exists(db, username):
        raise HTTPException(status_code=404, detail="Profile not found")
    identity = _profile_identity_payload(db, username)
    proposals = list_proposals(
        filter="latest",
        search=None,
        author=identity["username"],
        before_id=None,
        limit=limit,
        offset=0,
        db=db,
    )
    items = []
    for item in proposals:
        pid = item.get("id")
        object_url = f"{PUBLIC_BASE_URL}/proposals/{pid}"
        items.append({
            "id": f"{object_url}#create",
            "type": "Create",
            "actor": identity["actor_url"],
            "object": {
                "id": object_url,
                "type": "Note",
                "attributedTo": identity["actor_url"],
                "name": item.get("title", ""),
                "content": item.get("text", ""),
                "url": object_url,
            },
        })
    return JSONResponse(
        {
            "@context": "https://www.w3.org/ns/activitystreams",
            "id": f"{identity['actor_url']}/outbox",
            "type": "OrderedCollection",
            "totalItems": len(items),
            "orderedItems": items,
        },
        media_type="application/activity+json",
        headers=PUBLIC_FEDERATION_CACHE_HEADERS,
    )


@app.get("/api/users/{username}/portable-profile", summary="Export a public portable profile")
@app.get("/u/{username}/export.json", summary="Export a public portable profile")
def portable_profile(
    username: str,
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
):
    if not _profile_exists(db, username):
        raise HTTPException(status_code=404, detail="Profile not found")
    identity = _profile_identity_payload(db, username)
    public_posts = list_proposals(
        filter="latest",
        search=None,
        author=identity["username"],
        before_id=None,
        limit=limit,
        offset=0,
        db=db,
    )
    return JSONResponse({
        "schema": "supernova.portable_profile.v1",
        "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
        "identity": identity,
        "profile": profile(identity["username"], db),
        "public_posts": public_posts,
        "governance": {
            "species_model": "three_species_equal_vote",
            "human_supervision_required": True,
            "execution_current_mode": "manual_preview_only",
            "automatic_execution": False,
        },
        "privacy": {
            "public_export_only": True,
            "excluded_fields": [
                "email",
                "password_hash",
                "access_token",
                "refresh_token",
                "direct_messages",
                "private_message_metadata",
                "secrets",
                "admin_state",
                "debug_state",
            ],
        },
        "limits": {"public_posts": limit},
    }, headers=PUBLIC_FEDERATION_CACHE_HEADERS)


@app.patch("/profile/{username}", summary="Update a user profile")
def update_profile(
    username: str,
    payload: ProfileUpdateIn,
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    if Harmonizer is None:
        raise HTTPException(status_code=503, detail="User system unavailable")

    clean_username = username.strip()
    if not clean_username:
        raise HTTPException(status_code=400, detail="Username is required")
    _require_token_identity_match(authorization, db, clean_username)

    user = db.query(Harmonizer).filter(func.lower(Harmonizer.username) == clean_username.lower()).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old_username = user.username
    next_username = old_username
    if payload.username is not None:
        candidate_username = payload.username.strip()
        if not candidate_username:
            raise HTTPException(status_code=400, detail="Username is required")
        if len(candidate_username) > 80:
            raise HTTPException(status_code=400, detail="Username is too long")
        existing_user = (
            db.query(Harmonizer)
            .filter(func.lower(Harmonizer.username) == candidate_username.lower())
            .first()
        )
        if existing_user and getattr(existing_user, "id", None) != getattr(user, "id", None):
            raise HTTPException(status_code=409, detail="Username is already taken")
        user.username = candidate_username
        next_username = candidate_username

    avatar_to_sync = ""
    if payload.avatar_url is not None:
        avatar_url = payload.avatar_url.strip()
        if avatar_url:
            user.profile_pic = avatar_url
            avatar_to_sync = avatar_url
        elif _is_default_avatar(getattr(user, "profile_pic", "")):
            user.profile_pic = "default.jpg"

    old_species = getattr(user, "species", "human") or "human"
    species_changed = False
    if payload.species is not None:
        next_species = _normalize_species(payload.species)
        species_changed = next_species != old_species
        user.species = next_species

    if payload.bio is not None:
        user.bio = payload.bio.strip()[:500]

    try:
        db.add(user)
        db.commit()
        db.refresh(user)
        user_id = getattr(user, "id", None)
        username_changed = _safe_user_key(old_username) != _safe_user_key(next_username)
        if _safe_user_key(old_username) != _safe_user_key(next_username):
            _sync_username_references(old_username, next_username, user_id)
            _rename_profile_metadata(db, old_username, next_username)
        if payload.domain_url is not None or payload.domain_as_profile is not None:
            _upsert_profile_metadata(db, next_username, payload.domain_url, payload.domain_as_profile)
        avatar_value = avatar_to_sync
        if not avatar_value and username_changed:
            current_avatar = getattr(user, "profile_pic", "") or ""
            if current_avatar and not _is_default_avatar(current_avatar):
                avatar_value = current_avatar
        if avatar_value:
            _sync_user_avatar_references(
                db,
                user.username,
                avatar_value,
                user_id,
                aliases=[old_username, next_username],
            )
        if species_changed or username_changed:
            _sync_species_references(
                user.username,
                getattr(user, "species", "human") or "human",
                user_id,
                aliases=[old_username, next_username],
            )
        response_payload = _public_user_payload(user, provider="password")
        response_payload.update(_profile_metadata(db, next_username))
        return response_payload
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update profile: {str(e)}")


@app.get("/social-users", summary="List users available for social messaging")
def social_users(
    username: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(36, ge=1, le=80),
    db: Session = Depends(get_db),
):
    users = _collect_social_users(db, limit=limit, search=search)
    current = _safe_user_key(username or "")
    if current and all(_safe_user_key(item["username"]) != current for item in users):
        metadata = _profile_metadata(db, username or "")
        users.insert(0, {
            "username": username,
            "initials": (username or "SN")[:2].upper(),
            "species": "human",
            "avatar": "",
            "domain_url": metadata.get("domain_url", ""),
            "domain_as_profile": bool(metadata.get("domain_as_profile", False)),
            "post_count": 0,
            "latest_post_id": 0,
        })
    return users


@app.get("/social-graph", summary="Desktop social constellation graph")
def social_graph(
    username: Optional[str] = Query(None),
    limit: int = Query(14, ge=4, le=96),
    db: Session = Depends(get_db),
):
    current_key = _safe_user_key(username or "")
    graph_scan_limit = min(max(limit * 4, 80), 320)
    nodes: Dict[str, Dict[str, Any]] = {}
    edges: Dict[str, Dict[str, Any]] = {}

    def ensure_node(name: str, species: str = "human", avatar: str = "", activity: int = 0) -> str:
        clean_name = (name or "").strip()
        key = _safe_user_key(clean_name)
        if not key:
            return ""
        existing = nodes.get(key)
        if not existing:
            existing = {
                "id": key,
                "username": clean_name,
                "display_name": clean_name,
                "species": species or "human",
                "avatar_url": _social_avatar(avatar),
                "activity_score": 0,
                "is_current": bool(current_key and key == current_key),
            }
            nodes[key] = existing
        existing["activity_score"] = int(existing.get("activity_score", 0)) + max(0, int(activity or 0))
        if avatar and not existing.get("avatar_url"):
            existing["avatar_url"] = _social_avatar(avatar)
        if species and existing.get("species") == "human":
            existing["species"] = species
        return key

    def add_edge(source: str, target: str, amount: int, reason: str) -> None:
        source_key = _safe_user_key(source)
        target_key = _safe_user_key(target)
        if not source_key or not target_key or source_key == target_key:
            return
        if source_key not in nodes or target_key not in nodes:
            return
        edge_key = "::".join(sorted([source_key, target_key]))
        edge = edges.get(edge_key)
        if not edge:
            edge = {
                "id": edge_key,
                "source": source_key,
                "target": target_key,
                "strength": 0,
                "reasons": {"comments": 0, "replies": 0, "votes": 0, "follows": 0, "messages": 0},
            }
            edges[edge_key] = edge
        edge["strength"] = int(edge.get("strength", 0)) + amount
        reasons = edge.setdefault("reasons", {})
        reasons[reason] = int(reasons.get(reason, 0)) + 1

    for user in _collect_social_users(db, limit=max(limit * 3, 36)):
        ensure_node(
            user.get("username", ""),
            user.get("species", "human"),
            user.get("avatar", ""),
            int(user.get("post_count", 0)) * 3,
        )

    if username and current_key not in nodes:
        user = _find_harmonizer_by_username(db, username)
        ensure_node(
            username,
            getattr(user, "species", "human") if user else "human",
            getattr(user, "profile_pic", "") if user else "",
            4,
        )

    try:
        for item in _read_follows_store()[-1000:]:
            follower = item.get("follower", "")
            target = item.get("target", "")
            ensure_node(follower, "human", "", 4)
            ensure_node(target, "human", "", 4)
            add_edge(follower, target, 8, "follows")
    except Exception:
        pass

    try:
        proposals = []
        if Proposal is not None:
            proposals = db.query(Proposal).order_by(desc(Proposal.id)).limit(graph_scan_limit).all()
        else:
            proposals = db.execute(
                text("SELECT id, userName, author_type, author_img FROM proposals ORDER BY id DESC LIMIT :limit"),
                {"limit": graph_scan_limit},
            ).fetchall()

        for proposal in proposals:
            proposal_id = getattr(proposal, "id", None)
            author = getattr(proposal, "userName", None) or getattr(proposal, "author", None) or "Unknown"
            author_species = getattr(proposal, "author_type", None) or "human"
            author_avatar = getattr(proposal, "author_img", None) or ""
            ensure_node(author, author_species, author_avatar, 5)

            try:
                comments = (
                    db.query(Comment).filter(Comment.proposal_id == proposal_id).limit(120).all()
                    if CRUD_MODELS_AVAILABLE
                    else db.execute(
                        text("SELECT * FROM comments WHERE proposal_id = :pid LIMIT 120"),
                        {"pid": proposal_id},
                    ).fetchall()
                )
            except Exception:
                comments = []
            comments_by_id = {}
            for comment in comments[:120]:
                payload = _serialize_comment_record(db, comment)
                comments_by_id[str(payload.get("id"))] = payload
                if payload.get("deleted"):
                    continue
                commenter = payload.get("user", "")
                ensure_node(commenter, payload.get("species", "human"), payload.get("user_img", ""), 3)
                add_edge(commenter, author, 5, "comments")
                parent_id = payload.get("parent_comment_id")
                parent = comments_by_id.get(str(parent_id)) if parent_id is not None else None
                if parent and not parent.get("deleted"):
                    add_edge(commenter, parent.get("user", ""), 4, "replies")

            try:
                votes = (
                    db.query(ProposalVote).filter(ProposalVote.proposal_id == proposal_id).limit(120).all()
                    if CRUD_MODELS_AVAILABLE
                    else db.execute(
                        text("SELECT * FROM proposal_votes WHERE proposal_id = :pid LIMIT 120"),
                        {"pid": proposal_id},
                    ).fetchall()
                )
            except Exception:
                votes = []
            vote_entries = []
            for vote in votes[:120]:
                like_entry, dislike_entry = _serialize_vote_record(db, vote)
                entry = like_entry or dislike_entry
                if not entry:
                    continue
                voter = entry.get("voter", "")
                ensure_node(voter, entry.get("type", "human"), "", 2)
                add_edge(voter, author, 2, "votes")
                vote_entries.append((voter, bool(like_entry)))
            for index, (left_user, left_choice) in enumerate(vote_entries[:24]):
                for right_user, right_choice in vote_entries[index + 1:24]:
                    add_edge(left_user, right_user, 3 if left_choice == right_choice else 2, "votes")
    except Exception:
        pass

    try:
        rows = db.execute(
            text("SELECT sender, recipient FROM direct_messages ORDER BY created_at DESC LIMIT :limit"),
            {"limit": min(max(limit * 4, 160), 360)},
        ).fetchall()
        for row in rows:
            data = getattr(row, "_mapping", row)
            ensure_node(data["sender"], "human", "", 2)
            ensure_node(data["recipient"], "human", "", 2)
            add_edge(data["sender"], data["recipient"], 6, "messages")
    except Exception:
        pass

    ordered_nodes = sorted(
        nodes.values(),
        key=lambda node: (not node.get("is_current"), -int(node.get("activity_score", 0)), node.get("username", "")),
    )[:limit]
    allowed = {node["id"] for node in ordered_nodes}
    ordered_edges = sorted(
        [edge for edge in edges.values() if edge["source"] in allowed and edge["target"] in allowed],
        key=lambda edge: int(edge.get("strength", 0)),
        reverse=True,
    )[:max(18, limit * 2)]
    return {
        "nodes": ordered_nodes,
        "edges": ordered_edges,
        "meta": {
            "node_count": len(ordered_nodes),
            "edge_count": len(ordered_edges),
            "current_user": current_key,
            "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
        },
    }


@app.get("/follows", summary="List follow relationships for a user")
def get_follows(
    user: str = Query(...),
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    current = _safe_user_key(user)
    if not current:
        raise HTTPException(status_code=400, detail="user is required")
    _enforce_token_identity_match(authorization, db, user)
    follows = _read_follows_store()
    following = [
        {"username": item.get("target", ""), "created_at": item.get("created_at", "")}
        for item in follows
        if item.get("follower_key") == current
    ]
    followers = [
        {"username": item.get("follower", ""), "created_at": item.get("created_at", "")}
        for item in follows
        if item.get("target_key") == current
    ]
    return {"user": user, "following": following, "followers": followers}


@app.get("/follows/status", summary="Check if one user follows another")
def follow_status(
    follower: str = Query(...),
    target: str = Query(...),
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    follower_key = _safe_user_key(follower)
    target_key = _safe_user_key(target)
    if not follower_key or not target_key:
        raise HTTPException(status_code=400, detail="follower and target are required")
    _enforce_token_identity_match(authorization, db, follower)
    follows = _read_follows_store()
    return {
        "follower": follower,
        "target": target,
        "following": any(
            item.get("follower_key") == follower_key and item.get("target_key") == target_key
            for item in follows
        ),
    }


@app.post("/follows", summary="Follow a user")
def follow_user(
    payload: FollowIn,
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    follower = payload.follower.strip()
    target = payload.target.strip()
    follower_key = _safe_user_key(follower)
    target_key = _safe_user_key(target)
    if not follower_key or not target_key:
        raise HTTPException(status_code=400, detail="follower and target are required")
    if follower_key == target_key:
        raise HTTPException(status_code=400, detail="Choose another user to follow")
    _require_token_identity_match(authorization, db, follower)

    follows = _read_follows_store()
    existing = next(
        (
            item for item in follows
            if item.get("follower_key") == follower_key and item.get("target_key") == target_key
        ),
        None,
    )
    if existing:
        return {"following": True, "follower": follower, "target": target}

    follows.append({
        "id": uuid.uuid4().hex,
        "follower": follower,
        "follower_key": follower_key,
        "target": target,
        "target_key": target_key,
        "created_at": datetime.datetime.utcnow().isoformat() + "Z",
    })
    _write_follows_store(follows[-5000:])
    return {"following": True, "follower": follower, "target": target}


@app.delete("/follows", summary="Unfollow a user")
def unfollow_user(
    follower: str = Query(...),
    target: str = Query(...),
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    follower_key = _safe_user_key(follower)
    target_key = _safe_user_key(target)
    if not follower_key or not target_key:
        raise HTTPException(status_code=400, detail="follower and target are required")
    _require_token_identity_match(authorization, db, follower)
    follows = _read_follows_store()
    next_follows = [
        item for item in follows
        if not (item.get("follower_key") == follower_key and item.get("target_key") == target_key)
    ]
    _write_follows_store(next_follows)
    return {"following": False, "follower": follower, "target": target}


@app.get("/messages", summary="Get direct messages or conversation summaries")
def get_messages(
    user: str = Query(...),
    peer: Optional[str] = Query(None),
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    current = _safe_user_key(user)
    if not current:
        raise HTTPException(status_code=400, detail="user is required")
    _require_token_identity_match(authorization, db, user)

    try:
        _ensure_direct_messages_table(db)
        if peer:
            cid = _conversation_id(user, peer)
            rows = db.execute(
                text(
                    "SELECT id, conversation_id, sender, recipient, body, created_at "
                    "FROM direct_messages WHERE conversation_id = :cid ORDER BY created_at ASC"
                ),
                {"cid": cid},
            ).fetchall()
            return {"peer": peer, "messages": [_message_payload(row) for row in rows]}

        rows = db.execute(
            text(
                "SELECT id, conversation_id, sender, recipient, body, created_at "
                "FROM direct_messages "
                "WHERE lower(sender) = :current OR lower(recipient) = :current "
                "ORDER BY created_at DESC LIMIT 1000"
            ),
            {"current": current},
        ).fetchall()
        conversations: Dict[str, Dict[str, Any]] = {}
        for row in rows:
            message = _message_payload(row)
            sender = _safe_user_key(message.get("sender", ""))
            recipient = _safe_user_key(message.get("recipient", ""))
            peer_name = message.get("sender") if recipient == current else message.get("recipient")
            key = _safe_user_key(peer_name)
            if not key or key in conversations:
                continue
            conversations[key] = {
                "peer": peer_name,
                "last_message": message,
                "updated_at": message.get("created_at", ""),
            }

        return {
            "conversations": sorted(
                conversations.values(),
                key=lambda item: item.get("updated_at", ""),
                reverse=True,
            )
        }
    except Exception:
        db.rollback()

    messages = _read_messages_store()
    if peer:
        cid = _conversation_id(user, peer)
        thread = [message for message in messages if message.get("conversation_id") == cid]
        return {"peer": peer, "messages": sorted(thread, key=lambda item: item.get("created_at", ""))}

    conversations: Dict[str, Dict[str, Any]] = {}
    for message in messages:
        sender = _safe_user_key(message.get("sender", ""))
        recipient = _safe_user_key(message.get("recipient", ""))
        if current not in {sender, recipient}:
            continue
        peer_name = message.get("sender") if recipient == current else message.get("recipient")
        key = _safe_user_key(peer_name)
        conversations[key] = {
            "peer": peer_name,
            "last_message": message,
            "updated_at": message.get("created_at", ""),
        }

    return {
        "conversations": sorted(
            conversations.values(),
            key=lambda item: item.get("updated_at", ""),
            reverse=True,
        )
    }


@app.post("/messages", summary="Send a direct message")
def send_message(
    payload: DirectMessageIn,
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    sender = payload.sender.strip()
    recipient = payload.recipient.strip()
    body = payload.body.strip()
    if not sender:
        raise HTTPException(status_code=400, detail="sender is required")
    if not recipient:
        raise HTTPException(status_code=400, detail="recipient is required")
    if _safe_user_key(sender) == _safe_user_key(recipient):
        raise HTTPException(status_code=400, detail="Choose another user to message")
    if not body:
        raise HTTPException(status_code=400, detail="Write a message first")
    _require_token_identity_match(authorization, db, sender)

    messages = _read_messages_store()
    message = {
        "id": uuid.uuid4().hex,
        "conversation_id": _conversation_id(sender, recipient),
        "sender": sender,
        "recipient": recipient,
        "body": body,
        "created_at": datetime.datetime.utcnow().isoformat() + "Z",
    }
    try:
        _ensure_direct_messages_table(db)
        db.execute(
            text(
                "INSERT INTO direct_messages "
                "(id, conversation_id, sender, recipient, body, created_at) "
                "VALUES (:id, :conversation_id, :sender, :recipient, :body, :created_at)"
            ),
            message,
        )
        db.commit()
        return message
    except Exception:
        db.rollback()

    messages.append(message)
    _write_messages_store(messages[-1000:])
    return message


@app.post("/proposals", response_model=ProposalSchema, summary="Create a new proposal")
async def create_proposal(
    title: str = Form(...),
    body: str = Form(...),
    author: str = Form(...),
    author_type: str = Form("human"),
    author_img: str = Form(""),
    date: Optional[str] = Form(None),
    video: str = Form(""),
    link: str = Form(""),
    media_layout: str = Form("carousel"),
    image: Optional[UploadFile] = File(None),
    images: Optional[List[UploadFile]] = File(None),
    video_file: Optional[UploadFile] = File(None),
    file: Optional[UploadFile] = File(None),
    voting_deadline: Optional[datetime.datetime] = Form(None),
    governance_kind: str = Form("post"),
    decision_level: str = Form("standard"),
    voting_days: Optional[int] = Form(None),
    execution_mode: str = Form("manual"),
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db)
):
    if author_type not in ("human", "company", "ai"):
        raise HTTPException(status_code=400, detail="Invalid author_type")
    _enforce_token_identity_match(authorization, db, author)
    
    os.makedirs(uploads_dir, exist_ok=True)
    image_filename = None
    image_filenames = []
    video_value = video or ""
    file_filename = None
    safe_media_layout = _normalize_media_layout(media_layout)
    safe_governance_kind = _normalize_governance_kind(governance_kind)
    safe_decision_level = _normalize_decision_level(decision_level)
    safe_voting_days = _clamp_voting_days(voting_days)
    safe_execution_mode = "manual" if str(execution_mode or "").strip().lower() != "manual" else "manual"

    # --- Process uploads ---
    image_uploads = []
    if image:
        image_uploads.append(image)
    if images:
        image_uploads.extend([item for item in images if item])
    for image_upload in image_uploads:
        if not _upload_matches(image_upload, "image/", IMAGE_UPLOAD_EXTENSIONS):
            raise HTTPException(status_code=400, detail="Uploaded image files must be images")
        next_filename = _save_upload_file(
            image_upload,
            IMAGE_UPLOAD_EXTENSIONS,
            ".jpg",
            UPLOAD_IMAGE_MAX_BYTES,
        )
        image_filenames.append(next_filename)
    if len(image_filenames) == 1:
        image_filename = image_filenames[0]
    elif len(image_filenames) > 1:
        image_filename = json.dumps(image_filenames)

    if video_file:
        if not _upload_matches(video_file, "video/", VIDEO_UPLOAD_EXTENSIONS):
            raise HTTPException(status_code=400, detail="Uploaded video file must be a video")
        video_filename = _save_upload_file(
            video_file,
            VIDEO_UPLOAD_EXTENSIONS,
            ".mp4",
            UPLOAD_VIDEO_MAX_BYTES,
        )
        video_value = video_filename
    
    if file:
        if _safe_upload_extension(file) not in DOCUMENT_UPLOAD_EXTENSIONS:
            raise HTTPException(status_code=400, detail="Uploaded file type is not supported")
        file_filename = _save_upload_file(
            file,
            DOCUMENT_UPLOAD_EXTENSIONS,
            max_bytes=UPLOAD_DOCUMENT_MAX_BYTES,
        )

    from datetime import datetime as dt
    if date:
        normalized_date = date.replace("Z", "+00:00")
        created_at = dt.fromisoformat(normalized_date)
    else:
        created_at = dt.utcnow()
    if not voting_deadline:
        deadline_days = safe_voting_days if safe_governance_kind == "decision" else 7
        voting_deadline = created_at + timedelta(days=deadline_days)
    proposal_payload = {"media_layout": safe_media_layout}
    if safe_governance_kind == "decision":
        approval_threshold = _governance_threshold(safe_decision_level)
        proposal_payload.update({
            "governance_kind": "decision",
            "decision_level": safe_decision_level,
            "approval_threshold": approval_threshold,
            "execution_mode": safe_execution_mode,
            "execution_status": "pending_vote",
            "voting_days": safe_voting_days,
            "voting_deadline": _format_timestamp(voting_deadline),
        })

    try:
        final_user = None
        if author and author.strip():
            final_user = author.strip()
        if 'userName' in locals() and userName and userName.strip():
            final_user = userName.strip()
        if not final_user:
            final_user = "Unknown"
        initials = (final_user[:2].upper() if final_user else "UN")
        author_obj = None
        if Harmonizer is not None and final_user:
            author_obj = db.query(Harmonizer).filter(func.lower(Harmonizer.username) == final_user.lower()).first()
            account_species = getattr(author_obj, "species", None) if author_obj else None
            if account_species in ("human", "company", "ai"):
                author_type = account_species

        if CRUD_MODELS_AVAILABLE:
            if author_obj:
                user_name = author_obj.username
            else:
                user_name = final_user
            db_proposal = Proposal(
                title=title,
                description=body,
                userName=user_name,
                userInitials=(user_name[:2]).upper() if user_name else "UN",
                author_type=author_type,
                author_img=author_img,
                image=image_filename,
                video=video_value,
                link=link,
                file=file_filename,
                payload=proposal_payload,
                created_at=created_at,
                voting_deadline=voting_deadline
            )
            db.add(db_proposal)
            db.commit()
            db.refresh(db_proposal)
        else:
            insert_params = {
                "title": title,
                "description": body,
                "userName": final_user,
                "userInitials": initials,
                "author_type": author_type,
                "author_img": author_img,
                "created_at": created_at,
                "voting_deadline": voting_deadline,
                "image": image_filename,
                "video": video_value,
                "link": link,
                "file": file_filename,
                "payload": json.dumps(proposal_payload),
            }
            try:
                result = db.execute(
                    text("""
                        INSERT INTO proposals (
                            title, description, userName, userInitials, author_type,
                            author_img, created_at, voting_deadline, image, video, link, file, payload
                        )
                        VALUES (
                            :title, :description, :userName, :userInitials, :author_type,
                            :author_img, :created_at, :voting_deadline, :image, :video, :link, :file, :payload
                        )
                        RETURNING id
                    """),
                    insert_params,
                )
            except Exception:
                db.rollback()
                result = db.execute(
                    text("""
                        INSERT INTO proposals (
                            title, description, userName, userInitials, author_type,
                            author_img, created_at, voting_deadline, image, video, link, file
                        )
                        VALUES (
                            :title, :description, :userName, :userInitials, :author_type,
                            :author_img, :created_at, :voting_deadline, :image, :video, :link, :file
                        )
                        RETURNING id
                    """),
                    insert_params,
                )
            row = result.fetchone()
            if not row:
                raise HTTPException(status_code=500, detail="Failed to create proposal")
            db.commit()
            db_proposal = type("Temp", (), {})()
            db_proposal.id = row[0]
            db_proposal.title = title
            db_proposal.description = body
            db_proposal.userName = final_user
            db_proposal.userInitials = initials
            db_proposal.author_type = author_type
            db_proposal.author_img = author_img
            db_proposal.image = image_filename
            db_proposal.video = video_value
            db_proposal.link = link
            db_proposal.file = file_filename
            db_proposal.payload = proposal_payload
            db_proposal.created_at = created_at
            db_proposal.voting_deadline = voting_deadline
            user_name = final_user

        author_metadata = _profile_metadata(db, user_name)
        return ProposalSchema(
            id=db_proposal.id,
            title=db_proposal.title,
            text=db_proposal.description,
            userName=user_name,
            userInitials=(user_name[:2]).upper() if user_name else "UN",
            author_img=db_proposal.author_img or "",
            time=_format_timestamp(db_proposal.created_at),
            author_type=db_proposal.author_type,
            profile_url=author_metadata.get("domain_url", ""),
            domain_as_profile=bool(author_metadata.get("domain_as_profile", False)),
            likes=[],
            dislikes=[],
            comments=[],
            media=_media_payload(
                db_proposal.image,
                db_proposal.video,
                db_proposal.link,
                db_proposal.file,
                getattr(db_proposal, "payload", None),
                getattr(db_proposal, "voting_deadline", None),
            )
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create proposal: {str(e)}")
#
# --- Harmonizer serialization helper ---
def serialize_harmonizer(h):
    if not h:
        return None
    avatar_value = getattr(h, "profile_pic", "") or getattr(h, "avatar_url", "") or ""
    # Only select safe fields for serialization
    return {
        "id": getattr(h, "id", None),
        "username": getattr(h, "username", None),
        "avatar_url": _social_avatar(avatar_value),
        "species": getattr(h, "species", None),
        "karma_score": float(getattr(h, "karma_score", 0)) if hasattr(h, "karma_score") else 0,
        "harmony_score": float(getattr(h, "harmony_score", 0)) if hasattr(h, "harmony_score") else 0,
        "creative_spark": float(getattr(h, "creative_spark", 0)) if hasattr(h, "creative_spark") else 0,
    }


def get_current_harmonizer(
    authorization: Optional[str], db: Session
):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    if jwt is None:
        raise HTTPException(status_code=500, detail="JWT support is unavailable")

    token = authorization.split(" ", 1)[1].strip()
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc

    username = payload.get("sub")
    if not username or Harmonizer is None:
        raise HTTPException(status_code=401, detail="User not found")

    user = db.query(Harmonizer).filter(Harmonizer.username == username).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def _optional_current_harmonizer(authorization: Optional[str], db: Session):
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    try:
        return get_current_harmonizer(authorization, db)
    except HTTPException:
        # Compatibility-first: legacy sessions may have non-JWT fallback tokens.
        # Only enforce conflicts when a token can be resolved to a real account.
        return None


def _enforce_token_identity_match(
    authorization: Optional[str],
    db: Session,
    *identity_values: Optional[str],
):
    current_user = _optional_current_harmonizer(authorization, db)
    if not current_user:
        return None
    token_key = _safe_user_key(getattr(current_user, "username", ""))
    for value in identity_values:
        value_key = _safe_user_key(value or "")
        if value_key and value_key != token_key:
            raise HTTPException(status_code=403, detail="Bearer token does not match requested user")
    return current_user


def _require_token_identity_match(
    authorization: Optional[str],
    db: Session,
    *identity_values: Optional[str],
):
    current_user = get_current_harmonizer(authorization, db)
    token_key = _safe_user_key(getattr(current_user, "username", ""))
    for value in identity_values:
        value_key = _safe_user_key(value or "")
        if value_key and value_key != token_key:
            raise HTTPException(status_code=403, detail="Bearer token does not match requested user")
    return current_user


@app.get("/users/me")
def read_current_user(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    current_user = get_current_harmonizer(authorization, db)
    return serialize_harmonizer(current_user)

@app.get("/proposals", response_model=List[ProposalSchema])
def list_proposals(
    filter: str = Query("all"),
    search: Optional[str] = Query(None),
    author: Optional[str] = Query(None),
    before_id: Optional[int] = Query(None, ge=1),
    limit: int = Query(80, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    List proposals, supporting filters:
    - all, latest, oldest, topLikes, fewestLikes, popular, ai, company, human
    - search: string search on title/description/username
    """
    try:
        # --- ORM MODE ---
        if CRUD_MODELS_AVAILABLE:
            from sqlalchemy import func, case
            query = db.query(Proposal)

            # SEARCH
            if search and search.strip():
                search_filter = f"%{search}%"
                query = query.filter(
                    or_(
                        Proposal.title.ilike(search_filter),
                        Proposal.description.ilike(search_filter),
                        Proposal.userName.ilike(search_filter)
                    )
                )
            if author and author.strip():
                query = query.filter(func.lower(Proposal.userName) == author.strip().lower())
            if before_id:
                query = query.filter(Proposal.id < before_id)

            # FILTERS
            filter = (filter or "all").lower()
            # Sorting/Filtering logic
            if filter == "latest":
                query = query.order_by(desc(Proposal.created_at))
            elif filter == "oldest":
                query = query.order_by(asc(Proposal.created_at))
            elif filter == "toplikes":
                vote_count = func.sum(case((ProposalVote.vote == "up", 1), else_=0)).label("upvote_count")
                query = query.outerjoin(ProposalVote, Proposal.id == ProposalVote.proposal_id)\
                    .group_by(Proposal.id)\
                    .order_by(desc(vote_count))
            elif filter == "fewestlikes":
                vote_count = func.sum(case((ProposalVote.vote == "up", 1), else_=0)).label("upvote_count")
                query = query.outerjoin(ProposalVote, Proposal.id == ProposalVote.proposal_id)\
                    .group_by(Proposal.id)\
                    .order_by(asc(vote_count))
            elif filter == "popular":
                from datetime import datetime, timedelta
                since = datetime.utcnow() - timedelta(days=1)
                vote_count = func.sum(case((ProposalVote.vote == "up", 1), else_=0)).label("upvote_count")
                query = db.query(Proposal, vote_count)\
                          .outerjoin(ProposalVote, Proposal.id == ProposalVote.proposal_id)\
                          .filter(Proposal.created_at >= since)
                if search and search.strip():
                    search_filter = f"%{search.strip()}%"
                    query = query.filter(
                        or_(
                            Proposal.title.ilike(search_filter),
                            Proposal.description.ilike(search_filter),
                            Proposal.userName.ilike(search_filter)
                        )
                    )
                if author and author.strip():
                    query = query.filter(func.lower(Proposal.userName) == author.strip().lower())
                if before_id:
                    query = query.filter(Proposal.id < before_id)
                query = query.group_by(Proposal.id).order_by(desc(vote_count))
                proposals = [p for p, _ in query.offset(offset).limit(limit).all()]
            elif filter == "ai":
                query = query.filter(Proposal.author_type == "ai").order_by(desc(Proposal.created_at))
            elif filter == "company":
                query = query.filter(Proposal.author_type == "company").order_by(desc(Proposal.created_at))
            elif filter == "human":
                query = query.filter(Proposal.author_type == "human").order_by(desc(Proposal.created_at))
            else:
                # Default: all, order by id desc
                query = query.order_by(desc(Proposal.id))

            if filter != "popular":
                proposals = query.offset(offset).limit(limit).all()

        # --- FALLBACK (RAW SQL) ---
        else:
            filter_sql = (filter or "all").lower()
            base_query = "SELECT * FROM proposals"
            where_clauses = []
            order_clause = "ORDER BY id DESC"
            votes_table_exists = False
            comments_table_exists = False

            try:
                table_rows = db.execute(
                    text("SELECT name FROM sqlite_master WHERE type='table'")
                ).fetchall()
                existing_tables = {row[0] for row in table_rows}
                votes_table_exists = "proposal_votes" in existing_tables
                comments_table_exists = "comments" in existing_tables
            except Exception:
                pass

            # SEARCH
            params = {}
            if search and search.strip():
                where_clauses.append(
                    "(LOWER(title) LIKE LOWER(:search) OR LOWER(description) LIKE LOWER(:search) OR LOWER(userName) LIKE LOWER(:search))"
                )
                params["search"] = f"%{search}%"
            if author and author.strip():
                where_clauses.append("LOWER(userName) = LOWER(:author)")
                params["author"] = author.strip()
            if before_id:
                where_clauses.append("id < :before_id")
                params["before_id"] = before_id

            # FILTERS
            if filter_sql == "latest":
                order_clause = "ORDER BY created_at DESC"
            elif filter_sql == "oldest":
                order_clause = "ORDER BY created_at ASC"
            elif filter_sql == "ai":
                where_clauses.append("author_type = 'ai'")
            elif filter_sql == "company":
                where_clauses.append("author_type = 'company'")
            elif filter_sql == "human":
                where_clauses.append("author_type = 'human'")
            # For topLikes, fewestLikes, popular, fallback: order by likes/dislikes if possible
            elif filter_sql in ("toplikes", "fewestlikes", "popular"):
                # For fallback, try to join votes table if exists
                # We assume a "votes" table with proposal_id, choice ('up'/'down')
                if filter_sql == "toplikes":
                    base_query = """
                        SELECT p.*, COUNT(v.proposal_id) AS upvotes
                        FROM proposals p
                        LEFT JOIN proposal_votes v ON p.id = v.proposal_id AND v.vote = 'up'
                        GROUP BY p.id
                        ORDER BY upvotes DESC
                    """
                    order_clause = ""
                elif filter_sql == "fewestlikes":
                    base_query = """
                        SELECT p.*, COUNT(v.proposal_id) AS upvotes
                        FROM proposals p
                        LEFT JOIN proposal_votes v ON p.id = v.proposal_id AND v.vote = 'up'
                        GROUP BY p.id
                        ORDER BY upvotes ASC
                    """
                    order_clause = ""
                elif filter_sql == "popular":
                    base_query = """
                        SELECT p.*, COUNT(v.proposal_id) AS total_votes
                        FROM proposals p
                        LEFT JOIN proposal_votes v ON p.id = v.proposal_id
                        GROUP BY p.id
                        ORDER BY total_votes DESC
                    """
                    order_clause = ""

            # Compose query
            if "GROUP BY" not in base_query:
                if where_clauses:
                    base_query += " WHERE " + " AND ".join(where_clauses)
                if order_clause:
                    base_query += f" {order_clause}"
            base_query += " LIMIT :limit OFFSET :offset"
            params["limit"] = limit
            params["offset"] = offset
            proposals = db.execute(text(base_query), params).fetchall()

        # --- SERIALIZATION ---
        proposals_list = []
        profile_metadata_cache: Dict[str, Dict[str, Any]] = {}
        for prop in proposals:
            if CRUD_MODELS_AVAILABLE:
                user_name = ""
                author_obj = None
                if hasattr(prop, "author_id") and prop.author_id:
                    author_obj = db.query(Harmonizer).filter(Harmonizer.id == prop.author_id).first()
                    if author_obj and hasattr(author_obj, "username"):
                        user_name = author_obj.username
                if not user_name:
                    # fallback para userName, author_username, author, "Unknown"
                    if hasattr(prop, "userName") and prop.userName:
                        user_name = prop.userName
                    elif hasattr(prop, "author_username") and prop.author_username:
                        user_name = prop.author_username
                    elif hasattr(prop, "author") and prop.author:
                        user_name = prop.author
                    else:
                        user_name = "Unknown"
                if author_obj is None:
                    author_obj = _find_harmonizer_by_username(db, user_name)
                user_initials = (user_name[:2].upper() if user_name else "UN")
            else:
                user_name = getattr(prop, "userName", None) or getattr(prop, "author", None) or "Unknown"
                author_obj = _find_harmonizer_by_username(db, user_name)
                user_initials = (user_name[:2].upper() if user_name else "UN")

            # Votes and Comments
            if CRUD_MODELS_AVAILABLE:
                votes = db.query(ProposalVote).filter(ProposalVote.proposal_id == prop.id).all()
                comments = db.query(Comment).filter(Comment.proposal_id == prop.id).all()
            else:
                # fallback: try to get from votes and comments tables
                if votes_table_exists:
                    votes = db.execute(
                        text("SELECT * FROM proposal_votes WHERE proposal_id = :pid"),
                        {"pid": prop.id}
                    ).fetchall()
                else:
                    votes = []
                if comments_table_exists:
                    comments = db.execute(
                        text("SELECT * FROM comments WHERE proposal_id = :pid"),
                        {"pid": prop.id}
                    ).fetchall()
                else:
                    comments = []

            # Likes/Dislikes
            likes = []
            dislikes = []
            for v in votes:
                like_entry, dislike_entry = _serialize_vote_record(db, v)
                if like_entry:
                    likes.append(like_entry)
                if dislike_entry:
                    dislikes.append(dislike_entry)

            # Comments
            comments_list = []
            if CRUD_MODELS_AVAILABLE or comments_table_exists:
                for c in comments:
                    comments_list.append(_serialize_comment_record(db, c))

            author_img = getattr(prop, "author_img", "")
            if author_obj is not None:
                author_img = getattr(author_obj, "profile_pic", None) or author_img
            author_key = _safe_user_key(user_name)
            if author_key not in profile_metadata_cache:
                profile_metadata_cache[author_key] = _profile_metadata(db, user_name)
            author_metadata = profile_metadata_cache.get(author_key, {})

            proposals_list.append({
                "id": prop.id,
                "title": getattr(prop, "title", ""),
                "userName": str(user_name),
                "userInitials": user_initials,
                "text": getattr(prop, "description", "") if SUPER_NOVA_AVAILABLE else getattr(prop, "body", None) or getattr(prop, "description", ""),
                "author_img": _social_avatar(author_img),
                "time": _format_timestamp(getattr(prop, "created_at", None) or getattr(prop, "date", "")),
                "author_type": getattr(prop, "author_type", "human"),
                "profile_url": author_metadata.get("domain_url", ""),
                "domain_as_profile": bool(author_metadata.get("domain_as_profile", False)),
                "likes": likes,
                "dislikes": dislikes,
                "comments": comments_list,
                "media": _media_payload(
                    getattr(prop, "image", ""),
                    getattr(prop, "video", ""),
                    getattr(prop, "link", ""),
                    getattr(prop, "file", ""),
                    getattr(prop, "payload", None),
                    getattr(prop, "voting_deadline", None),
                )
            })

        return proposals_list

    except Exception as e:
        import traceback
        print(f"Error in list_proposals: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to list proposals: {str(e)}")

#
#
# --- Dedicated yes/no system vote ---
@app.get("/system-vote")
def get_system_vote(username: Optional[str] = Query(None), db: Session = Depends(get_db)):
    try:
        _ensure_system_votes_table(db)
        rows = db.execute(
            text("SELECT username, choice, voter_type FROM system_votes ORDER BY updated_at DESC")
        ).fetchall()
        return _serialize_system_vote_rows(rows, username)
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to load system vote: {str(exc)}")


@app.get("/system-vote/config")
def get_system_vote_config():
    return {
        "question": SYSTEM_VOTE_QUESTION,
        "deadline": SYSTEM_VOTE_DEADLINE,
    }


@app.post("/system-vote")
def cast_system_vote(payload: SystemVoteIn, db: Session = Depends(get_db)):
    username = (payload.username or "").strip()
    if not username:
        raise HTTPException(status_code=400, detail="username is required")
    choice = _normalize_system_vote_choice(payload.choice)
    voter_type = _species_for_username(db, username, payload.voter_type)
    now = datetime.datetime.utcnow()

    try:
        _ensure_system_votes_table(db)
        db.execute(
            text("DELETE FROM system_votes WHERE lower(username) = lower(:username)"),
            {"username": username},
        )
        db.execute(
            text(
                "INSERT INTO system_votes (username, choice, voter_type, created_at, updated_at) "
                "VALUES (:username, :choice, :voter_type, :created_at, :updated_at)"
            ),
            {
                "username": username,
                "choice": choice,
                "voter_type": voter_type,
                "created_at": now,
                "updated_at": now,
            },
        )
        db.commit()
        rows = db.execute(
            text("SELECT username, choice, voter_type FROM system_votes ORDER BY updated_at DESC")
        ).fetchall()
        return _serialize_system_vote_rows(rows, username)
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to cast system vote: {str(exc)}")


@app.delete("/system-vote")
def remove_system_vote(username: str = Query(...), db: Session = Depends(get_db)):
    requester = (username or "").strip()
    if not requester:
        raise HTTPException(status_code=400, detail="username is required")
    try:
        _ensure_system_votes_table(db)
        db.execute(
            text("DELETE FROM system_votes WHERE lower(username) = lower(:username)"),
            {"username": requester},
        )
        db.commit()
        rows = db.execute(
            text("SELECT username, choice, voter_type FROM system_votes ORDER BY updated_at DESC")
        ).fetchall()
        return _serialize_system_vote_rows(rows, requester)
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to remove system vote: {str(exc)}")


# --- Tally endpoints ---
# REMOVE DUPLICATE get_proposal ENDPOINT
    
@app.get("/proposals/{pid}/tally-weighted")
def tally_weighted(pid: int):
    if not SUPER_NOVA_AVAILABLE:
        raise HTTPException(status_code=501, detail="SuperNova weighted voting not available")
    return tally_votes(pid)

# --- Decision endpoint ---
@app.post("/decide/{pid}", response_model=DecisionSchema)
def decide(pid: int, threshold: float = 0.6, db: Session = Depends(get_db)):
    try:
        # Sistema ponderado
        weighted_decision = None
        if CRUD_MODELS_AVAILABLE:
            try:
                level = "important" if threshold >= 0.9 else "standard"
                weighted_decision = weighted_decide(pid, level)
                status = weighted_decision.get("status", "undecided")
            except Exception as e:
                print(f"Weighted decision failed: {e}")
        
        # Fallback para sistema tradicional
        if not weighted_decision:
            tally_result = _compute_vote_totals(db, pid)
            total = tally_result["up"] + tally_result["down"]
            status = "rejected"
            if total > 0 and (tally_result["up"] / total) >= threshold:
                status = "accepted"
        
        #
        if CRUD_MODELS_AVAILABLE:
            existing = db.query(Decision).filter(Decision.proposal_id == pid).first()
            if existing:
                existing.status = status
            else:
                decision = Decision(proposal_id=pid, status=status)
                db.add(decision)
        else:
            existing = db.execute(
                text("SELECT * FROM decisions WHERE proposal_id = :pid"),
                {"pid": pid}
            ).fetchone()
            
            if existing:
                db.execute(
                    text("UPDATE decisions SET status = :status WHERE id = :id"),
                    {"status": status, "id": existing.id}
                )
            else:
                db.execute(
                    text("INSERT INTO decisions (proposal_id, status) VALUES (:pid, :status)"),
                    {"pid": pid, "status": status}
                )
        
        db.commit()
        
        #
        if CRUD_MODELS_AVAILABLE:
            decision_obj = db.query(Decision).filter(Decision.proposal_id == pid).first()
            return DecisionSchema(
                id=decision_obj.id,
                proposal_id=decision_obj.proposal_id,
                status=decision_obj.status
            )
        else:
            decision_obj = db.execute(
                text("SELECT * FROM decisions WHERE proposal_id = :pid"),
                {"pid": pid}
            ).fetchone()
            return DecisionSchema(
                id=decision_obj.id,
                proposal_id=decision_obj.proposal_id,
                status=decision_obj.status
            )
            
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save decision: {str(e)}")


@app.get("/notifications")
def list_notifications(
    user: Optional[str] = Query(None),
    limit: int = Query(12, ge=1, le=30),
    db: Session = Depends(get_db),
):
    clean_user = (user or "").strip()
    items: List[Dict[str, Any]] = []
    _ensure_comment_thread_columns(db)

    def add_recent_posts() -> None:
        remaining = max(0, limit - len(items))
        if remaining <= 0:
            return
        try:
            if Proposal is not None:
                for proposal in db.query(Proposal).order_by(desc(Proposal.id)).limit(remaining).all():
                    proposal_id = getattr(proposal, "id", None)
                    items.append({
                        "id": f"post-{proposal_id}",
                        "type": "post",
                        "proposal_id": proposal_id,
                        "title": getattr(proposal, "title", None) or "New proposal",
                        "actor": getattr(proposal, "userName", None) or "SuperNova",
                        "time": _format_timestamp(getattr(proposal, "created_at", None)),
                    })
                return
        except Exception:
            pass
        try:
            rows = db.execute(
                text("SELECT id, title, userName, created_at FROM proposals ORDER BY id DESC LIMIT :limit"),
                {"limit": remaining},
            ).fetchall()
            for row in rows:
                data = getattr(row, "_mapping", row)
                items.append({
                    "id": f"post-{data['id']}",
                    "type": "post",
                    "proposal_id": data["id"],
                    "title": data["title"] or "New proposal",
                    "actor": data["userName"] or "SuperNova",
                    "time": _format_timestamp(data["created_at"]),
                })
        except Exception:
            pass

    if clean_user:
        try:
            if CRUD_MODELS_AVAILABLE:
                owned_comment_rows = (
                    db.query(Comment.id)
                    .join(Harmonizer, Comment.author_id == Harmonizer.id)
                    .filter(func.lower(Harmonizer.username) == clean_user.lower())
                    .limit(500)
                    .all()
                )
                owned_comment_ids = [row[0] for row in owned_comment_rows if row[0]]
                if owned_comment_ids:
                    replies = (
                        db.query(Comment)
                        .filter(Comment.parent_comment_id.in_(owned_comment_ids))
                        .order_by(desc(Comment.created_at))
                        .limit(limit)
                        .all()
                    )
                    for reply in replies:
                        payload = _serialize_comment_record(db, reply)
                        if _safe_user_key(payload.get("user", "")) == _safe_user_key(clean_user):
                            continue
                        proposal_title = "Reply to your comment"
                        if Proposal is not None and payload.get("proposal_id"):
                            proposal = db.query(Proposal).filter(Proposal.id == payload["proposal_id"]).first()
                            proposal_title = getattr(proposal, "title", None) or proposal_title
                        items.append({
                            "id": f"comment-reply-{payload.get('id')}",
                            "type": "comment_reply",
                            "proposal_id": payload.get("proposal_id"),
                            "comment_id": payload.get("id"),
                            "parent_comment_id": payload.get("parent_comment_id"),
                            "title": proposal_title,
                            "actor": payload.get("user") or "Someone",
                            "body": payload.get("comment") or "",
                            "time": payload.get("created_at") or "",
                        })
            else:
                rows = db.execute(
                    text("""
                        SELECT r.id, r.proposal_id, r.parent_comment_id, r.user, r.comment, r.created_at,
                               p.title AS proposal_title
                        FROM comments r
                        JOIN comments parent ON r.parent_comment_id = parent.id
                        LEFT JOIN proposals p ON p.id = r.proposal_id
                        WHERE lower(parent.user) = lower(:user)
                          AND lower(COALESCE(r.user, '')) != lower(:user)
                        ORDER BY r.created_at DESC
                        LIMIT :limit
                    """),
                    {"user": clean_user, "limit": limit},
                ).fetchall()
                for row in rows:
                    data = getattr(row, "_mapping", row)
                    items.append({
                        "id": f"comment-reply-{data['id']}",
                        "type": "comment_reply",
                        "proposal_id": data["proposal_id"],
                        "comment_id": data["id"],
                        "parent_comment_id": data["parent_comment_id"],
                        "title": data["proposal_title"] or "Reply to your comment",
                        "actor": data["user"] or "Someone",
                        "body": data["comment"] or "",
                        "time": _format_timestamp(data["created_at"]),
                    })
        except Exception:
            db.rollback()

    add_recent_posts()
    return items[:limit]


# --- Comment endpoint ---
@app.get("/comments")
def list_comments(proposal_id: int, db: Session = Depends(get_db)):
    _ensure_comment_thread_columns(db)
    if CRUD_MODELS_AVAILABLE:
        comments = db.query(Comment).filter(Comment.proposal_id == proposal_id).all()
        return [_serialize_comment_record(db, comment) for comment in comments]

    result = db.execute(
        text("SELECT * FROM comments WHERE proposal_id = :pid"),
        {"pid": proposal_id},
    )
    return [_serialize_comment_record(db, comment) for comment in result.fetchall()]


@app.post("/comments")
def add_comment(
    c: CommentIn,
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    import datetime
    try:
        _enforce_token_identity_match(authorization, db, c.user)
        _ensure_comment_thread_columns(db)
        # --- 1. Obter ou criar Harmonizer ---
        author_obj = db.query(Harmonizer).filter(Harmonizer.username == c.user).first() if CRUD_MODELS_AVAILABLE else None
        if CRUD_MODELS_AVAILABLE and not author_obj:
            author_obj = Harmonizer(
                username=c.user,
                email=f"{c.user}@example.com",
                hashed_password="fallback",
                species=c.species or "human",
                profile_pic="default.jpg",
                created_at=datetime.datetime.utcnow(),
                is_active=True,
                is_admin=False,
                harmony_score=0.0,
                creative_spark=0.0,
                karma_score=0.0,
                network_centrality=0.0,
                last_passive_aura_timestamp=datetime.datetime.utcnow(),
                consent_given=True,
                bio=""
            )
            db.add(author_obj)
            db.commit()
            db.refresh(author_obj)

        species_value = getattr(author_obj, "species", c.species or "human") if author_obj else (c.species or "human")

        # --- 2. Obter ou criar VibeNode ---
        vibenode_id = None
        if CRUD_MODELS_AVAILABLE:
            vibenode_obj = db.query(VibeNode).first()
            if not vibenode_obj:
                vibenode_obj = VibeNode(
                    name="default",
                    author_id=author_obj.id if author_obj else 1
                )
                db.add(vibenode_obj)
                db.commit()
                db.refresh(vibenode_obj)
            vibenode_id = vibenode_obj.id

        # --- 3. Criar Comment ---
        comments_list = []
        if CRUD_MODELS_AVAILABLE:
            if author_obj and author_obj.id and vibenode_id:
                # Atualizar profile_pic se frontend enviou imagem
                if c.user_img and c.user_img.strip():
                    author_obj.profile_pic = c.user_img
                    db.add(author_obj)
                    db.commit()
                    db.refresh(author_obj)

                comment = Comment(
                    proposal_id=c.proposal_id,
                    content=c.comment,
                    author_id=author_obj.id,
                    vibenode_id=vibenode_id,
                    parent_comment_id=c.parent_comment_id,
                    created_at=datetime.datetime.utcnow()
                )
                db.add(comment)
                db.commit()
                db.refresh(comment)
                # Serializar comment com profile_pic somente se não for "default.jpg"
                comments_list = [_serialize_comment_record(db, comment)]
        else:
            user_img_value = c.user_img if c.user_img else ""
            created_at = datetime.datetime.utcnow()
            insert_payload = {
                "pid": c.proposal_id,
                "user": c.user or "Anonymous",
                "user_img": user_img_value,
                "comment": c.comment,
                "parent_comment_id": c.parent_comment_id,
                "created_at": created_at,
            }
            inserted_id = None
            try:
                inserted = db.execute(
                    text(
                        "INSERT INTO comments (proposal_id, user, user_img, comment, parent_comment_id, created_at) "
                        "VALUES (:pid, :user, :user_img, :comment, :parent_comment_id, :created_at) RETURNING id"
                    ),
                    insert_payload,
                ).fetchone()
                inserted_id = getattr(inserted, "id", None) if inserted else None
            except Exception:
                db.rollback()
                db.execute(
                    text("INSERT INTO comments (proposal_id, user, user_img, comment) VALUES (:pid, :user, :user_img, :comment)"),
                    insert_payload,
                )
                latest = db.execute(
                    text(
                        "SELECT id FROM comments WHERE proposal_id = :pid AND user = :user "
                        "ORDER BY id DESC LIMIT 1"
                    ),
                    insert_payload,
                ).fetchone()
                inserted_id = getattr(latest, "id", None) if latest else None
            db.commit()
            comments_list = [{
                "id": inserted_id,
                "proposal_id": c.proposal_id,
                "user": c.user or "Anonymous",
                "user_img": user_img_value,
                "species": c.species or "human",
                "comment": c.comment,
                "parent_comment_id": c.parent_comment_id,
                "created_at": _format_timestamp(created_at),
            }]

        return {
            "ok": True,
            "species": species_value,
            "comments": comments_list
        }
    except Exception as e:
        db.rollback()
        import traceback
        print("Failed to add comment:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to add comment: {str(e)}")


@app.patch("/comments/{comment_id}")
def update_comment(
    comment_id: int,
    payload: CommentUpdateIn,
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    requester = _safe_user_key(payload.user)
    next_comment = (payload.comment or "").strip()
    if not requester:
        raise HTTPException(status_code=400, detail="user is required")
    if not next_comment:
        raise HTTPException(status_code=400, detail="comment is required")
    _require_token_identity_match(authorization, db, payload.user)

    try:
        if CRUD_MODELS_AVAILABLE:
            comment = db.query(Comment).filter(Comment.id == comment_id).first()
            if not comment:
                raise HTTPException(status_code=404, detail="Comment not found")

            comment_author = ""
            if getattr(comment, "author", None) is not None:
                comment_author = getattr(comment.author, "username", "") or ""
            elif getattr(comment, "author_id", None):
                author_obj = db.query(Harmonizer).filter(Harmonizer.id == comment.author_id).first()
                comment_author = getattr(author_obj, "username", "") if author_obj else ""

            if requester != _safe_user_key(comment_author):
                raise HTTPException(status_code=403, detail="Only the comment author can edit this comment")

            comment.content = next_comment
            db.commit()
            db.refresh(comment)
            return _serialize_comment_record(db, comment)

        row = db.execute(
            text("SELECT * FROM comments WHERE id = :comment_id"),
            {"comment_id": comment_id},
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Comment not found")

        comment_author = getattr(row, "user", "") or ""
        if requester != _safe_user_key(comment_author):
            raise HTTPException(status_code=403, detail="Only the comment author can edit this comment")

        db.execute(
            text("UPDATE comments SET comment = :comment WHERE id = :comment_id"),
            {"comment": next_comment, "comment_id": comment_id},
        )
        db.commit()
        updated = db.execute(
            text("SELECT * FROM comments WHERE id = :comment_id"),
            {"comment_id": comment_id},
        ).fetchone()
        return _serialize_comment_record(db, updated)
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to edit comment: {str(exc)}")


@app.delete("/comments/{comment_id}")
def delete_comment(
    comment_id: int,
    user: str = Query(...),
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    requester = _safe_user_key(user)
    if not requester:
        raise HTTPException(status_code=400, detail="user is required")
    _require_token_identity_match(authorization, db, user)

    try:
        if CRUD_MODELS_AVAILABLE:
            comment = db.query(Comment).filter(Comment.id == comment_id).first()
            if not comment:
                raise HTTPException(status_code=404, detail="Comment not found")

            comment_author = ""
            if getattr(comment, "author", None) is not None:
                comment_author = getattr(comment.author, "username", "") or ""
            elif getattr(comment, "author_id", None):
                author_obj = db.query(Harmonizer).filter(Harmonizer.id == comment.author_id).first()
                comment_author = getattr(author_obj, "username", "") if author_obj else ""

            proposal_owner = ""
            proposal_id = getattr(comment, "proposal_id", None)
            if proposal_id:
                proposal = db.query(Proposal).filter(Proposal.id == proposal_id).first()
                if proposal:
                    proposal_owner = getattr(proposal, "userName", "") or ""
                    if not proposal_owner and getattr(proposal, "author_id", None):
                        owner_obj = db.query(Harmonizer).filter(Harmonizer.id == proposal.author_id).first()
                        proposal_owner = getattr(owner_obj, "username", "") if owner_obj else ""

            allowed = requester in {_safe_user_key(comment_author), _safe_user_key(proposal_owner)}
            if not allowed:
                raise HTTPException(status_code=403, detail="Only the comment author or post author can delete this comment")

            child_count = db.query(Comment).filter(Comment.parent_comment_id == comment_id).count()
            if child_count:
                comment.content = DELETED_COMMENT_TEXT
                db.commit()
                db.refresh(comment)
                return {
                    "ok": True,
                    "deleted": comment_id,
                    "tombstone": True,
                    "comment": _serialize_comment_record(db, comment),
                }

            parent_comment_id = getattr(comment, "parent_comment_id", None)
            db.query(Comment).filter(Comment.id == comment_id).delete()
            pruned_comment_ids = _prune_empty_deleted_comment_ancestors(db, parent_comment_id)
            db.commit()
            return {"ok": True, "deleted": comment_id, "tombstone": False, "pruned_comment_ids": pruned_comment_ids}

        row = db.execute(
            text("SELECT * FROM comments WHERE id = :comment_id"),
            {"comment_id": comment_id},
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Comment not found")

        comment_author = getattr(row, "user", "") or ""
        proposal_id = getattr(row, "proposal_id", None)
        proposal_owner = ""
        if proposal_id:
            proposal = db.execute(
                text("SELECT userName, author FROM proposals WHERE id = :pid"),
                {"pid": proposal_id},
            ).fetchone()
            if proposal:
                proposal_owner = getattr(proposal, "userName", "") or getattr(proposal, "author", "") or ""

        allowed = requester in {_safe_user_key(comment_author), _safe_user_key(proposal_owner)}
        if not allowed:
            raise HTTPException(status_code=403, detail="Only the comment author or post author can delete this comment")

        child_count = db.execute(
            text("SELECT COUNT(*) FROM comments WHERE parent_comment_id = :comment_id"),
            {"comment_id": comment_id},
        ).scalar() or 0
        if child_count:
            try:
                db.execute(
                    text(
                        "UPDATE comments SET comment = :deleted, user = :user, user_img = '' "
                        "WHERE id = :comment_id"
                    ),
                    {"deleted": DELETED_COMMENT_TEXT, "user": "[deleted]", "comment_id": comment_id},
                )
            except Exception:
                db.rollback()
                db.execute(
                    text("UPDATE comments SET comment = :deleted WHERE id = :comment_id"),
                    {"deleted": DELETED_COMMENT_TEXT, "comment_id": comment_id},
                )
            db.commit()
            updated = db.execute(
                text("SELECT * FROM comments WHERE id = :comment_id"),
                {"comment_id": comment_id},
            ).fetchone()
            return {
                "ok": True,
                "deleted": comment_id,
                "tombstone": True,
                "comment": _serialize_comment_record(db, updated),
            }

        parent_comment_id = getattr(row, "parent_comment_id", None)
        db.execute(text("DELETE FROM comments WHERE id = :comment_id"), {"comment_id": comment_id})
        pruned_comment_ids = _prune_empty_deleted_comment_ancestors(db, parent_comment_id)
        db.commit()
        return {"ok": True, "deleted": comment_id, "tombstone": False, "pruned_comment_ids": pruned_comment_ids}
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete comment: {str(exc)}")

# --- Karma endpoint ---
@app.get("/users/{username}/karma")
def get_user_karma(username: str, db: Session = Depends(get_db)):
    if not SUPER_NOVA_AVAILABLE:
        raise HTTPException(status_code=501, detail="Karma system not available")
    
    user = db.query(Harmonizer).filter(Harmonizer.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "username": user.username,
        "karma": float(user.karma_score),
        "harmony_score": float(user.harmony_score),
        "creative_spark": float(user.creative_spark),
        "species": user.species,
        "network_centrality": user.network_centrality
    }

# --- Restante dos endpoints (mantidos da sua versão) ---
@app.get("/decisions", response_model=List[DecisionSchema])
def list_decisions(db: Session = Depends(get_db)):
    if SUPER_NOVA_AVAILABLE:
        decisions = db.query(Decision).order_by(Decision.id.desc()).all()
        return [DecisionSchema(id=d.id, proposal_id=d.proposal_id, status=d.status) for d in decisions]
    else:
        result = db.execute(text("SELECT * FROM decisions ORDER BY id DESC"))
        return [DecisionSchema(id=d.id, proposal_id=d.proposal_id, status=d.status) for d in result.fetchall()]

@app.post("/runs", response_model=RunSchema)
def create_run(decision_id: int, db: Session = Depends(get_db)):
    try:
        if SUPER_NOVA_AVAILABLE:
            run = Run(decision_id=decision_id, status="done")
            db.add(run)
        else:
            db.execute(
                text("INSERT INTO runs (decision_id, status) VALUES (:did, 'done')"),
                {"did": decision_id}
            )
        
        db.commit()
        
        if SUPER_NOVA_AVAILABLE:
            db.refresh(run)
            return RunSchema(id=run.id, decision_id=run.decision_id, status=run.status)
        else:
            result = db.execute(
                text("SELECT * FROM runs WHERE decision_id = :did ORDER BY id DESC LIMIT 1"),
                {"did": decision_id}
            )
            row = result.fetchone()
            return RunSchema(id=row.id, decision_id=row.decision_id, status=row.status)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create run: {str(e)}")

@app.get("/runs", response_model=List[RunSchema])
def list_runs(db: Session = Depends(get_db)):
    if SUPER_NOVA_AVAILABLE:
        runs = db.query(Run).order_by(Run.id.desc()).all()
        return [RunSchema(id=r.id, decision_id=r.decision_id, status=r.status) for r in runs]
    else:
        result = db.execute(text("SELECT * FROM runs ORDER BY id DESC"))
        return [RunSchema(id=r.id, decision_id=r.decision_id, status=r.status) for r in result.fetchall()]

# --- Proposal detail endpoint (final version, single definition) ---
@app.get("/proposals/{pid}", response_model=ProposalSchema)
def get_proposal(pid: int, db: Session = Depends(get_db)):
    if CRUD_MODELS_AVAILABLE:
        row = db.query(Proposal).filter(Proposal.id == pid).first()
        if not row:
            raise HTTPException(status_code=404, detail="Proposal not found")

        # Garantir que userName é sempre uma string do username do utilizador (Harmonizer.username) se possível
        user_name = ""
        author_obj = None
        if hasattr(row, "author_id") and row.author_id:
            author_obj = db.query(Harmonizer).filter(Harmonizer.id == row.author_id).first()
            if author_obj and hasattr(author_obj, "username"):
                user_name = author_obj.username
        if not user_name:
            if hasattr(row, "userName") and row.userName:
                user_name = row.userName
            elif hasattr(row, "author_username") and row.author_username:
                user_name = row.author_username
            elif hasattr(row, "author") and row.author:
                user_name = row.author
            else:
                user_name = "Unknown"
        if author_obj is None:
            author_obj = _find_harmonizer_by_username(db, user_name)
        user_initials = (user_name[:2].upper() if user_name else "UN")

        votes = db.query(ProposalVote).filter(ProposalVote.proposal_id == pid).all()
        # Serialize Harmonizer for likes/dislikes
        likes = []
        dislikes = []
        for v in votes:
            like_entry, dislike_entry = _serialize_vote_record(db, v)
            if like_entry:
                likes.append(like_entry)
            if dislike_entry:
                dislikes.append(dislike_entry)

        comments = db.query(Comment).filter(Comment.proposal_id == pid).all()
        comments_list = [_serialize_comment_record(db, c) for c in comments]

        author_img = row.author_img
        if author_obj is not None:
            author_img = getattr(author_obj, "profile_pic", None) or author_img

        author_metadata = _profile_metadata(db, user_name)
        return ProposalSchema(
            id=row.id,
            title=row.title,
            text=row.description,
            userName=str(user_name),
            userInitials=user_initials,
            author_img=_social_avatar(author_img),
            time=_format_timestamp(row.created_at),
            author_type=row.author_type,
            profile_url=author_metadata.get("domain_url", ""),
            domain_as_profile=bool(author_metadata.get("domain_as_profile", False)),
            likes=likes,
            dislikes=dislikes,
            comments=comments_list,
            media=_media_payload(row.image, row.video, row.link, row.file, getattr(row, "payload", None), row.voting_deadline)
        )
    else:
        result = db.execute(
            text("SELECT * FROM proposals WHERE id = :pid"),
            {"pid": pid}
        )
        row = result.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Proposal not found")

        votes_result = db.execute(
            text("SELECT * FROM proposal_votes WHERE proposal_id = :pid"),
            {"pid": pid}
        )
        votes = votes_result.fetchall()
        likes = []
        dislikes = []
        for vote in votes:
            like_entry, dislike_entry = _serialize_vote_record(db, vote)
            if like_entry:
                likes.append(like_entry)
            if dislike_entry:
                dislikes.append(dislike_entry)

        comments_result = db.execute(
            text("SELECT * FROM comments WHERE proposal_id = :pid"),
            {"pid": pid}
        )
        comments = comments_result.fetchall()
        comments_list = [_serialize_comment_record(db, c) for c in comments]

        user_name = getattr(row, "userName", None) or getattr(row, "author", None) or "Unknown"
        author_obj = _find_harmonizer_by_username(db, user_name)
        author_img = getattr(row, "author_img", "")
        if author_obj is not None:
            author_img = getattr(author_obj, "profile_pic", None) or author_img
        user_initials = (user_name[:2].upper() if user_name else "UN")
        author_metadata = _profile_metadata(db, user_name)
        return ProposalSchema(
            id=row.id,
            title=row.title,
            text=getattr(row, "body", None) or getattr(row, "description", ""),
            userName=str(user_name),
            userInitials=user_initials,
            author_img=_social_avatar(author_img),
            time=_format_timestamp(getattr(row, "date", "") or getattr(row, "created_at", "")),
            author_type=getattr(row, "author_type", ""),
            profile_url=author_metadata.get("domain_url", ""),
            domain_as_profile=bool(author_metadata.get("domain_as_profile", False)),
            likes=likes,
            dislikes=dislikes,
            comments=comments_list,
            media=_media_payload(
                getattr(row, "image", ""),
                getattr(row, "video", ""),
                getattr(row, "link", ""),
                getattr(row, "file", ""),
                getattr(row, "payload", None),
                getattr(row, "voting_deadline", None),
            )
        )

# --- Upload endpoints ---
@app.post("/upload-image")
async def upload_image(
    file: UploadFile = File(...),
    username: Optional[str] = Form(None),
    user_id: Optional[str] = Form(None),
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    os.makedirs(uploads_dir, exist_ok=True)
    if not _upload_matches(file, "image/", IMAGE_UPLOAD_EXTENSIONS):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image")

    clean_username = (username or "").strip()
    clean_user_id = (user_id or "").strip()
    sync_error = ""
    user = None
    if (clean_username or clean_user_id) and Harmonizer is not None:
        try:
            if clean_user_id:
                try:
                    user = db.query(Harmonizer).filter(Harmonizer.id == int(clean_user_id)).first()
                except (TypeError, ValueError):
                    user = None
            if user is None and clean_username:
                user = db.query(Harmonizer).filter(func.lower(Harmonizer.username) == clean_username.lower()).first()
            if user is not None:
                _require_token_identity_match(authorization, db, getattr(user, "username", ""))
        except HTTPException:
            raise
        except Exception as exc:
            db.rollback()
            sync_error = str(exc)

    unique_name = _save_upload_file(file, IMAGE_UPLOAD_EXTENSIONS, ".jpg", UPLOAD_AVATAR_MAX_BYTES)

    avatar_url = f"/uploads/{unique_name}"
    profile_synced = False
    if user is not None:
        try:
            user.profile_pic = avatar_url
            db.add(user)
            db.commit()
            db.refresh(user)
            _sync_user_avatar_references(db, user.username, avatar_url, getattr(user, "id", None))
            profile_synced = True
        except Exception as exc:
            db.rollback()
            sync_error = str(exc)

    return {
        "filename": unique_name,
        "url": avatar_url,
        "content_type": file.content_type,
        "profile_synced": profile_synced,
        "sync_error": sync_error,
    }

@app.post("/upload-file")
async def upload_file(file: UploadFile = File(...)):
    os.makedirs(uploads_dir, exist_ok=True)
    if _safe_upload_extension(file) not in DOCUMENT_UPLOAD_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Uploaded file type is not supported")
    unique_name = _save_upload_file(file, DOCUMENT_UPLOAD_EXTENSIONS, max_bytes=UPLOAD_DOCUMENT_MAX_BYTES)
    return {"filename": unique_name, "url": f"/uploads/{unique_name}"}

# --- Delete endpoints ---
@app.patch("/proposals/{pid}", response_model=ProposalSchema)
def update_proposal(
    pid: int,
    payload: ProposalUpdateIn,
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    author = (payload.author or "").strip()
    next_body = (payload.body or "").strip()
    next_title = (payload.title or "").strip() or (next_body[:70] if next_body else "")
    if not author:
        raise HTTPException(status_code=400, detail="author is required")
    if not next_body and not next_title:
        raise HTTPException(status_code=400, detail="Nothing to update")
    _enforce_token_identity_match(authorization, db, author)

    try:
        if CRUD_MODELS_AVAILABLE:
            row = db.query(Proposal).filter(Proposal.id == pid).first()
            if not row:
                raise HTTPException(status_code=404, detail="Proposal not found")
            owner = getattr(row, "userName", "") or getattr(row, "author", "")
            if not owner or owner.lower() != author.lower():
                raise HTTPException(status_code=403, detail="Only the author can edit this post")
            if next_title:
                row.title = next_title
            if next_body:
                row.description = next_body
            db.add(row)
            db.commit()
            db.refresh(row)
        else:
            current = db.execute(text("SELECT * FROM proposals WHERE id = :pid"), {"pid": pid}).fetchone()
            if not current:
                raise HTTPException(status_code=404, detail="Proposal not found")
            owner = getattr(current, "userName", None) or getattr(current, "author", "")
            if not owner or str(owner).lower() != author.lower():
                raise HTTPException(status_code=403, detail="Only the author can edit this post")
            db.execute(
                text("UPDATE proposals SET title = :title, description = :description WHERE id = :pid"),
                {"title": next_title or getattr(current, "title", ""), "description": next_body or getattr(current, "description", ""), "pid": pid},
            )
            db.commit()
            row = db.execute(text("SELECT * FROM proposals WHERE id = :pid"), {"pid": pid}).fetchone()

        return get_proposal(pid, db)
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update proposal: {str(e)}")


@app.delete("/proposals/{pid}")
def delete_proposal(
    pid: int,
    author: Optional[str] = Query(None),
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    clean_author = (author or "").strip()
    if not clean_author:
        raise HTTPException(status_code=400, detail="author is required")
    _enforce_token_identity_match(authorization, db, clean_author)
    try:
        if CRUD_MODELS_AVAILABLE:
            row = db.query(Proposal).filter(Proposal.id == pid).first()
            if not row:
                raise HTTPException(status_code=404, detail="Proposal not found")
            owner = getattr(row, "userName", "") or getattr(row, "author", "")
            if not owner or owner.lower() != clean_author.lower():
                raise HTTPException(status_code=403, detail="Only the author can delete this post")
            db.query(Comment).filter(Comment.proposal_id == pid).delete()
            db.query(ProposalVote).filter(ProposalVote.proposal_id == pid).delete()
            db.query(Proposal).filter(Proposal.id == pid).delete()
        else:
            row = db.execute(text("SELECT * FROM proposals WHERE id = :pid"), {"pid": pid}).fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Proposal not found")
            owner = getattr(row, "userName", None) or getattr(row, "author", "")
            if not owner or str(owner).lower() != clean_author.lower():
                raise HTTPException(status_code=403, detail="Only the author can delete this post")
            db.execute(text("DELETE FROM comments WHERE proposal_id = :pid"), {"pid": pid})
            db.execute(text("DELETE FROM proposal_votes WHERE proposal_id = :pid"), {"pid": pid})
            db.execute(text("DELETE FROM proposals WHERE id = :pid"), {"pid": pid})
        
        db.commit()
        return {"ok": True, "deleted_id": pid}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete proposal: {str(e)}")

@app.delete("/proposals")
def delete_all_proposals(
    x_confirm_delete: Optional[str] = Header(default=None, alias="x-confirm-delete"),
    db: Session = Depends(get_db),
):
    """Delete all proposals. Requires 'x-confirm-delete: yes' header to prevent accidental calls."""
    if os.environ.get("ENABLE_BULK_PROPOSAL_DELETE", "").strip().lower() != "true":
        raise HTTPException(status_code=403, detail="Bulk proposal deletion is disabled")
    if x_confirm_delete != "yes":
        raise HTTPException(
            status_code=400,
            detail="Send header 'x-confirm-delete: yes' to confirm bulk deletion"
        )
    try:
        if CRUD_MODELS_AVAILABLE:
            db.query(Comment).delete()
            db.query(ProposalVote).delete()
            deleted_count = db.query(Proposal).delete()
        else:
            db.execute(text("DELETE FROM comments"))
            db.execute(text("DELETE FROM proposal_votes"))
            result = db.execute(text("DELETE FROM proposals"))
            deleted_count = result.rowcount
        
        db.commit()
        return {"ok": True, "deleted_count": deleted_count}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete all proposals: {str(e)}")





# --- Register routers ---

# Import routers from backend package
try:
    from .votes_router import router as votes_router
except ImportError:  # pragma: no cover - supports running backend/app.py directly
    from votes_router import router as votes_router

try:
    from supernova_2177_ui_weighted.login_router import router as login_router
except ImportError:  # pragma: no cover - supports running from the core directory on sys.path
    from login_router import router as login_router

app.include_router(votes_router)
app.include_router(login_router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

