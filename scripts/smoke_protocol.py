#!/usr/bin/env python3
"""Smoke-check SuperNova public protocol routes.

This script is intentionally dependency-free. It verifies public, read-only
protocol surfaces and confirms dangerous write/execution routes are absent.
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


EXPECTED_SPECIES = ["human", "ai", "company"]
PRIVATE_EXPORT_FIELDS = {
    "email",
    "password_hash",
    "access_token",
    "refresh_token",
    "direct_messages",
    "private_message_metadata",
    "secrets",
    "admin_state",
    "debug_state",
}

SCHEMA_PATHS = {
    "/protocol/supernova.organization.schema.json": "supernova.organization_manifest.v1",
    "/protocol/supernova.execution-intent.schema.json": "supernova.execution_intent.v1",
    "/protocol/supernova.three-species-vote.schema.json": "supernova.three_species_vote.v1",
    "/protocol/supernova.portable-profile.schema.json": "supernova.portable_profile.v1",
}

EXAMPLE_PATHS = {
    "/protocol/examples/example-organization-manifest.json": "supernova.organization_manifest.v1",
    "/protocol/examples/example-execution-intent.json": "supernova.execution_intent.v1",
    "/protocol/examples/example-three-species-vote.json": "supernova.three_species_vote.v1",
    "/protocol/examples/example-portable-profile.json": "supernova.portable_profile.v1",
}

DANGEROUS_POST_PATHS = (
    "/execute",
    "/execution",
    "/webmention",
    "/actors/test/inbox",
    "/actors/test/outbox",
)


@dataclass
class SmokeResult:
    ok: bool
    label: str
    detail: str = ""


class ProtocolSmoke:
    def __init__(self, base_url: str, timeout: float) -> None:
        self.base_url = base_url.rstrip("/") + "/"
        self.timeout = timeout
        self.results: list[SmokeResult] = []

    def record(self, ok: bool, label: str, detail: str = "") -> None:
        self.results.append(SmokeResult(ok=ok, label=label, detail=detail))

    def url_for(self, path: str) -> str:
        return urljoin(self.base_url, path.lstrip("/"))

    def request(self, method: str, path: str) -> tuple[int, str]:
        url = self.url_for(path)
        current_method = method
        for _redirect in range(5):
            request = Request(url, method=current_method)
            if current_method == "POST":
                request.data = b""
            try:
                with urlopen(request, timeout=self.timeout) as response:
                    body = response.read().decode("utf-8", errors="replace")
                    return int(response.status), body
            except HTTPError as exc:
                if exc.code in {301, 302, 303, 307, 308}:
                    location = exc.headers.get("Location")
                    if location:
                        url = urljoin(url, location)
                        if exc.code == 303:
                            current_method = "GET"
                        continue
                body = exc.read().decode("utf-8", errors="replace")
                return int(exc.code), body
            except TimeoutError as exc:
                raise RuntimeError(str(exc)) from exc
            except OSError as exc:
                raise RuntimeError(str(exc)) from exc
            except URLError as exc:
                raise RuntimeError(str(exc.reason)) from exc
        raise RuntimeError(f"too many redirects for {method} {path}")

    def get_json(self, path: str) -> dict[str, Any] | None:
        try:
            status, body = self.request("GET", path)
        except RuntimeError as exc:
            self.record(False, f"GET {path}", str(exc))
            return None

        if status != 200:
            self.record(False, f"GET {path}", f"expected 200, got {status}")
            return None

        try:
            payload = json.loads(body)
        except json.JSONDecodeError as exc:
            self.record(False, f"GET {path}", f"invalid JSON: {exc}")
            return None

        self.record(True, f"GET {path}", "200 JSON")
        return payload

    def expect(self, condition: bool, label: str, detail: str = "") -> None:
        self.record(condition, label, detail if not condition else "")

    def check_manifest(self) -> None:
        manifest = self.get_json("/.well-known/supernova")
        if not manifest:
            return

        self.expect(manifest.get("open_federation") is True, "manifest open_federation true")
        self.expect(manifest.get("federation", {}).get("mode") == "read_only_discovery", "manifest read-only federation")
        self.expect(manifest.get("federation", {}).get("activitypub_inbox") is False, "manifest no ActivityPub inbox")
        self.expect(manifest.get("federation", {}).get("webmention_receiver") is False, "manifest no Webmention receiver")
        self.expect(manifest.get("federation", {}).get("remote_feed_mutation") is False, "manifest no remote feed mutation")

        governance = manifest.get("governance", {})
        self.expect(governance.get("species") == EXPECTED_SPECIES, "manifest three species")
        self.expect(governance.get("execution_current_mode") == "manual_preview_only", "manifest manual preview mode")
        self.expect(governance.get("automatic_execution") is False, "manifest no automatic execution")
        self.expect(governance.get("company_ratification_required") is True, "manifest company ratification required")

        organization = manifest.get("organization_integration", {})
        self.expect(organization.get("automatic_execution") is False, "organization no automatic execution")
        self.expect(organization.get("company_webhooks") is False, "organization no company webhooks")
        self.expect(organization.get("allowed_actions") == [], "organization no allowed actions")

        policy = manifest.get("schema_version_policy", {})
        self.expect(policy.get("current_version") == "v1", "schema policy current v1")
        self.expect(policy.get("v1_execution_posture") == "manual_preview_only", "schema policy manual v1")
        self.expect(policy.get("v1_automatic_execution") is False, "schema policy no v1 automatic execution")
        self.expect(policy.get("v1_company_webhooks") is False, "schema policy no v1 webhooks")

        examples = manifest.get("protocol_examples", {})
        for key, path in {
            "organization_manifest": "/protocol/examples/example-organization-manifest.json",
            "execution_intent": "/protocol/examples/example-execution-intent.json",
            "three_species_vote": "/protocol/examples/example-three-species-vote.json",
            "portable_profile": "/protocol/examples/example-portable-profile.json",
        }.items():
            value = examples.get(key, "")
            self.expect(value.endswith(path), f"manifest protocol_examples {key}", str(value))

        excluded = set(manifest.get("public_data_policy", {}).get("excluded_fields", []))
        self.expect(PRIVATE_EXPORT_FIELDS.issubset(excluded), "manifest private export exclusions")

    def check_schemas(self) -> None:
        for path, schema_name in SCHEMA_PATHS.items():
            payload = self.get_json(path)
            if not payload:
                continue
            actual = payload.get("properties", {}).get("schema", {}).get("const")
            self.expect(actual == schema_name, f"schema const {path}", str(actual))
            if path.endswith("supernova.organization.schema.json"):
                equal_weight = payload.get("properties", {}).get("governance", {}).get("properties", {}).get("equal_species_weight", {})
                self.expect(equal_weight.get("const") is True, "organization schema equal species weight const true")

    def check_examples(self) -> None:
        payloads: dict[str, dict[str, Any]] = {}
        for path, schema_name in EXAMPLE_PATHS.items():
            payload = self.get_json(path)
            if not payload:
                continue
            payloads[path] = payload
            self.expect(payload.get("schema") == schema_name, f"example schema {path}", str(payload.get("schema")))

        organization = payloads.get("/protocol/examples/example-organization-manifest.json", {})
        self.expect(organization.get("governance", {}).get("species") == EXPECTED_SPECIES, "organization example three species")
        self.expect(organization.get("governance", {}).get("equal_species_weight") is True, "organization example equal species weight")
        self.expect(organization.get("execution", {}).get("automatic_execution") is False, "organization example no automatic execution")
        self.expect(organization.get("execution", {}).get("webhooks_enabled") is False, "organization example no webhooks")
        self.expect(organization.get("execution", {}).get("allowed_actions") == [], "organization example no allowed actions")

        intent = payloads.get("/protocol/examples/example-execution-intent.json", {})
        self.expect(intent.get("execution_mode") == "manual_preview_only", "intent example manual preview")
        self.expect(intent.get("automatic_execution") is False, "intent example no automatic execution")
        self.expect(intent.get("requires_company_ratification") is True, "intent example company ratification")
        self.expect(intent.get("requires_human_supervision") is True, "intent example human supervision")

        vote = payloads.get("/protocol/examples/example-three-species-vote.json", {})
        vote_execution = vote.get("execution", {})
        self.expect(vote_execution.get("execution_current_mode") == "manual_preview_only", "vote example manual preview")
        self.expect(vote_execution.get("automatic_execution") is False, "vote example no automatic execution")
        self.expect(vote_execution.get("company_ratification_required") is True, "vote example company ratification")

        profile = payloads.get("/protocol/examples/example-portable-profile.json", {})
        self.expect(profile.get("identity", {}).get("domain_verified") is False, "portable profile example unverified domain")
        self.expect(profile.get("privacy", {}).get("public_export_only") is True, "portable profile example public-only")
        excluded = set(profile.get("privacy", {}).get("excluded_fields", []))
        self.expect(PRIVATE_EXPORT_FIELDS.issubset(excluded), "portable profile private exclusions")

    def check_domain_preview(self) -> None:
        payload = self.get_json("/domain-verification/preview?domain=example.com&username=alice")
        if not payload:
            return
        self.expect(payload.get("status") == "preview_only", "domain preview status")
        self.expect(payload.get("does_not_verify_yet") is True, "domain preview does not verify")
        example = payload.get("methods", {}).get("https_well_known", {}).get("expected_example", {})
        self.expect(example.get("governance", {}).get("species") == EXPECTED_SPECIES, "domain preview example three species")
        self.expect(example.get("governance", {}).get("equal_species_weight") is True, "domain preview example equal species")
        self.expect(example.get("organization", {}).get("name") == "alice", "domain preview organization name")
        value_sharing = example.get("value_sharing", {})
        self.expect(
            value_sharing.get("status") == "not_financial_protocol",
            "domain preview value sharing non-financial",
        )
        self.expect(
            value_sharing.get("company_side_policy_required") is True,
            "domain preview company-side value policy required",
        )
        self.expect(
            value_sharing.get("supernova_nonprofit_does_not_custody_funds") is True,
            "domain preview nonprofit does not custody funds",
        )
        safety = payload.get("safety", {})
        for key in ("external_fetch", "dns_lookup", "database_write", "marks_domain_verified"):
            self.expect(safety.get(key) is False, f"domain preview safety {key} false")

    def check_dangerous_posts_absent(self) -> None:
        for path in DANGEROUS_POST_PATHS:
            try:
                status, _body = self.request("POST", path)
            except RuntimeError as exc:
                self.record(False, f"POST {path}", str(exc))
                continue
            self.expect(status in {404, 405}, f"POST {path} absent", f"got {status}")

    def run(self) -> int:
        self.check_manifest()
        self.check_schemas()
        self.check_examples()
        self.check_domain_preview()
        self.check_dangerous_posts_absent()

        failures = [result for result in self.results if not result.ok]
        for result in self.results:
            prefix = "PASS" if result.ok else "FAIL"
            detail = f" - {result.detail}" if result.detail else ""
            print(f"{prefix}: {result.label}{detail}")
        print(f"\n{len(self.results) - len(failures)} passed, {len(failures)} failed")
        return 1 if failures else 0


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Smoke-check SuperNova public protocol routes.")
    parser.add_argument("base_url", help="Base URL to check, for example https://2177.tech")
    parser.add_argument("--timeout", type=float, default=15.0, help="Request timeout in seconds")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    return ProtocolSmoke(args.base_url, args.timeout).run()


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
