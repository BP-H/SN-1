import json
import os
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def run_mention_probe(probe: str) -> dict:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "comment_mentions.sqlite"
        env = os.environ.copy()
        env.update(
            {
                "DATABASE_URL": f"sqlite:///{db_path.as_posix()}",
                "DB_MODE": "central",
                "SECRET_KEY": "strong-test-secret-for-comment-mentions",
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
        if line.startswith("COMMENT_MENTION_RESULT=")
    ]
    if not result_lines:
        raise AssertionError(f"probe result missing\nstdout:\n{completed.stdout}")
    return json.loads(result_lines[-1].split("=", 1)[1])


PROBE_PREAMBLE = """
import datetime
import json
import os
import sys
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import text

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


def seed_graph():
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
        db.refresh(alice)
        db.refresh(bob)
        node = backend_app.VibeNode(name="mention-test-node", author_id=alice.id)
        proposal = backend_app.Proposal(
            title="Mention target proposal",
            description="Used to pin comment mention behavior.",
            userName="alice",
            userInitials="AL",
            author_type="human",
            author_id=alice.id,
            voting_deadline=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        )
        db.add_all([node, proposal])
        db.commit()
        db.refresh(proposal)
        return {"proposal_id": proposal.id}
    finally:
        db.close()


seeded = seed_graph()
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


def mention_usernames_for_comment(comment_id):
    db = backend_app.SessionLocal()
    try:
        rows = db.execute(
            text(
                "SELECT h.username FROM comment_mentions cm "
                "JOIN harmonizers h ON h.id = cm.harmonizer_id "
                "WHERE cm.comment_id = :comment_id ORDER BY lower(h.username)"
            ),
            {"comment_id": comment_id},
        ).fetchall()
        return [row[0] for row in rows]
    finally:
        db.close()
"""


class CommentMentionNotificationTests(unittest.TestCase):
    def test_comment_mentions_create_deduped_records_and_notifications(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            response = client.post(
                "/comments",
                json={
                    "proposal_id": seeded["proposal_id"],
                    "user": "alice",
                    "species": "human",
                    "comment": "hello @bob @BOB @cara @alice @ghost",
                },
                headers=alice_headers,
            )
            payload = response.json()
            comment_id = payload.get("comments", [{}])[0].get("id")
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
                "comment_id": comment_id,
                "mention_links": mention_usernames_for_comment(comment_id),
                "bob_notifications": bob_notifications,
                "cara_notifications": cara_notifications,
                "alice_notifications": alice_notifications,
                "bob_api_mentions": bob_api_mentions,
            }
            print("COMMENT_MENTION_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_mention_probe(probe)

        self.assertEqual(result["status_code"], 200)
        self.assertEqual(set(result["response_keys"]), {"comments", "ok", "species"})
        self.assertGreater(result["comment_id"], 0)
        self.assertEqual(result["mention_links"], ["bob", "cara"])
        self.assertEqual(len(result["bob_notifications"]), 1)
        self.assertEqual(len(result["cara_notifications"]), 1)
        self.assertEqual(result["alice_notifications"], [])
        self.assertEqual(result["bob_notifications"][0]["type"], "mention")
        self.assertEqual(result["bob_notifications"][0]["actor"], "alice")
        self.assertEqual(result["bob_notifications"][0]["mentioned_user"], "bob")
        self.assertEqual(result["bob_notifications"][0]["comment_id"], result["comment_id"])
        self.assertEqual(len(result["bob_api_mentions"]), 1)
        self.assertEqual(result["bob_api_mentions"][0]["type"], "mention")
        self.assertEqual(result["bob_api_mentions"][0]["actor"], "alice")

    def test_comment_mention_path_preserves_auth_and_public_read_behavior(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            body = {
                "proposal_id": seeded["proposal_id"],
                "user": "alice",
                "species": "human",
                "comment": "secure mention @bob",
            }
            missing = client.post("/comments", json=body)
            invalid = client.post("/comments", json=body, headers=invalid_headers)
            wrong = client.post("/comments", json=body, headers=bob_headers)
            matching = client.post("/comments", json=body, headers=alice_headers)
            public_read = client.get(f"/comments?proposal_id={seeded['proposal_id']}")
            result = {
                "missing_status": missing.status_code,
                "invalid_status": invalid.status_code,
                "wrong_status": wrong.status_code,
                "matching_status": matching.status_code,
                "matching_keys": sorted(matching.json().keys()),
                "public_read_status": public_read.status_code,
                "public_count": len(public_read.json()),
                "bob_notifications": notification_messages_for("bob"),
            }
            print("COMMENT_MENTION_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_mention_probe(probe)

        self.assertEqual(result["missing_status"], 401)
        self.assertEqual(result["invalid_status"], 401)
        self.assertEqual(result["wrong_status"], 403)
        self.assertEqual(result["matching_status"], 200)
        self.assertEqual(set(result["matching_keys"]), {"comments", "ok", "species"})
        self.assertEqual(result["public_read_status"], 200)
        self.assertEqual(result["public_count"], 1)
        self.assertEqual(len(result["bob_notifications"]), 1)

    def test_existing_reply_notifications_remain_available(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            root = client.post(
                "/comments",
                json={
                    "proposal_id": seeded["proposal_id"],
                    "user": "alice",
                    "species": "human",
                    "comment": "root comment",
                },
                headers=alice_headers,
            )
            parent_id = root.json().get("comments", [{}])[0].get("id")
            reply = client.post(
                "/comments",
                json={
                    "proposal_id": seeded["proposal_id"],
                    "user": "bob",
                    "species": "ai",
                    "comment": "reply without mention",
                    "parent_comment_id": parent_id,
                },
                headers=bob_headers,
            )
            alice_items = client.get("/notifications?user=alice&limit=10").json()
            reply_items = [item for item in alice_items if item.get("type") == "comment_reply"]
            mention_items = [item for item in alice_items if item.get("type") == "mention"]
            result = {
                "root_status": root.status_code,
                "reply_status": reply.status_code,
                "reply_count": len(reply_items),
                "mention_count": len(mention_items),
                "reply_actor": reply_items[0].get("actor") if reply_items else "",
                "reply_parent": reply_items[0].get("parent_comment_id") if reply_items else None,
            }
            print("COMMENT_MENTION_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_mention_probe(probe)

        self.assertEqual(result["root_status"], 200)
        self.assertEqual(result["reply_status"], 200)
        self.assertEqual(result["reply_count"], 1)
        self.assertEqual(result["mention_count"], 0)
        self.assertEqual(result["reply_actor"], "bob")
        self.assertGreater(result["reply_parent"], 0)


if __name__ == "__main__":
    unittest.main()

