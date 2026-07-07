import datetime
import json
import os
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def run_m1_probe(probe: str, extra_env=None) -> dict:
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
        db_path = Path(tmpdir) / "m1_backend_hardening.sqlite"
        env = os.environ.copy()
        env.update(
            {
                "DATABASE_URL": f"sqlite:///{db_path.as_posix()}",
                "DB_MODE": "central",
                "SECRET_KEY": "strong-test-secret-for-m1-hardening",
                "SUPERNOVA_ENV": "development",
                "APP_ENV": "development",
                "ENV": "development",
                "UPLOADS_DIR": str(Path(tmpdir) / "uploads"),
            }
        )
        env.update(extra_env or {})
        env.pop("RAILWAY_ENVIRONMENT", None)
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
        if line.startswith("M1_HARDENING_RESULT=")
    ]
    if not result_lines:
        raise AssertionError(f"probe result missing\nstdout:\n{completed.stdout}")
    return json.loads(result_lines[-1].split("=", 1)[1])


PROBE_PREAMBLE = """
import datetime
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
from db_models import Base

client = TestClient(backend_app.app)


def current_bind():
    session = backend_app.SessionLocal()
    try:
        return session.get_bind()
    finally:
        session.close()


Base.metadata.create_all(bind=current_bind())


def seed_large_feed(count=30):
    db = backend_app.SessionLocal()
    try:
        author = backend_app.Harmonizer(
            username="alice",
            email="alice@example.test",
            hashed_password="test",
            species="human",
            profile_pic="default.jpg",
        )
        db.add(author)
        db.commit()
        db.refresh(author)
        now = datetime.datetime.utcnow()
        body = "Large proposal body. " * 80
        for index in range(count):
            db.add(
                backend_app.Proposal(
                    title=f"GZip proposal {index}",
                    description=body,
                    userName="alice",
                    userInitials="AL",
                    author_type="human",
                    author_id=author.id,
                    created_at=now - datetime.timedelta(minutes=index),
                    voting_deadline=now + datetime.timedelta(days=7),
                )
            )
        db.commit()
    finally:
        db.close()
"""


class M1BackendHardeningTests(unittest.TestCase):
    def test_large_feed_responses_are_gzipped_without_losing_cors(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            seed_large_feed()
            feed = client.get(
                "/proposals?filter=latest&limit=30",
                headers={
                    "Accept-Encoding": "gzip",
                    "Origin": "https://2177.tech",
                },
            )
            health = client.get(
                "/health",
                headers={
                    "Accept-Encoding": "gzip",
                    "Origin": "https://2177.tech",
                },
            )
            result = {
                "feed_status": feed.status_code,
                "feed_encoding": feed.headers.get("content-encoding"),
                "feed_cors": feed.headers.get("access-control-allow-origin"),
                "feed_items": len(feed.json()),
                "health_status": health.status_code,
                "health_encoding": health.headers.get("content-encoding"),
            }
            print("M1_HARDENING_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_m1_probe(probe)

        self.assertEqual(result["feed_status"], 200)
        self.assertEqual(result["feed_encoding"], "gzip")
        self.assertIn(result["feed_cors"], {"*", "https://2177.tech"})
        self.assertEqual(result["feed_items"], 30)
        self.assertEqual(result["health_status"], 200)
        self.assertIsNone(result["health_encoding"])


if __name__ == "__main__":
    unittest.main()
