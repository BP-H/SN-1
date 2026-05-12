#!/usr/bin/env python3
"""Smoke-check public AI reader connector routes.

This script performs only unauthenticated GET requests against public connector
routes. It never writes, authenticates, mutates data, reads local environment
files, or prints secret-bearing response values.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any


CONNECTOR_PATHS = (
    "/connector/supernova",
    "/connector/supernova/spec",
    "/connector/public-digest",
)

REQUIRED_DIGEST_SAFETY_FLAGS = (
    "no_writes",
    "no_private_state",
    "no_autonomous_execution",
    "approval_required_ai_actions",
)

SECRET_VALUE_PATTERNS = {
    "db_url": re.compile(r"postgres(?:ql)?://", re.IGNORECASE),
    "userinfo_credential": re.compile(r"://[^\s/]+:[^\s@]+@"),
    "railway_internal_host": re.compile(r"railway\.internal", re.IGNORECASE),
    "email_address": re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE),
    "private_notification_marker": re.compile(r"private_notification", re.IGNORECASE),
    "pending_collab_marker": re.compile(r"pending_collab", re.IGNORECASE),
    "protected_core_marker": re.compile(r"protected_core_internal", re.IGNORECASE),
}

SENSITIVE_KEY_NAMES = {
    "access_token",
    "api_key",
    "authorization",
    "cookie",
    "cookies",
    "database_url",
    "db_url",
    "email",
    "hashed_password",
    "password",
    "private_notifications",
    "refresh_token",
    "secret",
    "token",
}


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
                    "error": f"invalid JSON: {exc}",
                }
            return {
                "ok": 200 <= getattr(response, "status", 0) < 300,
                "status": getattr(response, "status", None),
                "body": body,
            }
    except urllib.error.HTTPError as exc:
        return {"ok": False, "status": exc.code, "error": str(exc)}
    except Exception as exc:
        return {"ok": False, "status": None, "error": str(exc)}


def _walk_values(value: Any, path: str = "$"):
    if isinstance(value, dict):
        for key, item in value.items():
            yield from _walk_values(item, f"{path}.{key}")
    elif isinstance(value, list):
        for index, item in enumerate(value):
            yield from _walk_values(item, f"{path}[{index}]")
    elif isinstance(value, str):
        yield path, value


def _walk_keys(value: Any, path: str = "$"):
    if isinstance(value, dict):
        for key, item in value.items():
            key_text = str(key)
            yield f"{path}.{key_text}", key_text
            yield from _walk_keys(item, f"{path}.{key_text}")
    elif isinstance(value, list):
        for index, item in enumerate(value):
            yield from _walk_keys(item, f"{path}[{index}]")


def scan_public_payload(payload: Any) -> list[dict[str, str]]:
    findings: list[dict[str, str]] = []
    for path, value in _walk_values(payload):
        clean = value.strip()
        if clean.startswith("data:image/") and "<redacted>" not in clean and len(clean) > 80:
            findings.append({"path": path, "kind": "giant_data_image_body"})
        for name, pattern in SECRET_VALUE_PATTERNS.items():
            if pattern.search(clean):
                findings.append({"path": path, "kind": name})
    for path, key in _walk_keys(payload):
        normalized = key.lower()
        if normalized in SENSITIVE_KEY_NAMES:
            findings.append({"path": path, "kind": "sensitive_key_name"})
    return findings


def assert_public_ai_reader_shapes(payloads: dict[str, Any]) -> list[str]:
    failures: list[str] = []
    discovery = payloads.get("/connector/supernova") or {}
    spec = payloads.get("/connector/supernova/spec") or {}
    digest = payloads.get("/connector/public-digest") or {}

    if discovery.get("mode") != "public_read_only":
        failures.append("/connector/supernova mode is not public_read_only")
    if discovery.get("write_tools_enabled") is not False:
        failures.append("/connector/supernova write tools are not disabled")
    if discovery.get("endpoints", {}).get("public_digest") != "/connector/public-digest":
        failures.append("/connector/supernova does not advertise public_digest")

    if spec.get("mode") != "public_read_only":
        failures.append("/connector/supernova/spec mode is not public_read_only")
    if spec.get("endpoints", {}).get("public_digest") != "/connector/public-digest":
        failures.append("/connector/supernova/spec does not advertise public_digest")
    if spec.get("resources", {}).get("public_digest", {}).get("endpoint") != "/connector/public-digest":
        failures.append("/connector/supernova/spec does not describe public_digest")

    if digest.get("name") != "SuperNova 2177":
        failures.append("/connector/public-digest name mismatch")
    if digest.get("mode") != "public_read_only":
        failures.append("/connector/public-digest mode is not public_read_only")
    if digest.get("species_lanes") != ["human", "ai", "company"]:
        failures.append("/connector/public-digest species lanes mismatch")
    safety = digest.get("safety") if isinstance(digest.get("safety"), dict) else {}
    for flag in REQUIRED_DIGEST_SAFETY_FLAGS:
        if safety.get(flag) is not True:
            failures.append(f"/connector/public-digest safety flag missing: {flag}")
    if not isinstance(digest.get("items"), list):
        failures.append("/connector/public-digest items is not a list")
    return failures


def build_report(base_url: str, timeout: float) -> dict[str, Any]:
    endpoints: dict[str, Any] = {}
    payloads: dict[str, Any] = {}
    failures: list[str] = []
    findings: list[dict[str, str]] = []

    for path in CONNECTOR_PATHS:
        response = fetch_json(base_url, path, timeout)
        endpoints[path] = {
            "ok": response.get("ok"),
            "status": response.get("status"),
            **({"error": response.get("error")} if response.get("error") else {}),
        }
        if not response.get("ok"):
            failures.append(f"{path} did not return clean JSON")
            continue
        payload = response.get("body")
        payloads[path] = payload
        for finding in scan_public_payload(payload):
            findings.append({"endpoint": path, **finding})

    failures.extend(assert_public_ai_reader_shapes(payloads))
    if findings:
        failures.append("secret/private marker scan found unsafe fields")

    digest = payloads.get("/connector/public-digest") or {}
    return {
        "timestamp_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "backend_url": base_url,
        "endpoints": endpoints,
        "digest": {
            "mode": digest.get("mode"),
            "item_count": len(digest.get("items", [])) if isinstance(digest.get("items"), list) else None,
            "safety_flags": {
                flag: (digest.get("safety") or {}).get(flag) if isinstance(digest.get("safety"), dict) else None
                for flag in REQUIRED_DIGEST_SAFETY_FLAGS
            },
        },
        "unsafe_finding_count": len(findings),
        "unsafe_findings": findings[:20],
        "failures": failures,
        "ok": not failures,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Smoke-check public AI reader connector routes.")
    parser.add_argument("backend_url", help="Backend base URL, for example https://sn-1-production.up.railway.app")
    parser.add_argument("--timeout", type=float, default=7.0, help="Request timeout in seconds")
    args = parser.parse_args(argv)

    try:
        base_url = normalize_backend_url(args.backend_url)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 2

    report = build_report(base_url, args.timeout)
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
