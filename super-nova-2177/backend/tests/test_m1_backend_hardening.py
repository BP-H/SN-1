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
    def test_schema_compatibility_ddl_is_centralized(self):
        source = (PROJECT_ROOT / "backend" / "app.py").read_text(encoding="utf-8")
        expected_counts = {
            "_ensure_proposal_read_indexes(db)": 1,
            "_ensure_comment_thread_columns(db)": 1,
            "_ensure_comment_votes_table(db)": 1,
            "_ensure_system_votes_table(db)": 1,
        }
        for call, expected in expected_counts.items():
            self.assertEqual(source.count(call), expected, call)
        self.assertIn("@app.on_event(\"startup\")", source)
        self.assertIn("def _ensure_startup_schema_compatibility", source)
        self.assertIn("def _ensure_schema_compatibility_once", source)

    def test_schema_compatibility_runs_for_non_lifespan_test_clients_once(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            first = client.get("/system-vote")
            original = backend_app._ensure_startup_schema_compatibility
            def fail_if_called_again(db):
                raise AssertionError("schema compatibility should already be ready")
            backend_app._ensure_startup_schema_compatibility = fail_if_called_again
            try:
                second = client.get("/system-vote")
            finally:
                backend_app._ensure_startup_schema_compatibility = original
            result = {
                "first_status": first.status_code,
                "second_status": second.status_code,
                "first_keys": sorted(first.json().keys()),
                "second_keys": sorted(second.json().keys()),
            }
            print("M1_HARDENING_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_m1_probe(probe)

        self.assertEqual(result["first_status"], 200)
        self.assertEqual(result["second_status"], 200)
        self.assertIn("likes", result["first_keys"])
        self.assertEqual(result["first_keys"], result["second_keys"])

    def test_m1_startup_index_definitions_include_safe_read_indexes(self):
        source = (PROJECT_ROOT / "backend" / "app.py").read_text(encoding="utf-8")

        for fragment in [
            "idx_harmonizers_username_lower",
            "ON harmonizers (LOWER(username))",
            "ON harmonizers (username COLLATE NOCASE)",
            "idx_comments_proposal_id",
            "ON comments (proposal_id, id)",
            "idx_comment_votes_comment_id",
            "ON comment_votes (comment_id)",
            "idx_proposal_collabs_proposal_status",
            "ON proposal_collabs (proposal_id, status)",
            "idx_direct_messages_conversation_created_id",
            "ON direct_messages (conversation_id, created_at, id)",
        ]:
            self.assertIn(fragment, source)

    def test_procfile_runs_two_workers_by_default_and_rate_limit_note_is_present(self):
        procfile = PROJECT_ROOT / "Procfile"
        self.assertTrue(procfile.exists())
        self.assertEqual(
            procfile.read_text(encoding="utf-8").strip(),
            "web: uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000} "
            "--workers ${WEB_CONCURRENCY:-2} --timeout-keep-alive 20",
        )

        rate_limit_source = (PROJECT_ROOT / "backend" / "commons_rate_limits.py").read_text(
            encoding="utf-8"
        )
        self.assertIn("per Python worker", rate_limit_source)
        self.assertIn("limit times worker count", rate_limit_source)

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

    def test_upload_static_files_are_immutable_cached_only_on_200(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            upload_dir = Path(backend_app.uploads_dir)
            upload_dir.mkdir(parents=True, exist_ok=True)
            (upload_dir / "cached-image.png").write_bytes(
                b"\\x89PNG\\r\\n\\x1a\\n" + (b"\\x00" * 64)
            )
            existing = client.get("/uploads/cached-image.png")
            missing = client.get("/uploads/missing-image.png")
            result = {
                "existing_status": existing.status_code,
                "existing_cache_control": existing.headers.get("cache-control"),
                "existing_content_type": existing.headers.get("content-type"),
                "missing_status": missing.status_code,
                "missing_cache_control": missing.headers.get("cache-control"),
            }
            print("M1_HARDENING_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_m1_probe(probe)

        self.assertEqual(result["existing_status"], 200)
        self.assertEqual(
            result["existing_cache_control"],
            "public, max-age=31536000, immutable",
        )
        self.assertTrue(result["existing_content_type"].startswith("image/png"))
        self.assertEqual(result["missing_status"], 404)
        self.assertNotEqual(
            result["missing_cache_control"],
            "public, max-age=31536000, immutable",
        )


if __name__ == "__main__":
    unittest.main()
