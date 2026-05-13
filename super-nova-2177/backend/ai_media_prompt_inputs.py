import base64
import os
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional


def clean_public_url(value: Optional[str]) -> str:
    raw = str(value or "").strip().rstrip("/")
    if not raw or any(ch.isspace() for ch in raw):
        return ""
    if raw.startswith(("http://", "https://")):
        return raw
    if "." in raw and "/" not in raw:
        return f"https://{raw}"
    return ""


def railway_public_url_from_env(environ: Optional[Dict[str, str]] = None) -> str:
    source = os.environ if environ is None else environ
    return (
        clean_public_url(source.get("RAILWAY_STATIC_URL"))
        or clean_public_url(source.get("RAILWAY_PUBLIC_DOMAIN"))
    )


def resolve_media_public_base_url(
    *,
    public_base_url: str,
    environ: Optional[Dict[str, str]] = None,
) -> str:
    source = os.environ if environ is None else environ
    return (
        clean_public_url(source.get("SUPERNOVA_MEDIA_PUBLIC_URL"))
        or clean_public_url(source.get("PUBLIC_MEDIA_BASE_URL"))
        or clean_public_url(source.get("SUPERNOVA_BACKEND_PUBLIC_URL"))
        or clean_public_url(source.get("BACKEND_PUBLIC_URL"))
        or clean_public_url(source.get("PUBLIC_API_BASE_URL"))
        or clean_public_url(source.get("SUPERNOVA_API_BASE_URL"))
        or clean_public_url(source.get("NEXT_PUBLIC_API_URL"))
        or clean_public_url(source.get("BACKEND_URL"))
        or railway_public_url_from_env(source)
        or public_base_url
    )


def absolute_public_media_url(
    value: str,
    *,
    uploads_url: Callable[[str], str],
    public_base_url: str,
    media_public_base_url: str,
) -> str:
    media = uploads_url(value)
    if not media:
        return ""
    if media.startswith(("http://", "https://", "data:image/")):
        return media
    if media.startswith("/uploads/"):
        return f"{media_public_base_url.rstrip('/')}{media}"
    if media.startswith("/"):
        return f"{public_base_url.rstrip('/')}{media}"
    return media


def image_media_type_from_upload_path(
    full_path: Path,
    content_type: Optional[str] = None,
    sniff_media_type: Optional[Callable[[Path], str]] = None,
) -> str:
    media_type = str(content_type or "").strip().lower()
    if media_type.startswith("image/"):
        return media_type
    sniffed = sniff_media_type(full_path) if sniff_media_type else ""
    if str(sniffed or "").startswith("image/"):
        return sniffed
    return {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".avif": "image/avif",
        ".bmp": "image/bmp",
        ".heic": "image/heic",
        ".heif": "image/heif",
    }.get(full_path.suffix.lower(), "")


def image_data_url_from_upload_path(
    full_path: Path,
    *,
    max_bytes: int,
    content_type: Optional[str] = None,
    sniff_media_type: Optional[Callable[[Path], str]] = None,
) -> str:
    if max_bytes <= 0:
        return ""
    try:
        size = full_path.stat().st_size
    except OSError:
        return ""
    if size <= 0 or size > max_bytes:
        return ""
    media_type = image_media_type_from_upload_path(
        full_path,
        content_type,
        sniff_media_type,
    )
    if not media_type.startswith("image/"):
        return ""
    try:
        encoded = base64.b64encode(full_path.read_bytes()).decode("ascii")
    except OSError:
        return ""
    return f"data:{media_type};base64,{encoded}"


def image_data_url_from_upload_file(
    file_name: str,
    *,
    uploads_dir: str,
    max_bytes: int,
    content_type: Optional[str] = None,
    sniff_media_type: Optional[Callable[[Path], str]] = None,
) -> str:
    clean_name = str(file_name or "").strip()
    if not clean_name or "/" in clean_name or "\\" in clean_name:
        return ""
    return image_data_url_from_upload_path(
        Path(uploads_dir) / clean_name,
        max_bytes=max_bytes,
        content_type=content_type,
        sniff_media_type=sniff_media_type,
    )


def image_data_url_from_upload_media_value(
    value: str,
    *,
    uploads_dir: str,
    max_bytes: int,
    upload_relative_path: Callable[[str], str],
    sniff_media_type: Optional[Callable[[Path], str]] = None,
) -> str:
    relative = upload_relative_path(value)
    if not relative:
        return ""
    try:
        root = Path(uploads_dir).resolve()
        full_path = (root / relative).resolve()
        full_path.relative_to(root)
    except Exception:
        return ""
    return image_data_url_from_upload_path(
        full_path,
        max_bytes=max_bytes,
        sniff_media_type=sniff_media_type,
    )


def proposal_openai_media_payload(
    proposal_context: Dict[str, Any],
    *,
    uploads_dir: str,
    max_bytes: int,
    upload_relative_path: Callable[[str], str],
    sniff_media_type: Optional[Callable[[Path], str]] = None,
) -> Dict[str, Any]:
    media = dict((proposal_context or {}).get("media") or {})
    image_data_urls: List[str] = []
    for image_url in (media.get("image_urls") or [])[:3]:
        image_data_url = image_data_url_from_upload_media_value(
            image_url,
            uploads_dir=uploads_dir,
            max_bytes=max_bytes,
            upload_relative_path=upload_relative_path,
            sniff_media_type=sniff_media_type,
        )
        if image_data_url and image_data_url not in image_data_urls:
            image_data_urls.append(image_data_url)
    if image_data_urls:
        public_image_urls = media.pop("image_urls", [])
        media["public_media_reference_text"] = ", ".join(
            str(url) for url in public_image_urls if str(url or "").strip()
        )
        media["image_data_urls"] = image_data_urls
    return media


def collect_openai_image_urls(value: Any, *, limit: int = 4) -> List[str]:
    urls: List[str] = []

    def visit(item: Any) -> None:
        if len(urls) >= limit:
            return
        if isinstance(item, dict):
            for key, nested in item.items():
                key_text = str(key or "").lower()
                if key_text in {"image_url", "image_urls", "image_data_url", "image_data_urls", "public_image_urls"}:
                    visit(nested)
                elif isinstance(nested, (dict, list, tuple)):
                    visit(nested)
            return
        if isinstance(item, (list, tuple)):
            for nested in item:
                visit(nested)
                if len(urls) >= limit:
                    break
            return
        text_value = str(item or "").strip()
        if not text_value:
            return
        if text_value.startswith(("http://", "https://", "data:image/")) and text_value not in urls:
            urls.append(text_value)

    visit(value)
    return urls[:limit]


def redact_image_data_urls(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: redact_image_data_urls(nested) for key, nested in value.items()}
    if isinstance(value, list):
        return [redact_image_data_urls(item) for item in value]
    if isinstance(value, tuple):
        return [redact_image_data_urls(item) for item in value]
    text_value = str(value or "")
    if text_value.startswith("data:image/"):
        return "[image data sent as OpenAI image_url input]"
    return value
