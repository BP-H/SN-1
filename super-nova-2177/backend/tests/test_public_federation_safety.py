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

from backend.app import app  # noqa: E402


client = TestClient(app)


class PublicFederationSafetyTests(unittest.TestCase):
    def test_supernova_manifest_declares_manual_read_only_governance(self):
        response = client.get("/.well-known/supernova")
        self.assertEqual(response.status_code, 200)
        payload = response.json()

        self.assertEqual(payload["federation"]["mode"], "read_only_discovery")
        self.assertFalse(payload["federation"]["activitypub_inbox"])
        self.assertFalse(payload["federation"]["webmention_receiver"])
        self.assertFalse(payload["federation"]["remote_feed_mutation"])

        governance = payload["governance"]
        self.assertEqual(governance["species"], ["human", "ai", "company"])
        self.assertTrue(governance["three_species_protocol"])
        self.assertEqual(governance["execution_current_mode"], "manual_preview_only")
        self.assertFalse(governance["automatic_execution"])
        self.assertTrue(governance["company_ratification_required"])
        self.assertFalse(governance["ai_execution_without_ratification"])

        organization = payload["organization_integration"]
        self.assertEqual(organization["status"], "planned")
        self.assertFalse(organization["automatic_execution"])
        self.assertFalse(organization["company_webhooks"])
        self.assertEqual(organization["allowed_actions"], [])

        schemas = payload["protocol_schemas"]
        self.assertTrue(schemas["organization_manifest"].endswith("/protocol/supernova.organization.schema.json"))
        self.assertTrue(schemas["execution_intent"].endswith("/protocol/supernova.execution-intent.schema.json"))
        self.assertTrue(schemas["three_species_vote"].endswith("/protocol/supernova.three-species-vote.schema.json"))

    def test_protocol_schema_files_are_public_static_json(self):
        for path, schema_name in {
            "/protocol/supernova.organization.schema.json": "supernova.organization_manifest.v1",
            "/protocol/supernova.execution-intent.schema.json": "supernova.execution_intent.v1",
            "/protocol/supernova.three-species-vote.schema.json": "supernova.three_species_vote.v1",
        }.items():
            response = client.get(path)
            self.assertEqual(response.status_code, 200)
            payload = response.json()
            self.assertEqual(payload["properties"]["schema"]["const"], schema_name)

    def test_public_manifest_keeps_private_export_fields_excluded(self):
        response = client.get("/.well-known/supernova")
        self.assertEqual(response.status_code, 200)
        excluded = set(response.json()["public_data_policy"]["excluded_fields"])

        self.assertTrue({
            "email",
            "password_hash",
            "access_token",
            "refresh_token",
            "direct_messages",
            "private_message_metadata",
            "secrets",
            "admin_state",
            "debug_state",
        }.issubset(excluded))

    def test_write_federation_and_execution_routes_are_not_registered(self):
        blocked_posts = {
            "/webmention",
            "/actors/{username}/inbox",
            "/actors/{username}/outbox",
            "/execute",
            "/execution",
        }

        for route in app.routes:
            methods = getattr(route, "methods", set()) or set()
            path = getattr(route, "path", "")
            self.assertFalse(path in blocked_posts and "POST" in methods)

        for path in ("/execute", "/execution", "/webmention", "/actors/test/inbox", "/actors/test/outbox"):
            self.assertIn(client.post(path).status_code, {404, 405})


if __name__ == "__main__":
    unittest.main()
