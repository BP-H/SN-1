#!/usr/bin/env python3
"""Read-only media URL inventory for a public SuperNova backend.

This script performs only unauthenticated GET requests against public endpoints
and sampled /uploads URLs. It never writes files, deletes uploads, reads the
database directly, runs migrations, or prints secret-bearing query strings.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any


PROPOSALS_PATH_TEMPLATE = "/proposals?filter=latest&limit={limit}"
IMAGE_FIELDS = {"image", "images", "created_image"}
VIDEO_FIELDS = {"video"}
FILE_FIELDS = {"file"}
LINK_FIELDS = {"link"}


def normalize_backend_url(value: str) -> str:
    clean = (value or "").strip().rstrip("/")
    if not clean:
        raise ValueError("backend URL is required")
    if not clean.startswith(("http://", "https://")):
        raise ValueError("backend URL must start with http:// or https://")
    return clean


def fetch_json(base_url: str, path: str, timeout: float) -> dict[str, Any]:
    url = urllib.parse.urljoin(f"{base_url}/", path.lstrip("/"))
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read()
            try:
                body = json.loads(raw.decode("utf-8"))
            except Exception as exc:
                return {
                    "ok": False,
                    "status": getattr(response, "status", None),
                    "url": redact_url(url),
                    "error": f"invalid JSON: {exc}",
                }
            return {
                "ok": 200 <= getattr(response, "status", 0) < 300,
                "status": getattr(response, "status", None),
                "url": redact_url(url),
                "body": body,
            }
    except urllib.error.HTTPError as exc:
        return {"ok": False, "status": exc.code, "url": redact_url(url), "error": str(exc)}
    except Exception as exc:
        return {"ok": False, "status": None, "url": redact_url(url), "error": str(exc)}


def append_media_candidate(
    values: list[dict[str, Any]],
    seen: set[tuple[Any, str, str]],
    *,
    proposal_id: Any,
    field: str,
    kind: str,
    value: Any,
) -> None:
    if isinstance(value, list):
        for index, item in enumerate(value):
            append_media_candidate(
                values,
                seen,
                proposal_id=proposal_id,
                field=f"{field}[{index}]",
                kind=kind,
                value=item,
            )
        return
    if not isinstance(value, str):
        return
    clean = value.strip()
    if not clean:
        return
    key = (proposal_id, field, clean)
    if key in seen:
        return
    seen.add(key)
    values.append(
        {
            "proposal_id": proposal_id,
            "field": field,
            "media_kind": kind,
            "raw_url": clean,
        }
    )


def media_kind_for_field(field: str) -> str:
    base = field.split("[", 1)[0]
    if base in IMAGE_FIELDS:
        return "image"
    if base in VIDEO_FIELDS:
        return "video"
    if base in FILE_FIELDS:
        return "file"
    if base in LINK_FIELDS:
        return "link"
    return "media"


def collect_media_candidates(proposals: Any) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    seen: set[tuple[Any, str, str]] = set()
    if not isinstance(proposals, list):
        return candidates

    for proposal in proposals:
        if not isinstance(proposal, dict):
            continue
        proposal_id = proposal.get("id")
        media = proposal.get("media")
        if isinstance(media, dict):
            for field in sorted(IMAGE_FIELDS | VIDEO_FIELDS | FILE_FIELDS | LINK_FIELDS):
                append_media_candidate(
                    candidates,
                    seen,
                    proposal_id=proposal_id,
                    field=f"media.{field}",
                    kind=media_kind_for_field(field),
                    value=media.get(field),
                )
        for field in sorted(IMAGE_FIELDS | VIDEO_FIELDS | FILE_FIELDS | LINK_FIELDS):
            append_media_candidate(
                candidates,
                seen,
                proposal_id=proposal_id,
                field=field,
                kind=media_kind_for_field(field),
                value=proposal.get(field),
            )
    return candidates


def redact_url(value: str) -> str:
    clean = str(value or "").strip()
    if clean.startswith("data:image/"):
        media_type = clean.split(";", 1)[0]
        return f"{media_type};base64,<redacted>"
    if clean.startswith("data:"):
        return "data:<redacted>"
    try:
        parsed = urllib.parse.urlparse(clean)
    except Exception:
        return clean[:180]
    if parsed.scheme in {"http", "https"}:
        return urllib.parse.urlunparse((parsed.scheme, parsed.netloc, parsed.path, "", "", ""))
    return clean[:240]


def classify_media_url(base_url: str, raw_url: str) -> dict[str, Any]:
    clean = (raw_url or "").strip()
    parsed_base = urllib.parse.urlparse(base_url)
    if clean.startswith("data:image/"):
        return {
            "url": redact_url(clean),
            "url_type": "data_image",
            "skip_reason": "inline_data_image",
        }
    if clean.startswith("data:"):
        return {
            "url": redact_url(clean),
            "url_type": "data",
            "skip_reason": "inline_non_image_data_url",
        }
    if clean.startswith("/uploads/") or clean.startswith("uploads/"):
        path = clean if clean.startswith("/") else f"/{clean}"
        return {
            "url": redact_url(path),
            "url_type": "upload",
            "fetch_url": urllib.parse.urljoin(f"{base_url}/", path.lstrip("/")),
        }
    try:
        parsed = urllib.parse.urlparse(clean)
    except Exception:
        return {"url": redact_url(clean), "url_type": "unknown", "skip_reason": "invalid_url"}
    if parsed.scheme in {"http", "https"} and parsed.path.startswith("/uploads/"):
        if parsed.netloc.lower() != parsed_base.netloc.lower():
            return {
                "url": redact_url(clean),
                "url_type": "upload",
                "skip_reason": "external_upload_host",
            }
        return {"url": redact_url(clean), "url_type": "upload", "fetch_url": clean}
    return {"url": redact_url(clean), "url_type": "external_or_non_upload", "skip_reason": "not_upload_url"}


def probe_upload_url(fetch_url: str, timeout: float, max_bytes: int) -> dict[str, Any]:
    request = urllib.request.Request(fetch_url, headers={"Accept": "*/*", "User-Agent": "SuperNova-media-inventory/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            content_type = response.headers.get("Content-Type", "")
            sample = response.read(max(0, max_bytes))
            return {
                "status": getattr(response, "status", None),
                "content_type": content_type.split(";", 1)[0].strip().lower(),
                "bytes_sampled": len(sample),
            }
    except urllib.error.HTTPError as exc:
        return {
            "status": exc.code,
            "content_type": (exc.headers.get("Content-Type", "") if exc.headers else "").split(";", 1)[0].strip().lower(),
            "error": str(exc),
        }
    except Exception as exc:
        return {"status": None, "content_type": "", "error": str(exc)}


def media_flags(media_kind: str, result: dict[str, Any]) -> list[str]:
    flags: list[str] = []
    status = result.get("status")
    content_type = str(result.get("content_type") or "").lower()
    if status != 200:
        flags.append("missing_or_unreachable_upload")
        return flags
    if media_kind == "image":
        if content_type == "text/plain":
            flags.append("text_plain_image")
        elif not content_type.startswith("image/"):
            flags.append("non_image_mime_for_image")
    if media_kind == "video":
        if content_type == "text/plain":
            flags.append("text_plain_video")
        elif not content_type.startswith("video/"):
            flags.append("non_video_mime_for_video")
    return flags


def build_inventory(base_url: str, limit: int, max_urls: int, timeout: float, max_bytes: int) -> dict[str, Any]:
    proposals_path = PROPOSALS_PATH_TEMPLATE.format(limit=limit)
    proposals_response = fetch_json(base_url, proposals_path, timeout)
    proposals = proposals_response.get("body") if proposals_response.get("ok") else []
    if not isinstance(proposals, list):
        proposals = []

    candidates = collect_media_candidates(proposals)
    checks: list[dict[str, Any]] = []
    for candidate in candidates[:max_urls]:
        classified = classify_media_url(base_url, candidate["raw_url"])
        check = {
            "proposal_id": candidate["proposal_id"],
            "field": candidate["field"],
            "media_kind": candidate["media_kind"],
            "url": classified["url"],
            "url_type": classified["url_type"],
        }
        if classified.get("skip_reason"):
            check["skip_reason"] = classified["skip_reason"]
        else:
            probe = probe_upload_url(classified["fetch_url"], timeout, max_bytes)
            check.update(probe)
            check["flags"] = media_flags(candidate["media_kind"], probe)
        checks.append(check)

    flagged = [item for item in checks if item.get("flags")]
    return {
        "timestamp_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "backend_url": base_url,
        "proposals_endpoint": {
            "ok": proposals_response.get("ok"),
            "status": proposals_response.get("status"),
            "url": proposals_response.get("url"),
            **({"error": proposals_response.get("error")} if proposals_response.get("error") else {}),
        },
        "proposal_count": len(proposals),
        "media_candidates_found": len(candidates),
        "media_candidates_checked": len(checks),
        "flagged_count": len(flagged),
        "checks": checks,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Read-only inventory of public SuperNova /uploads media URLs.")
    parser.add_argument("backend_url", help="Backend base URL, for example https://sn-1-production.up.railway.app")
    parser.add_argument("--limit", type=int, default=30, help="Proposal sample limit")
    parser.add_argument("--max-urls", type=int, default=30, help="Maximum media URLs to inspect")
    parser.add_argument("--timeout", type=float, default=7.0, help="Request timeout in seconds")
    parser.add_argument("--max-bytes", type=int, default=65536, help="Maximum bytes to read from each media GET")
    args = parser.parse_args(argv)

    try:
        base_url = normalize_backend_url(args.backend_url)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 2

    inventory = build_inventory(
        base_url,
        limit=max(1, args.limit),
        max_urls=max(1, args.max_urls),
        timeout=args.timeout,
        max_bytes=max(0, args.max_bytes),
    )
    print(json.dumps(inventory, indent=2, sort_keys=True))
    if not inventory["proposals_endpoint"].get("ok"):
        return 1
    return 1 if inventory["flagged_count"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
