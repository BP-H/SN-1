import sys
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[3]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from scripts import smoke_public_ai_reader as smoke


class PublicAiReaderSmokeScriptTests(unittest.TestCase):
    def test_sensitive_key_normalizer_handles_common_variants(self):
        cases = {
            "api_key": "apikey",
            "api-key": "apikey",
            "api key": "apikey",
            "api.key": "apikey",
            "apiKey": "apikey",
            "ApiKey": "apikey",
            "accessToken": "accesstoken",
            "refreshToken": "refreshtoken",
            "databaseUrl": "databaseurl",
            "dbUrl": "dburl",
            "hashedPassword": "hashedpassword",
            "privateNotifications": "privatenotifications",
        }
        for raw, expected in cases.items():
            with self.subTest(raw=raw):
                self.assertEqual(smoke.normalize_sensitive_key_name(raw), expected)

    def test_sensitive_key_scan_flags_camel_and_compact_aliases(self):
        payload = {
            "apiKey": "redacted",
            "accessToken": "redacted",
            "refreshToken": "redacted",
            "databaseUrl": "redacted",
            "dbUrl": "redacted",
            "hashedPassword": "redacted",
            "nested": {
                "privateNotifications": [],
                "safePublicField": "ok",
            },
        }
        findings = smoke.scan_public_payload(payload)
        sensitive_paths = {
            item["path"]
            for item in findings
            if item["kind"] == "sensitive_key_name"
        }
        self.assertIn("$.apiKey", sensitive_paths)
        self.assertIn("$.accessToken", sensitive_paths)
        self.assertIn("$.refreshToken", sensitive_paths)
        self.assertIn("$.databaseUrl", sensitive_paths)
        self.assertIn("$.dbUrl", sensitive_paths)
        self.assertIn("$.hashedPassword", sensitive_paths)
        self.assertIn("$.nested.privateNotifications", sensitive_paths)
        self.assertNotIn("$.nested.safePublicField", sensitive_paths)


if __name__ == "__main__":
    unittest.main()
