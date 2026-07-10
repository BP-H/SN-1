import re
import unicodedata
from typing import Any
from urllib.parse import quote


_UNSAFE_ROUTE_CHARACTERS = re.compile(r"[\\/?#\x00-\x1f\x7f]")


def normalize_public_route_segment(value: Any, max_code_points: int = 80) -> str:
    normalized = unicodedata.normalize("NFC", str(value or "")).strip().lstrip("@")
    safe = _UNSAFE_ROUTE_CHARACTERS.sub("", normalized)
    return safe[: max(0, int(max_code_points))]


def public_route_path(prefix: str, value: Any) -> str:
    segment = normalize_public_route_segment(value)
    clean_prefix = "/" + str(prefix or "").strip("/")
    return f"{clean_prefix}/{quote(segment, safe='')}" if segment else clean_prefix


def public_profile_path(value: Any) -> str:
    return public_route_path("users", value)
