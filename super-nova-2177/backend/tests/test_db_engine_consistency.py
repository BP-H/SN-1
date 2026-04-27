import json
import os
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


class DbEngineConsistencyTests(unittest.TestCase):
    def test_active_backend_runtime_uses_shared_sessionlocal(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "db_engine_consistency.sqlite"
            env = os.environ.copy()
            env.update(
                {
                    "DATABASE_URL": f"sqlite:///{db_path.as_posix()}",
                    "DB_MODE": "central",
                    "SECRET_KEY": "strong-test-secret-for-db-engine-consistency",
                    "SUPERNOVA_ENV": "development",
                    "APP_ENV": "development",
                    "ENV": "development",
                }
            )
            env.pop("RAILWAY_ENVIRONMENT", None)

            probe = textwrap.dedent(
                """
                import json
                import os
                import sys
                from pathlib import Path

                root = Path.cwd()
                backend_dir = root / "super-nova-2177" / "backend"
                for path in (root, backend_dir):
                    path_text = str(path)
                    if path_text not in sys.path:
                        sys.path.insert(0, path_text)

                import backend.app as backend_app
                import backend.db_utils as db_utils
                from backend import supernova_runtime

                runtime = supernova_runtime.load_supernova_runtime()

                def bind_url_matches(session_factory):
                    session = session_factory()
                    try:
                        return str(session.get_bind().url) == os.environ["DATABASE_URL"]
                    finally:
                        session.close()

                result = {
                    "runtime_available": bool(runtime.get("available")),
                    "app_supernova_available": bool(backend_app.SUPER_NOVA_AVAILABLE),
                    "runtime_sessionlocal_exists": runtime.get("session_local") is not None,
                    "app_sessionlocal_is_runtime": backend_app.SessionLocal is runtime.get("session_local"),
                    "db_utils_sessionlocal_is_runtime": db_utils.SessionLocal is runtime.get("session_local"),
                    "runtime_db_engine_url_matches_controlled_env": runtime.get("db_engine_url") == os.environ["DATABASE_URL"],
                    "runtime_database_url_source_is_env": runtime.get("database_url_source") == "DATABASE_URL",
                    "runtime_bind_matches_controlled_env": bind_url_matches(runtime["session_local"]),
                    "app_bind_matches_controlled_env": bind_url_matches(backend_app.SessionLocal),
                    "db_utils_bind_matches_controlled_env": bind_url_matches(db_utils.SessionLocal),
                }
                print("DB_ENGINE_CONSISTENCY_RESULT=" + json.dumps(result, sort_keys=True))
                """
            )

            completed = subprocess.run(
                [sys.executable, "-c", probe],
                cwd=ROOT,
                env=env,
                capture_output=True,
                text=True,
                timeout=120,
                check=False,
            )

        self.assertEqual(
            completed.returncode,
            0,
            msg=f"probe failed\nstdout:\n{completed.stdout}\nstderr:\n{completed.stderr}",
        )
        result_lines = [
            line
            for line in completed.stdout.splitlines()
            if line.startswith("DB_ENGINE_CONSISTENCY_RESULT=")
        ]
        self.assertTrue(result_lines, msg=f"probe result missing\nstdout:\n{completed.stdout}")
        result = json.loads(result_lines[-1].split("=", 1)[1])

        self.assertTrue(result["runtime_available"])
        self.assertTrue(result["app_supernova_available"])
        self.assertTrue(result["runtime_sessionlocal_exists"])
        self.assertTrue(result["app_sessionlocal_is_runtime"])
        self.assertTrue(result["db_utils_sessionlocal_is_runtime"])
        self.assertTrue(result["runtime_db_engine_url_matches_controlled_env"])
        self.assertTrue(result["runtime_database_url_source_is_env"])
        self.assertTrue(result["runtime_bind_matches_controlled_env"])
        self.assertTrue(result["app_bind_matches_controlled_env"])
        self.assertTrue(result["db_utils_bind_matches_controlled_env"])


if __name__ == "__main__":
    unittest.main()
