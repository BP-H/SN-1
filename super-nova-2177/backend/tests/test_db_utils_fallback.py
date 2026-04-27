import json
import os
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


class DbUtilsFallbackTests(unittest.TestCase):
    def test_db_utils_fallback_sessionlocal_uses_controlled_sqlite_url(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "db_utils_fallback.sqlite"
            env = os.environ.copy()
            env.update(
                {
                    "DATABASE_URL": f"sqlite:///{db_path.as_posix()}",
                    "DB_MODE": "central",
                    "SECRET_KEY": "strong-test-secret-for-db-utils-fallback",
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
                import types
                from pathlib import Path

                root = Path.cwd()
                backend_dir = root / "super-nova-2177" / "backend"
                for path in (root, backend_dir):
                    path_text = str(path)
                    if path_text not in sys.path:
                        sys.path.insert(0, path_text)

                runtime_stub = types.ModuleType("backend.supernova_runtime")

                def load_supernova_runtime():
                    return {"available": False, "session_local": None}

                runtime_stub.load_supernova_runtime = load_supernova_runtime
                sys.modules["backend.supernova_runtime"] = runtime_stub

                import backend.db_utils as db_utils

                session = db_utils.SessionLocal()
                try:
                    bind_url = str(session.get_bind().url)
                finally:
                    session.close()

                result = {
                    "sessionlocal_exists": db_utils.SessionLocal is not None,
                    "bind_url_matches_controlled_env": bind_url == os.environ["DATABASE_URL"],
                    "database_url_was_controlled_sqlite": os.environ["DATABASE_URL"].startswith("sqlite:///"),
                }
                print("DB_UTILS_FALLBACK_RESULT=" + json.dumps(result, sort_keys=True))
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
            if line.startswith("DB_UTILS_FALLBACK_RESULT=")
        ]
        self.assertTrue(result_lines, msg=f"probe result missing\nstdout:\n{completed.stdout}")
        result = json.loads(result_lines[-1].split("=", 1)[1])

        self.assertTrue(result["sessionlocal_exists"])
        self.assertTrue(result["bind_url_matches_controlled_env"])
        self.assertTrue(result["database_url_was_controlled_sqlite"])


if __name__ == "__main__":
    unittest.main()
