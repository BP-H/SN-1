import argparse
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


PROJECT_ROOT = Path(__file__).resolve().parents[3]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from scripts import smoke_ai_media_prompt_inputs as smoke  # noqa: E402


def args_for(**overrides):
    values = {
        "public_base_url": "https://2177.tech",
        "media_public_base_url": "",
        "backend_url": "",
        "sample_upload_path": "/uploads/example.png",
        "check_url": False,
        "timeout": 1.0,
    }
    values.update(overrides)
    return argparse.Namespace(**values)


class AiMediaPromptSmokeScriptTests(unittest.TestCase):
    def test_dry_run_warns_when_media_origin_falls_back_to_frontend(self):
        with patch.dict("os.environ", {}, clear=True):
            lines, exit_code = smoke.build_report(args_for())

        output = "\n".join(lines)
        self.assertEqual(exit_code, 0)
        self.assertIn("WARN: media base falls back to the public frontend/site origin", output)
        self.assertIn("PASS: raw data:image bodies are redacted", output)
        self.assertNotIn("not-printed", output)

    def test_backend_url_resolves_uploads_through_backend_origin(self):
        with patch.dict("os.environ", {}, clear=True):
            lines, exit_code = smoke.build_report(
                args_for(backend_url="https://backend.example.test")
            )

        output = "\n".join(lines)
        self.assertEqual(exit_code, 0)
        self.assertIn("PASS: media base URL resolves to https://backend.example.test", output)
        self.assertIn(
            "PASS: sample upload path resolves to https://backend.example.test/uploads/example.png",
            output,
        )
        self.assertNotIn("media base falls back", output)


if __name__ == "__main__":
    unittest.main()
