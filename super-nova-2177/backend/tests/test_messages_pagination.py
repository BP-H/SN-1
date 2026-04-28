import json
import os
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def run_probe(probe: str) -> dict:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "messages_pagination.sqlite"
        env = os.environ.copy()
        env.update(
            {
                "DATABASE_URL": f"sqlite:///{db_path.as_posix()}",
                "DB_MODE": "central",
                "SECRET_KEY": "strong-test-secret-for-messages-pagination",
                "SUPERNOVA_ENV": "development",
                "APP_ENV": "development",
                "ENV": "development",
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
        if line.startswith("MESSAGES_PAGINATION_RESULT=")
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
from sqlalchemy import text

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


def seed_messages(thread_count=4):
    db = backend_app.SessionLocal()
    try:
        alice = backend_app.Harmonizer(
            username="alice",
            email="alice@example.test",
            hashed_password="test",
            species="human",
            profile_pic="",
        )
        bob = backend_app.Harmonizer(
            username="bob",
            email="bob@example.test",
            hashed_password="test",
            species="ai",
            profile_pic="",
        )
        cara = backend_app.Harmonizer(
            username="cara",
            email="cara@example.test",
            hashed_password="test",
            species="company",
            profile_pic="",
        )
        db.add_all([alice, bob, cara])
        db.commit()
        backend_app._ensure_direct_messages_table(db)

        alice_bob = backend_app._conversation_id("alice", "bob")
        alice_cara = backend_app._conversation_id("alice", "cara")
        rows = []
        base_time = datetime.datetime(2026, 1, 1, 12, 0, 0)
        for index in range(thread_count):
            sender, recipient = ("alice", "bob") if index % 2 == 0 else ("bob", "alice")
            rows.append(
                {
                    "id": f"msg-{index:03d}",
                    "conversation_id": alice_bob,
                    "sender": sender,
                    "recipient": recipient,
                    "body": f"bob thread {index:03d}",
                    "created_at": (base_time + datetime.timedelta(minutes=index)).isoformat(),
                }
            )
        rows.append(
            {
                "id": "msg-other",
                "conversation_id": alice_cara,
                "sender": "cara",
                "recipient": "alice",
                "body": "other conversation",
                "created_at": (base_time + datetime.timedelta(days=1)).isoformat(),
            }
        )
        for row in rows:
            db.execute(
                text(
                    "INSERT INTO direct_messages "
                    "(id, conversation_id, sender, recipient, body, created_at) "
                    "VALUES (:id, :conversation_id, :sender, :recipient, :body, :created_at)"
                ),
                row,
            )
        db.commit()
        return {
            "alice_bob": alice_bob,
            "alice_cara": alice_cara,
            "thread_count": thread_count,
        }
    finally:
        db.close()


alice_headers = {"Authorization": f"Bearer {backend_app._create_wrapper_access_token('alice')}"}
bob_headers = {"Authorization": f"Bearer {backend_app._create_wrapper_access_token('bob')}"}
invalid_headers = {"Authorization": "Bearer not-a-valid-token"}
"""


class MessagesPaginationTests(unittest.TestCase):
    def test_messages_conversation_list_without_limit_keeps_current_shape(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            seed_messages(thread_count=4)
            response = client.get("/messages?user=alice", headers=alice_headers)
            payload = response.json()
            conversations = payload.get("conversations", [])
            result = {
                "status_code": response.status_code,
                "keys": sorted(payload.keys()),
                "conversation_count": len(conversations),
                "peers": [item.get("peer") for item in conversations],
                "first_keys": sorted(conversations[0].keys()) if conversations else [],
                "last_message_keys": sorted(conversations[0].get("last_message", {}).keys()) if conversations else [],
            }
            print("MESSAGES_PAGINATION_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_probe(probe)

        self.assertEqual(result["status_code"], 200)
        self.assertEqual(result["keys"], ["conversations"])
        self.assertEqual(result["conversation_count"], 2)
        self.assertEqual(set(result["peers"]), {"bob", "cara"})
        self.assertEqual(set(result["first_keys"]), {"last_message", "peer", "updated_at"})
        self.assertEqual(
            set(result["last_message_keys"]),
            {"body", "conversation_id", "created_at", "id", "recipient", "sender"},
        )

    def test_messages_peer_thread_without_limit_keeps_full_current_shape(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            seed_messages(thread_count=4)
            response = client.get("/messages?user=alice&peer=bob", headers=alice_headers)
            payload = response.json()
            messages = payload.get("messages", [])
            result = {
                "status_code": response.status_code,
                "peer": payload.get("peer"),
                "ids": [item.get("id") for item in messages],
                "bodies": [item.get("body") for item in messages],
                "shape_keys": sorted(messages[0].keys()) if messages else [],
                "conversation_ids": sorted({item.get("conversation_id") for item in messages}),
            }
            print("MESSAGES_PAGINATION_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_probe(probe)

        self.assertEqual(result["status_code"], 200)
        self.assertEqual(result["peer"], "bob")
        self.assertEqual(result["ids"], ["msg-000", "msg-001", "msg-002", "msg-003"])
        self.assertEqual(
            result["bodies"],
            ["bob thread 000", "bob thread 001", "bob thread 002", "bob thread 003"],
        )
        self.assertEqual(
            set(result["shape_keys"]),
            {"body", "conversation_id", "created_at", "id", "recipient", "sender"},
        )
        self.assertEqual(len(result["conversation_ids"]), 1)

    def test_messages_peer_thread_limit_returns_first_stable_slice(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            seed_messages(thread_count=4)
            response = client.get(
                "/messages?user=alice&peer=bob&limit=2",
                headers=alice_headers,
            )
            payload = response.json()
            result = {
                "status_code": response.status_code,
                "ids": [item.get("id") for item in payload.get("messages", [])],
                "bodies": [item.get("body") for item in payload.get("messages", [])],
                "conversation_ids": sorted({item.get("conversation_id") for item in payload.get("messages", [])}),
            }
            print("MESSAGES_PAGINATION_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_probe(probe)

        self.assertEqual(result["status_code"], 200)
        self.assertEqual(result["ids"], ["msg-000", "msg-001"])
        self.assertEqual(result["bodies"], ["bob thread 000", "bob thread 001"])
        self.assertEqual(len(result["conversation_ids"]), 1)

    def test_messages_peer_thread_limit_and_offset_return_expected_slice(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            seed_messages(thread_count=4)
            response = client.get(
                "/messages?user=alice&peer=bob&limit=2&offset=1",
                headers=alice_headers,
            )
            payload = response.json()
            result = {
                "status_code": response.status_code,
                "ids": [item.get("id") for item in payload.get("messages", [])],
                "bodies": [item.get("body") for item in payload.get("messages", [])],
            }
            print("MESSAGES_PAGINATION_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_probe(probe)

        self.assertEqual(result["status_code"], 200)
        self.assertEqual(result["ids"], ["msg-001", "msg-002"])
        self.assertEqual(result["bodies"], ["bob thread 001", "bob thread 002"])

    def test_messages_excessive_limit_is_clamped(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            seed_messages(thread_count=505)
            response = client.get(
                "/messages?user=alice&peer=bob&limit=9999",
                headers=alice_headers,
            )
            payload = response.json()
            messages = payload.get("messages", [])
            result = {
                "status_code": response.status_code,
                "count": len(messages),
                "first": messages[0].get("id") if messages else "",
                "last": messages[-1].get("id") if messages else "",
            }
            print("MESSAGES_PAGINATION_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_probe(probe)

        self.assertEqual(result["status_code"], 200)
        self.assertEqual(result["count"], 500)
        self.assertEqual(result["first"], "msg-000")
        self.assertEqual(result["last"], "msg-499")

    def test_messages_invalid_limit_rejects_and_negative_offset_normalizes(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            seed_messages(thread_count=4)
            invalid_limit = client.get(
                "/messages?user=alice&peer=bob&limit=not-an-int",
                headers=alice_headers,
            )
            negative_offset = client.get(
                "/messages?user=alice&peer=bob&limit=2&offset=-10",
                headers=alice_headers,
            )
            payload = negative_offset.json()
            result = {
                "invalid_limit_status": invalid_limit.status_code,
                "negative_offset_status": negative_offset.status_code,
                "negative_offset_ids": [item.get("id") for item in payload.get("messages", [])],
            }
            print("MESSAGES_PAGINATION_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_probe(probe)

        self.assertEqual(result["invalid_limit_status"], 422)
        self.assertEqual(result["negative_offset_status"], 200)
        self.assertEqual(result["negative_offset_ids"], ["msg-000", "msg-001"])

    def test_messages_auth_requirements_are_unchanged(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            seed_messages(thread_count=4)
            missing = client.get("/messages?user=alice&peer=bob&limit=2")
            invalid = client.get(
                "/messages?user=alice&peer=bob&limit=2",
                headers=invalid_headers,
            )
            wrong = client.get(
                "/messages?user=alice&peer=bob&limit=2",
                headers=bob_headers,
            )
            matching = client.get(
                "/messages?user=alice&peer=bob&limit=2",
                headers=alice_headers,
            )
            result = {
                "missing_status": missing.status_code,
                "invalid_status": invalid.status_code,
                "wrong_status": wrong.status_code,
                "matching_status": matching.status_code,
            }
            print("MESSAGES_PAGINATION_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_probe(probe)

        self.assertEqual(result["missing_status"], 401)
        self.assertEqual(result["invalid_status"], 401)
        self.assertEqual(result["wrong_status"], 403)
        self.assertEqual(result["matching_status"], 200)


if __name__ == "__main__":
    unittest.main()
