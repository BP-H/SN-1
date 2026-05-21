import json
import sys
import unittest
from pathlib import Path

from fastapi.testclient import TestClient


ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
for path in (ROOT, BACKEND_DIR):
    path_str = str(path)
    if path_str not in sys.path:
        sys.path.insert(0, path_str)

import backend.app as backend_app  # noqa: E402


client = TestClient(backend_app.app)

SCHEMA_FILES = {
    "supernova.event-envelope.schema.json",
    "supernova.actor-keychain.schema.json",
}
EXAMPLE_FILES = {
    "example-event-envelope.json",
    "example-actor-keychain.json",
}
PRIVATE_FIELDS = {
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
DANGEROUS_POST_PATHS = {
    "/sync/events",
    "/sync/heads",
    "/sync/proof",
    "/actors/{username}/inbox",
    "/actors/{username}/outbox",
    "/webmention",
    "/execute",
    "/execution",
}


def _load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def _excluded_fields_schema(schema_payload):
    return schema_payload["properties"]["privacy"]["properties"]["excluded_fields"]


def _excluded_field_required_consts(schema_payload):
    all_of = _excluded_fields_schema(schema_payload).get("allOf") or []
    return {
        item.get("contains", {}).get("const")
        for item in all_of
        if isinstance(item, dict)
    }


class P2PProtocolPlanningSafetyTests(unittest.TestCase):
    def test_new_p2p_schemas_exist_and_backend_mirror_is_byte_identical(self):
        for name in SCHEMA_FILES:
            root_path = ROOT / "protocol" / name
            backend_path = BACKEND_DIR / "protocol" / name
            self.assertTrue(root_path.exists(), msg=name)
            self.assertTrue(backend_path.exists(), msg=name)
            self.assertEqual(root_path.read_bytes(), backend_path.read_bytes(), msg=name)

    def test_p2p_schema_privacy_exclusions_require_every_private_field(self):
        for base_dir in (ROOT / "protocol", BACKEND_DIR / "protocol"):
            for name in SCHEMA_FILES:
                with self.subTest(schema=name, base_dir=str(base_dir)):
                    schema = _load_json(base_dir / name)
                    excluded = _excluded_fields_schema(schema)
                    self.assertEqual(_excluded_field_required_consts(schema), PRIVATE_FIELDS)
                    self.assertTrue(excluded.get("uniqueItems"))
                    self.assertNotIn("enum", excluded.get("contains", {}))

    def test_new_p2p_examples_exist_and_backend_mirror_is_byte_identical(self):
        for name in EXAMPLE_FILES:
            root_path = ROOT / "protocol" / "examples" / name
            backend_path = BACKEND_DIR / "protocol" / "examples" / name
            self.assertTrue(root_path.exists(), msg=name)
            self.assertTrue(backend_path.exists(), msg=name)
            self.assertEqual(root_path.read_bytes(), backend_path.read_bytes(), msg=name)

    def test_p2p_planning_schema_static_files_are_served(self):
        response = client.get("/protocol/supernova.event-envelope.schema.json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["properties"]["schema"]["const"],
            "supernova.event_envelope.v0",
        )

        response = client.get("/protocol/supernova.actor-keychain.schema.json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["properties"]["schema"]["const"],
            "supernova.actor_keychain.v0",
        )

    def test_event_envelope_example_is_planning_only_public_and_non_executing(self):
        response = client.get("/protocol/examples/example-event-envelope.json")
        self.assertEqual(response.status_code, 200)
        payload = response.json()

        self.assertTrue(payload["planning_only"])
        self.assertFalse(payload["automatic_execution"])
        self.assertFalse(payload["federation_write"])
        self.assertEqual(payload["execution_current_mode"], "manual_preview_only")
        self.assertTrue(payload["privacy"]["public_only"])
        self.assertTrue(PRIVATE_FIELDS.issubset(set(payload["privacy"]["excluded_fields"])))
        self.assertTrue(payload["safety"]["no_execution"])
        self.assertTrue(payload["safety"]["no_webhooks"])
        self.assertTrue(payload["safety"]["no_remote_feed_mutation"])
        self.assertTrue(payload["safety"]["no_value_distribution"])

    def test_actor_keychain_example_is_planning_only_and_has_no_runtime_authority(self):
        response = client.get("/protocol/examples/example-actor-keychain.json")
        self.assertEqual(response.status_code, 200)
        payload = response.json()

        self.assertTrue(payload["planning_only"])
        self.assertFalse(payload["runtime_authority"])
        self.assertTrue(payload["privacy"]["public_only"])
        self.assertTrue(PRIVATE_FIELDS.issubset(set(payload["privacy"]["excluded_fields"])))
        self.assertTrue(payload["safety"]["does_not_authenticate_runtime_requests"])
        self.assertTrue(payload["safety"]["does_not_enable_execution"])
        self.assertTrue(payload["safety"]["does_not_grant_ai_actor_creation"])
        self.assertTrue(payload["safety"]["does_not_verify_domains"])

    def test_p2p_planning_schemas_are_not_live_manifest_advertised_yet(self):
        response = client.get("/.well-known/supernova")
        self.assertEqual(response.status_code, 200)
        encoded = str(response.json())
        self.assertNotIn("supernova.event-envelope.schema.json", encoded)
        self.assertNotIn("supernova.actor-keychain.schema.json", encoded)
        self.assertNotIn("example-event-envelope.json", encoded)
        self.assertNotIn("example-actor-keychain.json", encoded)

    def test_no_dangerous_p2p_sync_federation_or_execution_routes_are_registered(self):
        for route in backend_app.app.routes:
            methods = getattr(route, "methods", set()) or set()
            path = getattr(route, "path", "")
            self.assertFalse(path in DANGEROUS_POST_PATHS and "POST" in methods)

        for path in (
            "/sync/events",
            "/sync/heads",
            "/sync/proof",
            "/actors/test/inbox",
            "/actors/test/outbox",
            "/webmention",
            "/execute",
            "/execution",
        ):
            self.assertIn(client.post(path).status_code, {404, 405})


if __name__ == "__main__":
    unittest.main()
