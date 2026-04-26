#!/usr/bin/env python3
"""Smoke-check SuperNova public social/backend read routes.

This script is intentionally dependency-free and read-only. It checks public
GET surfaces only; it never registers users, logs in, sends messages, votes,
comments, uploads files, or mutates database state.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen


AUTH_OR_UNAVAILABLE = {401, 403, 404, 405}


@dataclass
class SmokeResult:
    status: str
    label: str
    detail: str = ""

    @property
    def ok(self) -> bool:
        return self.status in {"PASS", "SKIP"}


class SocialBackendSmoke:
    def __init__(self, base_url: str, timeout: float) -> None:
        self.base_url = base_url.rstrip("/") + "/"
        self.timeout = timeout
        self.results: list[SmokeResult] = []

    def record(self, status: str, label: str, detail: str = "") -> None:
        self.results.append(SmokeResult(status=status, label=label, detail=detail))

    def pass_(self, label: str, detail: str = "") -> None:
        self.record("PASS", label, detail)

    def fail(self, label: str, detail: str = "") -> None:
        self.record("FAIL", label, detail)

    def skip(self, label: str, detail: str = "") -> None:
        self.record("SKIP", label, detail)

    def url_for(self, path: str) -> str:
        return urljoin(self.base_url, path.lstrip("/"))

    def request_get(self, path: str) -> tuple[int, str]:
        url = self.url_for(path)
        for _redirect in range(5):
            request = Request(url, method="GET")
            try:
                with urlopen(request, timeout=self.timeout) as response:
                    body = response.read().decode("utf-8", errors="replace")
                    return int(response.status), body
            except HTTPError as exc:
                if exc.code in {301, 302, 303, 307, 308}:
                    location = exc.headers.get("Location")
                    if location:
                        url = urljoin(url, location)
                        continue
                body = exc.read().decode("utf-8", errors="replace")
                return int(exc.code), body
            except TimeoutError as exc:
                raise RuntimeError(str(exc)) from exc
            except OSError as exc:
                raise RuntimeError(str(exc)) from exc
            except URLError as exc:
                raise RuntimeError(str(exc.reason)) from exc
        raise RuntimeError(f"too many redirects for GET {path}")

    def get_json(self, path: str, label: str, *, skip_auth_unavailable: bool = False) -> dict[str, Any] | list[Any] | None:
        try:
            status, body = self.request_get(path)
        except RuntimeError as exc:
            self.fail(f"GET {label}", str(exc))
            return None

        if skip_auth_unavailable and status in AUTH_OR_UNAVAILABLE:
            self.skip(f"GET {label}", f"skipped/auth-required or unavailable: {status}")
            return None

        if status != 200:
            self.fail(f"GET {label}", f"expected 200, got {status}")
            return None

        try:
            payload = json.loads(body)
        except json.JSONDecodeError as exc:
            if skip_auth_unavailable:
                self.skip(f"GET {label}", "skipped/auth-required or unavailable: non-JSON response")
                return None
            self.fail(f"GET {label}", f"invalid JSON: {exc}")
            return None

        self.pass_(f"GET {label}", "200 JSON")
        return payload

    def check_health(self) -> None:
        payload = self.get_json("/health", "/health", skip_auth_unavailable=True)
        if payload is None:
            return
        if isinstance(payload, dict):
            self.pass_("/health returns object")
        else:
            self.fail("/health returns object", f"got {type(payload).__name__}")

    def check_status(self) -> None:
        payload = self.get_json("/supernova-status", "/supernova-status", skip_auth_unavailable=True)
        if payload is None:
            return
        if isinstance(payload, dict):
            self.pass_("/supernova-status returns object")
        else:
            self.fail("/supernova-status returns object", f"got {type(payload).__name__}")

    def check_protocol_bridge(self) -> None:
        payload = self.get_json("/.well-known/supernova", "/.well-known/supernova")
        if payload is None:
            return
        if isinstance(payload, dict):
            self.pass_("/.well-known/supernova bridge returns object")
        else:
            self.fail("/.well-known/supernova bridge returns object", f"got {type(payload).__name__}")

    def check_public_proposals(self) -> None:
        payload = self.get_json(
            "/proposals?limit=1",
            "/proposals?limit=1",
            skip_auth_unavailable=True,
        )
        if payload is None:
            return
        if isinstance(payload, list):
            self.pass_("/proposals public read returns list", f"{len(payload)} item(s)")
        else:
            self.fail("/proposals public read returns list", f"got {type(payload).__name__}")

    def run(self) -> int:
        self.check_health()
        self.check_status()
        self.check_public_proposals()
        self.check_protocol_bridge()

        failures = [result for result in self.results if result.status == "FAIL"]
        for result in self.results:
            detail = f" - {result.detail}" if result.detail else ""
            print(f"{result.status}: {result.label}{detail}")
        skipped = [result for result in self.results if result.status == "SKIP"]
        passed = [result for result in self.results if result.status == "PASS"]
        print(f"\n{len(passed)} passed, {len(skipped)} skipped, {len(failures)} failed")
        return 1 if failures else 0


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Smoke-check SuperNova public social/backend read routes.")
    parser.add_argument("base_url", help="Base URL to check, for example https://2177.tech")
    parser.add_argument("--timeout", type=float, default=15.0, help="Request timeout in seconds")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    return SocialBackendSmoke(args.base_url, args.timeout).run()


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
