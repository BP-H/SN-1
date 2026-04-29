import json
import os
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def run_proposal_mention_probe(probe: str) -> dict:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "proposal_mentions.sqlite"
        env = os.environ.copy()
        env.update(
            {
                "DATABASE_URL": f"sqlite:///{db_path.as_posix()}",
                "DB_MODE": "central",
                "SECRET_KEY": "strong-test-secret-for-proposal-mentions",
                "SUPERNOVA_ENV": "development",
                "APP_ENV": "development",
                "ENV": "development",
                "UPLOADS_DIR": str(Path(tmpdir) / "uploads"),
                "FOLLOWS_STORE_PATH": str(Path(tmpdir) / "follows_store.json"),
            }
        )
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
        if line.startswith("PROPOSAL_MENTION_RESULT=")
    ]
    if not result_lines:
        raise AssertionError(f"probe result missing\nstdout:\n{completed.stdout}")
    return json.loads(result_lines[-1].split("=", 1)[1])


PROBE_PREAMBLE = """
import json
import os
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
from db_models import Base, Notification

backend_app.FOLLOWS_STORE_PATH = Path(os.environ["FOLLOWS_STORE_PATH"])
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
            bio="author",
            species="human",
            profile_pic="default.jpg",
        )
        bob = backend_app.Harmonizer(
            username="bob",
            email="bob@example.test",
            hashed_password="test",
            bio="mentioned",
            species="ai",
            profile_pic="default.jpg",
        )
        cara = backend_app.Harmonizer(
            username="cara",
            email="cara@example.test",
            hashed_password="test",
            bio="mentioned",
            species="company",
            profile_pic="default.jpg",
        )
        db.add_all([alice, bob, cara])
        db.commit()
    finally:
        db.close()


seed_users()
alice_token = backend_app._create_wrapper_access_token("alice")
bob_token = backend_app._create_wrapper_access_token("bob")
alice_headers = {"Authorization": f"Bearer {alice_token}"}
bob_headers = {"Authorization": f"Bearer {bob_token}"}
invalid_headers = {"Authorization": "Bearer not-a-valid-token"}


def notification_messages_for(username):
    db = backend_app.SessionLocal()
    try:
        user = db.query(backend_app.Harmonizer).filter(
            backend_app.func.lower(backend_app.Harmonizer.username) == username.lower()
        ).first()
        if not user:
            return []
        rows = (
            db.query(Notification)
            .filter(Notification.harmonizer_id == user.id)
            .order_by(Notification.id.asc())
            .all()
        )
        payloads = []
        for row in rows:
            try:
                payloads.append(json.loads(row.message))
            except Exception:
                payloads.append({"type": "legacy", "message": row.message})
        return payloads
    finally:
        db.close()
"""


class ProposalMentionNotificationTests(unittest.TestCase):
    def test_proposal_mentions_create_deduped_notifications(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            form = {
                "title": "Mention proposal",
                "body": "hello @bob @BOB @cara @alice @ghost",
                "author": "alice",
                "author_type": "human",
            }
            response = client.post("/proposals", data=form, headers=alice_headers)
            payload = response.json()
            bob_notifications = notification_messages_for("bob")
            cara_notifications = notification_messages_for("cara")
            alice_notifications = notification_messages_for("alice")
            bob_api_mentions = [
                item for item in client.get("/notifications?user=bob&limit=10").json()
                if item.get("type") == "mention"
            ]
            result = {
                "status_code": response.status_code,
                "response_keys": sorted(payload.keys()),
                "proposal_id": payload.get("id"),
                "title": payload.get("title"),
                "text": payload.get("text"),
                "userName": payload.get("userName"),
                "bob_notifications": bob_notifications,
                "cara_notifications": cara_notifications,
                "alice_notifications": alice_notifications,
                "bob_api_mentions": bob_api_mentions,
            }
            print("PROPOSAL_MENTION_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_proposal_mention_probe(probe)

        self.assertEqual(result["status_code"], 200)
        self.assertEqual(
            set(result["response_keys"]),
            {
                "author_img",
                "author_type",
                "comments",
                "dislikes",
                "domain_as_profile",
                "id",
                "likes",
                "media",
                "profile_url",
                "text",
                "time",
                "title",
                "userInitials",
                "userName",
            },
        )
        self.assertGreater(result["proposal_id"], 0)
        self.assertEqual(result["title"], "Mention proposal")
        self.assertEqual(result["text"], "hello @bob @BOB @cara @alice @ghost")
        self.assertEqual(result["userName"], "alice")
        self.assertEqual(len(result["bob_notifications"]), 1)
        self.assertEqual(len(result["cara_notifications"]), 1)
        self.assertEqual(result["alice_notifications"], [])
        self.assertEqual(result["bob_notifications"][0]["type"], "mention")
        self.assertEqual(result["bob_notifications"][0]["source_type"], "proposal")
        self.assertEqual(result["bob_notifications"][0]["actor"], "alice")
        self.assertEqual(result["bob_notifications"][0]["mentioned_user"], "bob")
        self.assertEqual(result["bob_notifications"][0]["proposal_id"], result["proposal_id"])
        self.assertEqual(len(result["bob_api_mentions"]), 1)
        self.assertEqual(result["bob_api_mentions"][0]["type"], "mention")
        self.assertEqual(result["bob_api_mentions"][0]["source_type"], "proposal")

    def test_proposal_mention_path_preserves_auth_and_public_read_behavior(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            form = {
                "title": "Secure mention proposal",
                "body": "secure proposal mention @bob",
                "author": "alice",
                "author_type": "human",
            }
            missing = client.post("/proposals", data=form)
            invalid = client.post("/proposals", data=form, headers=invalid_headers)
            wrong = client.post("/proposals", data=form, headers=bob_headers)
            matching = client.post("/proposals", data=form, headers=alice_headers)
            payload = matching.json()
            public_read = client.get("/proposals?filter=latest&author=alice&limit=10")
            result = {
                "missing_status": missing.status_code,
                "invalid_status": invalid.status_code,
                "wrong_status": wrong.status_code,
                "matching_status": matching.status_code,
                "matching_keys": sorted(payload.keys()),
                "public_read_status": public_read.status_code,
                "public_read_count": len(public_read.json()),
                "bob_notifications": notification_messages_for("bob"),
            }
            print("PROPOSAL_MENTION_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_proposal_mention_probe(probe)

        self.assertEqual(result["missing_status"], 401)
        self.assertEqual(result["invalid_status"], 401)
        self.assertEqual(result["wrong_status"], 403)
        self.assertEqual(result["matching_status"], 200)
        self.assertEqual(
            set(result["matching_keys"]),
            {
                "author_img",
                "author_type",
                "comments",
                "dislikes",
                "domain_as_profile",
                "id",
                "likes",
                "media",
                "profile_url",
                "text",
                "time",
                "title",
                "userInitials",
                "userName",
            },
        )
        self.assertEqual(result["public_read_status"], 200)
        self.assertEqual(result["public_read_count"], 1)
        self.assertEqual(len(result["bob_notifications"]), 1)


if __name__ == "__main__":
    unittest.main()

