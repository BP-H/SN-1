#!/usr/bin/env python3
"""Read-only preflight for AI media prompt image URL handling.

The script checks how /uploads media URLs resolve for AI image prompt inputs.
It never writes files, mutates a database, uploads/deletes media, or prints raw
data:image payloads.
"""

from __future__ import annotations

import argparse
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = PROJECT_ROOT / "super-nova-2177" / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from ai_media_prompt_inputs import (  # noqa: E402
    absolute_public_media_url,
    clean_public_url,
    redact_image_data_urls,
    resolve_media_public_base_url,
)


MEDIA_OR_BACKEND_ENV_KEYS = (
    "SUPERNOVA_MEDIA_PUBLIC_URL",
    "PUBLIC_MEDIA_BASE_URL",
    "SUPERNOVA_BACKEND_PUBLIC_URL",
    "BACKEND_PUBLIC_URL",
    "PUBLIC_API_BASE_URL",
    "SUPERNOVA_API_BASE_URL",
    "NEXT_PUBLIC_API_URL",
    "BACKEND_URL",
    "RAILWAY_STATIC_URL",
    "RAILWAY_PUBLIC_DOMAIN",
)


def status_line(level: str, message: str) -> str:
    return f"{level}: {message}"


def normalize_upload_path(value: str) -> str:
    clean = str(value or "").strip()
    if not clean:
        return ""
    if clean.startswith("data:image/"):
        return ""
    if clean.startswith(("http://", "https://")):
        parsed = urllib.parse.urlparse(clean)
        if parsed.path.startswith("/uploads/"):
            return parsed.path
        return ""
    if clean.startswith("/uploads/"):
        return clean
    if clean.startswith("uploads/"):
        return f"/{clean}"
    return ""


def uploads_url(value: str) -> str:
    path = normalize_upload_path(value)
    return path


def build_environ(args: argparse.Namespace) -> dict[str, str]:
    environ = dict(os.environ)
    if args.media_public_base_url:
        environ["SUPERNOVA_MEDIA_PUBLIC_URL"] = args.media_public_base_url
    if args.backend_url:
        environ["SUPERNOVA_BACKEND_PUBLIC_URL"] = args.backend_url
    return environ


def explicit_media_or_backend_env_present(environ: dict[str, str]) -> bool:
    return any(clean_public_url(environ.get(key)) for key in MEDIA_OR_BACKEND_ENV_KEYS)


def probe_url(url: str, timeout: float) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        method="HEAD",
        headers={"Accept": "*/*", "User-Agent": "SuperNova-ai-media-preflight/1.0"},
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return {
                "ok": 200 <= getattr(response, "status", 0) < 300,
                "status": getattr(response, "status", None),
                "content_type": response.headers.get("Content-Type", "")
                .split(";", 1)[0]
                .strip()
                .lower(),
                "method": "HEAD",
            }
    except urllib.error.HTTPError as exc:
        if exc.code not in {405, 501}:
            return {
                "ok": False,
                "status": exc.code,
                "content_type": (exc.headers.get("Content-Type", "") if exc.headers else "")
                .split(";", 1)[0]
                .strip()
                .lower(),
                "method": "HEAD",
                "error": str(exc),
            }
    except Exception as exc:
        return {"ok": False, "status": None, "content_type": "", "method": "HEAD", "error": str(exc)}

    request = urllib.request.Request(
        url,
        headers={"Accept": "*/*", "User-Agent": "SuperNova-ai-media-preflight/1.0"},
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            response.read(1024)
            return {
                "ok": 200 <= getattr(response, "status", 0) < 300,
                "status": getattr(response, "status", None),
                "content_type": response.headers.get("Content-Type", "")
                .split(";", 1)[0]
                .strip()
                .lower(),
                "method": "GET",
            }
    except urllib.error.HTTPError as exc:
        return {
            "ok": False,
            "status": exc.code,
            "content_type": (exc.headers.get("Content-Type", "") if exc.headers else "")
            .split(";", 1)[0]
            .strip()
            .lower(),
            "method": "GET",
            "error": str(exc),
        }
    except Exception as exc:
        return {"ok": False, "status": None, "content_type": "", "method": "GET", "error": str(exc)}


def build_report(args: argparse.Namespace) -> tuple[list[str], int]:
    lines: list[str] = []
    exit_code = 0
    environ = build_environ(args)
    public_base_url = (
        clean_public_url(args.public_base_url)
        or clean_public_url(environ.get("SUPERNOVA_PUBLIC_URL"))
        or clean_public_url(environ.get("PUBLIC_BASE_URL"))
        or clean_public_url(environ.get("NEXT_PUBLIC_SITE_URL"))
        or "https://2177.tech"
    )
    media_public_base_url = resolve_media_public_base_url(
        public_base_url=public_base_url,
        environ=environ,
    )
    sample_path = normalize_upload_path(
        args.sample_upload_path
        or environ.get("SUPERNOVA_SAMPLE_UPLOAD_PATH")
        or "/uploads/example.png"
    )
    sample_url = absolute_public_media_url(
        sample_path,
        uploads_url=uploads_url,
        public_base_url=public_base_url,
        media_public_base_url=media_public_base_url,
    )

    lines.append(status_line("PASS", f"public base URL resolves to {public_base_url}"))
    lines.append(status_line("PASS", f"media base URL resolves to {media_public_base_url}"))
    if sample_path:
        lines.append(status_line("PASS", f"sample upload path resolves to {sample_url}"))
    else:
        lines.append(status_line("WARN", "sample upload path was not a /uploads/... path; URL probe skipped"))

    if (
        media_public_base_url.rstrip("/") == public_base_url.rstrip("/")
        and not explicit_media_or_backend_env_present(environ)
    ):
        lines.append(
            status_line(
                "WARN",
                "media base falls back to the public frontend/site origin; set a backend/media env for /uploads AI image prompts",
            )
        )

    redacted = redact_image_data_urls({"image_data_urls": ["data:image/png;base64,not-printed"]})
    if "not-printed" in str(redacted):
        lines.append(status_line("FAIL", "raw data:image body redaction check failed"))
        exit_code = 1
    else:
        lines.append(status_line("PASS", "raw data:image bodies are redacted in script diagnostics"))

    if args.check_url and sample_url:
        probe = probe_url(sample_url, timeout=args.timeout)
        method = probe.get("method") or "HEAD/GET"
        status = probe.get("status")
        content_type = probe.get("content_type") or "unknown"
        if probe.get("ok"):
            lines.append(status_line("PASS", f"{method} {sample_url} returned {status} {content_type}"))
            if content_type == "text/plain":
                lines.append(
                    status_line(
                        "WARN",
                        "sample upload returned text/plain; image prompts may need MIME serving review",
                    )
                )
        else:
            lines.append(
                status_line(
                    "FAIL",
                    f"{method} {sample_url} failed with status {status}: {probe.get('error') or 'unreachable'}",
                )
            )
            exit_code = 1
    elif sample_url:
        lines.append(status_line("WARN", "network probe not run; pass --check-url to HEAD/GET the sample upload URL"))

    return lines, exit_code


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Read-only AI media prompt input preflight.")
    parser.add_argument(
        "--public-base-url",
        default="",
        help="Public frontend/site URL. Defaults to env or https://2177.tech.",
    )
    parser.add_argument(
        "--media-public-base-url",
        default="",
        help="Explicit media/backend URL for /uploads prompt inputs.",
    )
    parser.add_argument(
        "--backend-url",
        default="",
        help="Backend URL alias used when media-public-base-url is not provided.",
    )
    parser.add_argument(
        "--sample-upload-path",
        default="/uploads/example.png",
        help="Sample /uploads path or URL to resolve.",
    )
    parser.add_argument(
        "--check-url",
        action="store_true",
        help="Perform read-only HEAD/GET probe for the resolved sample URL.",
    )
    parser.add_argument("--timeout", type=float, default=7.0, help="Request timeout in seconds for --check-url.")
    args = parser.parse_args(argv)

    lines, exit_code = build_report(args)
    for line in lines:
        print(line)
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
