import json
import os
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def run_system_vote_probe(probe: str, extra_env: dict | None = None) -> dict:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "system_vote_auth_deadline.sqlite"
        env = os.environ.copy()
        env.update(
            {
                "DATABASE_URL": f"sqlite:///{db_path.as_posix()}",
                "DB_MODE": "central",
                "SECRET_KEY": "strong-test-secret-for-system-vote-auth-deadline",
                "SUPERNOVA_ENV": "development",
                "APP_ENV": "development",
                "ENV": "development",
            }
        )
        env.pop("RAILWAY_ENVIRONMENT", None)
        env.pop("SYSTEM_VOTE_DEADLINE", None)
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
        if line.startswith("SYSTEM_VOTE_AUTH_DEADLINE_RESULT=")
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
from db_models import Base

client = TestClient(backend_app.app)


def current_bind():
    session = backend_app.SessionLocal()
    try:
        return session.get_bind()
    finally:
        session.close()


Base.metadata.create_all(bind=current_bind())


def seed_users():
    db = backend_app.SessionLocal()
    try:
        alice = backend_app.Harmonizer(
            username="alice",
            email="alice@example.test",
            hashed_password="test",
            species="human",
            profile_pic="default.jpg",
        )
        bob = backend_app.Harmonizer(
            username="bob",
            email="bob@example.test",
            hashed_password="test",
            species="ai",
            profile_pic="default.jpg",
        )
        db.add_all([alice, bob])
        db.commit()
    finally:
        db.close()


def system_vote_rows():
    db = backend_app.SessionLocal()
    try:
        backend_app._ensure_system_votes_table(db)
        rows = db.execute(
            backend_app.text("SELECT username, choice, voter_type FROM system_votes ORDER BY username")
        ).fetchall()
        return [
            {
                "username": row.username,
                "choice": row.choice,
                "voter_type": row.voter_type,
            }
            for row in rows
        ]
    finally:
        db.close()


seed_users()
alice_headers = {"Authorization": f"Bearer {backend_app._create_wrapper_access_token('alice')}"}
bob_headers = {"Authorization": f"Bearer {backend_app._create_wrapper_access_token('bob')}"}
invalid_headers = {"Authorization": "Bearer not-a-valid-token"}
"""


class SystemVoteAuthDeadlineTests(unittest.TestCase):
    def test_post_system_vote_requires_matching_bearer_identity(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            body = {"username": "alice", "choice": "yes", "voter_type": "company"}
            missing = client.post("/system-vote", json=body)
            invalid = client.post("/system-vote", json=body, headers=invalid_headers)
            wrong = client.post("/system-vote", json=body, headers=bob_headers)
            matching = client.post("/system-vote", json=body, headers=alice_headers)
            payload = matching.json()
            result = {
                "missing_status": missing.status_code,
                "invalid_status": invalid.status_code,
                "wrong_status": wrong.status_code,
                "matching_status": matching.status_code,
                "keys": sorted(payload.keys()),
                "likes": payload.get("likes"),
                "dislikes": payload.get("dislikes"),
                "user_vote": payload.get("user_vote"),
                "total": payload.get("total"),
                "deadline": payload.get("deadline"),
                "rows": system_vote_rows(),
            }
            print("SYSTEM_VOTE_AUTH_DEADLINE_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_system_vote_probe(probe)

        self.assertEqual(result["missing_status"], 401)
        self.assertEqual(result["invalid_status"], 401)
        self.assertEqual(result["wrong_status"], 403)
        self.assertEqual(result["matching_status"], 200)
        self.assertEqual(
            set(result["keys"]),
            {"deadline", "dislikes", "likes", "question", "total", "user_vote"},
        )
        self.assertEqual(result["likes"], [{"type": "human", "voter": "alice"}])
        self.assertEqual(result["dislikes"], [])
        self.assertEqual(result["user_vote"], "like")
        self.assertEqual(result["total"], 1)
        self.assertIsNone(result["deadline"])
        self.assertEqual(
            result["rows"],
            [{"choice": "yes", "username": "alice", "voter_type": "human"}],
        )

    def test_delete_system_vote_requires_matching_bearer_identity(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            body = {"username": "alice", "choice": "yes", "voter_type": "human"}
            client.post("/system-vote", json=body, headers=alice_headers)
            missing = client.delete("/system-vote?username=alice")
            invalid = client.delete("/system-vote?username=alice", headers=invalid_headers)
            wrong = client.delete("/system-vote?username=alice", headers=bob_headers)
            matching = client.delete("/system-vote?username=alice", headers=alice_headers)
            payload = matching.json()
            result = {
                "missing_status": missing.status_code,
                "invalid_status": invalid.status_code,
                "wrong_status": wrong.status_code,
                "matching_status": matching.status_code,
                "keys": sorted(payload.keys()),
                "likes": payload.get("likes"),
                "dislikes": payload.get("dislikes"),
                "user_vote": payload.get("user_vote"),
                "total": payload.get("total"),
                "rows": system_vote_rows(),
            }
            print("SYSTEM_VOTE_AUTH_DEADLINE_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_system_vote_probe(probe)

        self.assertEqual(result["missing_status"], 401)
        self.assertEqual(result["invalid_status"], 401)
        self.assertEqual(result["wrong_status"], 403)
        self.assertEqual(result["matching_status"], 200)
        self.assertEqual(
            set(result["keys"]),
            {"deadline", "dislikes", "likes", "question", "total", "user_vote"},
        )
        self.assertEqual(result["likes"], [])
        self.assertEqual(result["dislikes"], [])
        self.assertIsNone(result["user_vote"])
        self.assertEqual(result["total"], 0)
        self.assertEqual(result["rows"], [])

    def test_invalid_system_vote_choice_still_returns_400(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            response = client.post(
                "/system-vote",
                json={"username": "alice", "choice": "maybe", "voter_type": "human"},
                headers=alice_headers,
            )
            result = {
                "status_code": response.status_code,
                "detail": response.json().get("detail"),
                "rows": system_vote_rows(),
            }
            print("SYSTEM_VOTE_AUTH_DEADLINE_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_system_vote_probe(probe)

        self.assertEqual(result["status_code"], 400)
        self.assertEqual(result["detail"], "choice must be yes or no")
        self.assertEqual(result["rows"], [])

    def test_configured_past_deadline_blocks_new_vote_writes(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            response = client.post(
                "/system-vote",
                json={"username": "alice", "choice": "yes", "voter_type": "human"},
                headers=alice_headers,
            )
            result = {
                "status_code": response.status_code,
                "detail": response.json().get("detail"),
                "rows": system_vote_rows(),
                "config_deadline": client.get("/system-vote/config").json().get("deadline"),
            }
            print("SYSTEM_VOTE_AUTH_DEADLINE_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_system_vote_probe(
            probe,
            {"SYSTEM_VOTE_DEADLINE": "2000-01-01T00:00:00Z"},
        )

        self.assertEqual(result["status_code"], 403)
        self.assertEqual(result["detail"], "System vote deadline has passed")
        self.assertEqual(result["rows"], [])
        self.assertEqual(result["config_deadline"], "2000-01-01T00:00:00Z")

    def test_missing_deadline_is_open_and_does_not_use_stale_default(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            config = client.get("/system-vote/config")
            read = client.get("/system-vote?username=alice")
            response = client.post(
                "/system-vote",
                json={"username": "alice", "choice": "no", "voter_type": "human"},
                headers=alice_headers,
            )
            payload = response.json()
            result = {
                "config_status": config.status_code,
                "config_keys": sorted(config.json().keys()),
                "config_deadline": config.json().get("deadline"),
                "read_status": read.status_code,
                "read_keys": sorted(read.json().keys()),
                "read_deadline": read.json().get("deadline"),
                "write_status": response.status_code,
                "write_deadline": payload.get("deadline"),
                "dislikes": payload.get("dislikes"),
                "user_vote": payload.get("user_vote"),
            }
            print("SYSTEM_VOTE_AUTH_DEADLINE_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_system_vote_probe(probe)

        self.assertEqual(result["config_status"], 200)
        self.assertEqual(set(result["config_keys"]), {"deadline", "question"})
        self.assertIsNone(result["config_deadline"])
        self.assertEqual(result["read_status"], 200)
        self.assertEqual(
            set(result["read_keys"]),
            {"deadline", "dislikes", "likes", "question", "total", "user_vote"},
        )
        self.assertIsNone(result["read_deadline"])
        self.assertEqual(result["write_status"], 200)
        self.assertIsNone(result["write_deadline"])
        self.assertEqual(result["dislikes"], [{"type": "human", "voter": "alice"}])
        self.assertEqual(result["user_vote"], "dislike")


if __name__ == "__main__":
    unittest.main()
