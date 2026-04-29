import json
import os
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def run_delete_mention_probe(probe: str) -> dict:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "delete_with_mentions.sqlite"
        env = os.environ.copy()
        env.update(
            {
                "DATABASE_URL": f"sqlite:///{db_path.as_posix()}",
                "DB_MODE": "central",
                "SECRET_KEY": "strong-test-secret-for-delete-mentions",
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
        if line.startswith("DELETE_MENTION_RESULT=")
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


def seed_users():
    db = backend_app.SessionLocal()
    try:
        users = [
            backend_app.Harmonizer(
                username="alice",
                email="alice@example.test",
                hashed_password="test",
                bio="author",
                species="human",
                profile_pic="default.jpg",
            ),
            backend_app.Harmonizer(
                username="bob",
                email="bob@example.test",
                hashed_password="test",
                bio="mentioned",
                species="ai",
                profile_pic="default.jpg",
            ),
            backend_app.Harmonizer(
                username="cara",
                email="cara@example.test",
                hashed_password="test",
                bio="wrong user",
                species="company",
                profile_pic="default.jpg",
            ),
        ]
        db.add_all(users)
        db.commit()
    finally:
        db.close()


seed_users()
alice_token = backend_app._create_wrapper_access_token("alice")
bob_token = backend_app._create_wrapper_access_token("bob")
cara_token = backend_app._create_wrapper_access_token("cara")
alice_headers = {"Authorization": f"Bearer {alice_token}"}
bob_headers = {"Authorization": f"Bearer {bob_token}"}
cara_headers = {"Authorization": f"Bearer {cara_token}"}


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


class DeleteWithMentionsTests(unittest.TestCase):
    def test_comment_with_mentions_can_be_deleted_by_author(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            proposal = client.post(
                "/proposals",
                data={
                    "title": "Delete comment mention target",
                    "body": "proposal body",
                    "author": "alice",
                    "author_type": "human",
                },
                headers=alice_headers,
            )
            proposal_id = proposal.json().get("id")
            comment = client.post(
                "/comments",
                json={
                    "proposal_id": proposal_id,
                    "user": "alice",
                    "species": "human",
                    "comment": "hello @bob",
                },
                headers=alice_headers,
            )
            comment_id = comment.json().get("comments", [{}])[0].get("id")
            before_links = mention_usernames_for_comment(comment_id)
            wrong = client.delete(
                f"/comments/{comment_id}?user=bob",
                headers=bob_headers,
            )
            deleted = client.delete(
                f"/comments/{comment_id}?user=alice",
                headers=alice_headers,
            )
            public_read = client.get(f"/comments?proposal_id={proposal_id}")
            after_links = mention_usernames_for_comment(comment_id)
            result = {
                "proposal_status": proposal.status_code,
                "comment_status": comment.status_code,
                "comment_id": comment_id,
                "before_links": before_links,
                "wrong_status": wrong.status_code,
                "delete_status": deleted.status_code,
                "delete_keys": sorted(deleted.json().keys()),
                "tombstone": deleted.json().get("tombstone"),
                "public_read_status": public_read.status_code,
                "public_count": len(public_read.json()),
                "after_links": after_links,
                "bob_notifications": notification_messages_for("bob"),
            }
            print("DELETE_MENTION_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_delete_mention_probe(probe)

        self.assertEqual(result["proposal_status"], 200)
        self.assertEqual(result["comment_status"], 200)
        self.assertGreater(result["comment_id"], 0)
        self.assertEqual(result["before_links"], ["bob"])
        self.assertEqual(result["wrong_status"], 403)
        self.assertEqual(result["delete_status"], 200)
        self.assertEqual(
            set(result["delete_keys"]),
            {"deleted", "ok", "pruned_comment_ids", "tombstone"},
        )
        self.assertFalse(result["tombstone"])
        self.assertEqual(result["public_read_status"], 200)
        self.assertEqual(result["public_count"], 0)
        self.assertEqual(result["after_links"], [])
        self.assertEqual(len(result["bob_notifications"]), 1)

    def test_proposal_with_mention_notification_can_be_deleted_by_author(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            proposal = client.post(
                "/proposals",
                data={
                    "title": "Delete proposal mention target",
                    "body": "proposal body @bob",
                    "author": "alice",
                    "author_type": "human",
                },
                headers=alice_headers,
            )
            proposal_id = proposal.json().get("id")
            wrong = client.delete(
                f"/proposals/{proposal_id}?author=bob",
                headers=bob_headers,
            )
            deleted = client.delete(
                f"/proposals/{proposal_id}?author=alice",
                headers=alice_headers,
            )
            public_read = client.get(f"/proposals/{proposal_id}")
            result = {
                "proposal_status": proposal.status_code,
                "proposal_id": proposal_id,
                "wrong_status": wrong.status_code,
                "delete_status": deleted.status_code,
                "delete_payload": deleted.json(),
                "public_read_status": public_read.status_code,
                "bob_notifications": notification_messages_for("bob"),
            }
            print("DELETE_MENTION_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_delete_mention_probe(probe)

        self.assertEqual(result["proposal_status"], 200)
        self.assertGreater(result["proposal_id"], 0)
        self.assertEqual(result["wrong_status"], 403)
        self.assertEqual(result["delete_status"], 200)
        self.assertEqual(result["delete_payload"], {"deleted_id": result["proposal_id"], "ok": True})
        self.assertEqual(result["public_read_status"], 404)
        self.assertEqual(len(result["bob_notifications"]), 1)
        self.assertEqual(result["bob_notifications"][0]["type"], "mention")
        self.assertEqual(result["bob_notifications"][0]["source_type"], "proposal")


if __name__ == "__main__":
    unittest.main()
