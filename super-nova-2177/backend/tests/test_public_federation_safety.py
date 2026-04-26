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
PROTOCOL_FILENAMES = {
    "supernova.organization.schema.json",
    "supernova.execution-intent.schema.json",
    "supernova.three-species-vote.schema.json",
    "supernova.portable-profile.schema.json",
}
PROTOCOL_EXAMPLE_FILENAMES = {
    "example-organization-manifest.json",
    "example-execution-intent.json",
    "example-three-species-vote.json",
    "example-portable-profile.json",
}


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
        self.assertTrue(schemas["portable_profile"].endswith("/protocol/supernova.portable-profile.schema.json"))
        self.assertTrue(schemas["examples"].endswith("/protocol/examples/"))
        self.assertIn("/domain-verification/preview", payload["endpoints"]["domain_verification_preview"])

        version_policy = payload["schema_version_policy"]
        self.assertEqual(version_policy["current_version"], "v1")
        self.assertEqual(version_policy["v1_execution_posture"], "manual_preview_only")
        self.assertFalse(version_policy["v1_automatic_execution"])
        self.assertFalse(version_policy["v1_company_webhooks"])
        self.assertTrue(version_policy["breaking_changes_require_new_schema_version"])

    def test_protocol_schema_files_are_public_static_json(self):
        for path, schema_name in {
            "/protocol/supernova.organization.schema.json": "supernova.organization_manifest.v1",
            "/protocol/supernova.execution-intent.schema.json": "supernova.execution_intent.v1",
            "/protocol/supernova.three-species-vote.schema.json": "supernova.three_species_vote.v1",
            "/protocol/supernova.portable-profile.schema.json": "supernova.portable_profile.v1",
        }.items():
            response = client.get(path)
            self.assertEqual(response.status_code, 200)
            payload = response.json()
            self.assertEqual(payload["properties"]["schema"]["const"], schema_name)

    def test_backend_protocol_mirror_exists_for_backend_only_deploys(self):
        backend_protocol_dir = BACKEND_DIR / "protocol"
        self.assertTrue(backend_protocol_dir.exists())
        self.assertTrue(all((backend_protocol_dir / name).exists() for name in PROTOCOL_FILENAMES))
        self.assertTrue(all((backend_protocol_dir / "examples" / name).exists() for name in PROTOCOL_EXAMPLE_FILENAMES))

    def test_protocol_examples_are_public_and_keep_v1_manual_only(self):
        for path, schema_name in {
            "/protocol/examples/example-organization-manifest.json": "supernova.organization_manifest.v1",
            "/protocol/examples/example-execution-intent.json": "supernova.execution_intent.v1",
            "/protocol/examples/example-three-species-vote.json": "supernova.three_species_vote.v1",
            "/protocol/examples/example-portable-profile.json": "supernova.portable_profile.v1",
        }.items():
            response = client.get(path)
            self.assertEqual(response.status_code, 200)
            payload = response.json()
            self.assertEqual(payload["schema"], schema_name)

        organization = client.get("/protocol/examples/example-organization-manifest.json").json()
        self.assertFalse(organization["execution"]["automatic_execution"])
        self.assertFalse(organization["execution"]["webhooks_enabled"])
        self.assertEqual(organization["execution"]["allowed_actions"], [])

        intent = client.get("/protocol/examples/example-execution-intent.json").json()
        self.assertEqual(intent["execution_mode"], "manual_preview_only")
        self.assertFalse(intent["automatic_execution"])
        self.assertTrue(intent["requires_company_ratification"])
        self.assertTrue(intent["requires_human_supervision"])

        vote = client.get("/protocol/examples/example-three-species-vote.json").json()
        self.assertEqual(vote["execution"]["execution_current_mode"], "manual_preview_only")
        self.assertFalse(vote["execution"]["automatic_execution"])
        self.assertTrue(vote["execution"]["company_ratification_required"])

        profile = client.get("/protocol/examples/example-portable-profile.json").json()
        self.assertFalse(profile["identity"]["domain_verified"])
        self.assertTrue(profile["privacy"]["public_export_only"])
        self.assertIn("direct_messages", profile["privacy"]["excluded_fields"])

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

    def test_domain_verification_preview_does_not_verify_or_mutate(self):
        response = client.get("/domain-verification/preview?domain=example.com&username=alice")
        self.assertEqual(response.status_code, 200)
        payload = response.json()

        self.assertEqual(payload["status"], "preview_only")
        self.assertTrue(payload["does_not_verify_yet"])
        self.assertEqual(payload["domain"], "example.com")
        self.assertEqual(payload["methods"]["https_well_known"]["url"], "https://example.com/.well-known/supernova")
        expected_example = payload["methods"]["https_well_known"]["expected_example"]
        self.assertEqual(expected_example["organization"]["name"], "alice")
        self.assertEqual(expected_example["governance"]["species"], ["human", "ai", "company"])
        self.assertTrue(expected_example["governance"]["three_species_protocol"])
        self.assertTrue(expected_example["governance"]["company_ratification_required"])
        self.assertTrue(expected_example["governance"]["human_supervision_required"])
        self.assertEqual(payload["methods"]["dns_txt"]["name"], "_supernova.example.com")
        self.assertFalse(payload["safety"]["external_fetch"])
        self.assertFalse(payload["safety"]["dns_lookup"])
        self.assertFalse(payload["safety"]["database_write"])
        self.assertFalse(payload["safety"]["marks_domain_verified"])

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
