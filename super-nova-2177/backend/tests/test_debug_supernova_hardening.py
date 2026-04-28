import json
import os
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def run_debug_probe(probe: str, extra_env: dict | None = None) -> dict:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "debug_supernova_hardening.sqlite"
        env = os.environ.copy()
        env.update(
            {
                "DATABASE_URL": f"sqlite:///{db_path.as_posix()}",
                "DB_MODE": "central",
                "SECRET_KEY": "strong-test-secret-for-debug-supernova-hardening",
                "SUPERNOVA_ENV": "development",
                "APP_ENV": "development",
                "ENV": "development",
            }
        )
        env.pop("RAILWAY_ENVIRONMENT", None)
        if extra_env:
            env.update(extra_env)

        completed = subprocess.run(
            [sys.executable, "-c", probe],
            cwd=PROJECT_ROOT,
            env=env,
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )

    if completed.returncode != 0:
        raise AssertionError(
            f"probe failed\nstdout:\n{completed.stdout}\nstderr:\n{completed.stderr}"
        )
    result_lines = [
        line
        for line in completed.stdout.splitlines()
        if line.startswith("DEBUG_SUPERNOVA_HARDENING_RESULT=")
    ]
    if not result_lines:
        raise AssertionError(f"probe result missing\nstdout:\n{completed.stdout}")
    return json.loads(result_lines[-1].split("=", 1)[1])


PROBE_PREAMBLE = """
import json
import sys
from pathlib import Path

from fastapi.testclient import TestClient

project_root = Path.cwd()
backend_dir = project_root / "backend"
for path in (project_root, backend_dir):
    path_text = str(path)
    if path_text not in sys.path:
        sys.path.insert(0, path_text)

import backend.app as backend_app

client = TestClient(backend_app.app)
"""


PRODUCTION_PROBE = PROBE_PREAMBLE + textwrap.dedent(
    """
    response = client.get("/debug-supernova")
    body_text = response.text
    result = {
        "status_code": response.status_code,
        "json": response.json(),
        "body_text": body_text,
        "contains_python_path": "python_path" in body_text,
        "contains_current_dir": "current_dir" in body_text,
        "contains_dir_contents": "dir_contents" in body_text,
        "contains_supernova_dir": "supernova_dir" in body_text,
        "contains_project_root": str(project_root) in body_text,
        "contains_secret": "strong-test-secret-for-debug-supernova-hardening" in body_text,
    }
    print("DEBUG_SUPERNOVA_HARDENING_RESULT=" + json.dumps(result, sort_keys=True))
    """
)


class DebugSupernovaHardeningTests(unittest.TestCase):
    def test_debug_supernova_blocked_by_supernova_env_production(self):
        result = run_debug_probe(
            PRODUCTION_PROBE,
            {"SUPERNOVA_ENV": "production"},
        )

        self.assertEqual(result["status_code"], 404)
        self.assertEqual(result["json"], {"detail": "Not found"})
        self.assertFalse(result["contains_python_path"])
        self.assertFalse(result["contains_current_dir"])
        self.assertFalse(result["contains_dir_contents"])
        self.assertFalse(result["contains_supernova_dir"])
        self.assertFalse(result["contains_project_root"])
        self.assertFalse(result["contains_secret"])

    def test_debug_supernova_blocked_by_app_env_production(self):
        result = run_debug_probe(
            PRODUCTION_PROBE,
            {"APP_ENV": "production"},
        )

        self.assertEqual(result["status_code"], 404)
        self.assertEqual(result["json"], {"detail": "Not found"})
        self.assertFalse(result["contains_python_path"])
        self.assertFalse(result["contains_current_dir"])
        self.assertFalse(result["contains_dir_contents"])
        self.assertFalse(result["contains_supernova_dir"])

    def test_debug_supernova_blocked_by_env_prod(self):
        result = run_debug_probe(
            PRODUCTION_PROBE,
            {"ENV": "prod"},
        )

        self.assertEqual(result["status_code"], 404)
        self.assertEqual(result["json"], {"detail": "Not found"})
        self.assertFalse(result["contains_python_path"])
        self.assertFalse(result["contains_current_dir"])
        self.assertFalse(result["contains_dir_contents"])
        self.assertFalse(result["contains_supernova_dir"])

    def test_debug_supernova_blocked_by_railway_environment_production(self):
        result = run_debug_probe(
            PRODUCTION_PROBE,
            {"RAILWAY_ENVIRONMENT": "production"},
        )

        self.assertEqual(result["status_code"], 404)
        self.assertEqual(result["json"], {"detail": "Not found"})
        self.assertFalse(result["contains_python_path"])
        self.assertFalse(result["contains_current_dir"])
        self.assertFalse(result["contains_dir_contents"])
        self.assertFalse(result["contains_supernova_dir"])

    def test_debug_supernova_development_response_is_minimal_and_useful(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            response = client.get("/debug-supernova")
            payload = response.json()
            body_text = response.text
            result = {
                "status_code": response.status_code,
                "keys": sorted(payload.keys()),
                "debug_mode": payload.get("debug_mode"),
                "supernova_keys": sorted(payload.get("supernova", {}).keys()),
                "contains_python_path": "python_path" in body_text,
                "contains_current_dir": "current_dir" in body_text,
                "contains_dir_contents": "dir_contents" in body_text,
                "contains_supernova_dir": "supernova_dir" in body_text,
                "contains_project_root": str(project_root) in body_text,
                "contains_secret": "strong-test-secret-for-debug-supernova-hardening" in body_text,
            }
            print("DEBUG_SUPERNOVA_HARDENING_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_debug_probe(probe)

        self.assertEqual(result["status_code"], 200)
        self.assertEqual(
            set(result["keys"]),
            {"debug_mode", "supernova", "supernova_available"},
        )
        self.assertEqual(result["debug_mode"], "development")
        self.assertIn("integration", result["supernova_keys"])
        self.assertIn("core_routes", result["supernova_keys"])
        self.assertFalse(result["contains_python_path"])
        self.assertFalse(result["contains_current_dir"])
        self.assertFalse(result["contains_dir_contents"])
        self.assertFalse(result["contains_supernova_dir"])
        self.assertFalse(result["contains_project_root"])
        self.assertFalse(result["contains_secret"])

    def test_public_health_and_status_routes_still_respond(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            health = client.get("/health")
            status = client.get("/supernova-status")
            result = {
                "health_status": health.status_code,
                "health_keys": sorted(health.json().keys()),
                "status_status": status.status_code,
                "status_keys": sorted(status.json().keys()),
            }
            print("DEBUG_SUPERNOVA_HARDENING_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_debug_probe(probe)

        self.assertEqual(result["health_status"], 200)
        self.assertIn("ok", result["health_keys"])
        self.assertIn("supernova", result["health_keys"])
        self.assertEqual(result["status_status"], 200)
        self.assertIn("features_available", result["status_keys"])
        self.assertIn("supernova", result["status_keys"])


if __name__ == "__main__":
    unittest.main()
