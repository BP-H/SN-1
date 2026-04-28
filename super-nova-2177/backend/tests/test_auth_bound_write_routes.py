import json
import os
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def run_auth_probe(probe: str) -> dict:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "auth_bound_write_routes.sqlite"
        env = os.environ.copy()
        env.update(
            {
                "DATABASE_URL": f"sqlite:///{db_path.as_posix()}",
                "DB_MODE": "central",
                "SECRET_KEY": "strong-test-secret-for-auth-bound-write-routes",
                "SUPERNOVA_ENV": "development",
                "APP_ENV": "development",
                "ENV": "development",
                "UPLOADS_DIR": str(Path(tmpdir) / "uploads"),
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
        if line.startswith("AUTH_BOUND_WRITE_ROUTES_RESULT=")
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
            bio="original",
            species="human",
            profile_pic="default.jpg",
        )
        bob = backend_app.Harmonizer(
            username="bob",
            email="bob@example.test",
            hashed_password="test",
            bio="other",
            species="ai",
            profile_pic="default.jpg",
        )
        db.add_all([alice, bob])
        db.commit()
        backend_app._ensure_direct_messages_table(db)
        rows = [
            {
                "id": "msg-1",
                "conversation_id": backend_app._conversation_id("alice", "bob"),
                "sender": "alice",
                "recipient": "bob",
                "body": "hello bob",
                "created_at": "2026-01-01T12:00:00Z",
            },
            {
                "id": "msg-2",
                "conversation_id": backend_app._conversation_id("bob", "alice"),
                "sender": "bob",
                "recipient": "alice",
                "body": "hello alice",
                "created_at": "2026-01-01T12:01:00Z",
            },
        ]
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
    finally:
        db.close()


seed_users()
upload_dir = Path(os.environ["UPLOADS_DIR"])
alice_token = backend_app._create_wrapper_access_token("alice")
bob_token = backend_app._create_wrapper_access_token("bob")
alice_headers = {"Authorization": f"Bearer {alice_token}"}
bob_headers = {"Authorization": f"Bearer {bob_token}"}
invalid_headers = {"Authorization": "Bearer not-a-valid-token"}


def uploaded_files():
    if not upload_dir.exists():
        return []
    return sorted(item.name for item in upload_dir.iterdir() if item.is_file())


def profile_pic_for(username):
    db = backend_app.SessionLocal()
    try:
        user = db.query(backend_app.Harmonizer).filter(
            backend_app.func.lower(backend_app.Harmonizer.username) == username.lower()
        ).first()
        return getattr(user, "profile_pic", "") if user else ""
    finally:
        db.close()


def user_id_for(username):
    db = backend_app.SessionLocal()
    try:
        user = db.query(backend_app.Harmonizer).filter(
            backend_app.func.lower(backend_app.Harmonizer.username) == username.lower()
        ).first()
        return getattr(user, "id", None)
    finally:
        db.close()
"""


class AuthBoundWriteRouteTests(unittest.TestCase):
    def test_profile_update_requires_matching_bearer_identity(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            missing = client.patch("/profile/alice", json={"bio": "missing token"})
            invalid = client.patch("/profile/alice", json={"bio": "invalid token"}, headers=invalid_headers)
            wrong = client.patch("/profile/alice", json={"bio": "wrong token"}, headers=bob_headers)
            matching = client.patch("/profile/alice", json={"bio": "updated bio"}, headers=alice_headers)
            public_read = client.get("/profile/alice")
            result = {
                "missing_status": missing.status_code,
                "invalid_status": invalid.status_code,
                "wrong_status": wrong.status_code,
                "matching_status": matching.status_code,
                "matching_username": matching.json().get("username"),
                "matching_bio": matching.json().get("bio"),
                "public_read_status": public_read.status_code,
            }
            print("AUTH_BOUND_WRITE_ROUTES_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_auth_probe(probe)

        self.assertEqual(result["missing_status"], 401)
        self.assertEqual(result["invalid_status"], 401)
        self.assertEqual(result["wrong_status"], 403)
        self.assertEqual(result["matching_status"], 200)
        self.assertEqual(result["matching_username"], "alice")
        self.assertEqual(result["matching_bio"], "updated bio")
        self.assertEqual(result["public_read_status"], 200)

    def test_message_reads_require_matching_bearer_identity(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            missing = client.get("/messages?user=alice")
            invalid = client.get("/messages?user=alice", headers=invalid_headers)
            wrong = client.get("/messages?user=alice", headers=bob_headers)
            matching = client.get("/messages?user=alice", headers=alice_headers)
            payload = matching.json()
            conversations = payload.get("conversations", [])
            result = {
                "missing_status": missing.status_code,
                "invalid_status": invalid.status_code,
                "wrong_status": wrong.status_code,
                "matching_status": matching.status_code,
                "keys": sorted(payload.keys()),
                "conversation_count": len(conversations),
                "first_peer": conversations[0].get("peer") if conversations else "",
                "last_message_keys": sorted(conversations[0].get("last_message", {}).keys()) if conversations else [],
            }
            print("AUTH_BOUND_WRITE_ROUTES_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_auth_probe(probe)

        self.assertEqual(result["missing_status"], 401)
        self.assertEqual(result["invalid_status"], 401)
        self.assertEqual(result["wrong_status"], 403)
        self.assertEqual(result["matching_status"], 200)
        self.assertEqual(result["keys"], ["conversations"])
        self.assertEqual(result["conversation_count"], 1)
        self.assertEqual(result["first_peer"], "bob")
        self.assertEqual(
            set(result["last_message_keys"]),
            {"body", "conversation_id", "created_at", "id", "recipient", "sender"},
        )

    def test_message_writes_require_matching_bearer_identity(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            body = {"sender": "alice", "recipient": "bob", "body": "secure hello"}
            missing = client.post("/messages", json=body)
            invalid = client.post("/messages", json=body, headers=invalid_headers)
            wrong = client.post("/messages", json=body, headers=bob_headers)
            matching = client.post("/messages", json=body, headers=alice_headers)
            payload = matching.json()
            result = {
                "missing_status": missing.status_code,
                "invalid_status": invalid.status_code,
                "wrong_status": wrong.status_code,
                "matching_status": matching.status_code,
                "keys": sorted(payload.keys()),
                "sender": payload.get("sender"),
                "recipient": payload.get("recipient"),
                "body": payload.get("body"),
            }
            print("AUTH_BOUND_WRITE_ROUTES_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_auth_probe(probe)

        self.assertEqual(result["missing_status"], 401)
        self.assertEqual(result["invalid_status"], 401)
        self.assertEqual(result["wrong_status"], 403)
        self.assertEqual(result["matching_status"], 200)
        self.assertEqual(
            set(result["keys"]),
            {"body", "conversation_id", "created_at", "id", "recipient", "sender"},
        )
        self.assertEqual(result["sender"], "alice")
        self.assertEqual(result["recipient"], "bob")
        self.assertEqual(result["body"], "secure hello")

    def test_raw_image_upload_without_profile_sync_still_succeeds(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            response = client.post(
                "/upload-image",
                files={"file": ("raw.png", b"small-image", "image/png")},
            )
            payload = response.json()
            result = {
                "status_code": response.status_code,
                "keys": sorted(payload.keys()),
                "filename": payload.get("filename", ""),
                "url": payload.get("url", ""),
                "profile_synced": payload.get("profile_synced"),
                "files": uploaded_files(),
            }
            print("AUTH_BOUND_WRITE_ROUTES_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_auth_probe(probe)

        self.assertEqual(result["status_code"], 200)
        self.assertEqual(
            set(result["keys"]),
            {"content_type", "filename", "profile_synced", "sync_error", "url"},
        )
        self.assertTrue(result["filename"].endswith(".png"))
        self.assertEqual(result["url"], f"/uploads/{result['filename']}")
        self.assertFalse(result["profile_synced"])
        self.assertEqual(result["files"], [result["filename"]])

    def test_upload_image_username_profile_sync_requires_matching_bearer_identity(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            missing = client.post(
                "/upload-image",
                data={"username": "alice"},
                files={"file": ("missing.png", b"small-image", "image/png")},
            )
            invalid = client.post(
                "/upload-image",
                data={"username": "alice"},
                files={"file": ("invalid.png", b"small-image", "image/png")},
                headers=invalid_headers,
            )
            wrong = client.post(
                "/upload-image",
                data={"username": "alice"},
                files={"file": ("wrong.png", b"small-image", "image/png")},
                headers=bob_headers,
            )
            matching = client.post(
                "/upload-image",
                data={"username": "alice"},
                files={"file": ("matching.png", b"small-image", "image/png")},
                headers=alice_headers,
            )
            payload = matching.json()
            result = {
                "missing_status": missing.status_code,
                "invalid_status": invalid.status_code,
                "wrong_status": wrong.status_code,
                "matching_status": matching.status_code,
                "keys": sorted(payload.keys()),
                "profile_synced": payload.get("profile_synced"),
                "url": payload.get("url"),
                "profile_pic": profile_pic_for("alice"),
                "files": uploaded_files(),
            }
            print("AUTH_BOUND_WRITE_ROUTES_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_auth_probe(probe)

        self.assertEqual(result["missing_status"], 401)
        self.assertEqual(result["invalid_status"], 401)
        self.assertEqual(result["wrong_status"], 403)
        self.assertEqual(result["matching_status"], 200)
        self.assertEqual(
            set(result["keys"]),
            {"content_type", "filename", "profile_synced", "sync_error", "url"},
        )
        self.assertTrue(result["profile_synced"])
        self.assertEqual(result["profile_pic"], result["url"])
        self.assertEqual(len(result["files"]), 1)

    def test_upload_image_user_id_profile_sync_requires_matching_bearer_identity(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            alice_id = user_id_for("alice")
            missing = client.post(
                "/upload-image",
                data={"user_id": str(alice_id)},
                files={"file": ("missing.png", b"small-image", "image/png")},
            )
            invalid = client.post(
                "/upload-image",
                data={"user_id": str(alice_id)},
                files={"file": ("invalid.png", b"small-image", "image/png")},
                headers=invalid_headers,
            )
            wrong = client.post(
                "/upload-image",
                data={"user_id": str(alice_id)},
                files={"file": ("wrong.png", b"small-image", "image/png")},
                headers=bob_headers,
            )
            matching = client.post(
                "/upload-image",
                data={"user_id": str(alice_id)},
                files={"file": ("matching.png", b"small-image", "image/png")},
                headers=alice_headers,
            )
            payload = matching.json()
            result = {
                "missing_status": missing.status_code,
                "invalid_status": invalid.status_code,
                "wrong_status": wrong.status_code,
                "matching_status": matching.status_code,
                "profile_synced": payload.get("profile_synced"),
                "url": payload.get("url"),
                "profile_pic": profile_pic_for("alice"),
                "files": uploaded_files(),
            }
            print("AUTH_BOUND_WRITE_ROUTES_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_auth_probe(probe)

        self.assertEqual(result["missing_status"], 401)
        self.assertEqual(result["invalid_status"], 401)
        self.assertEqual(result["wrong_status"], 403)
        self.assertEqual(result["matching_status"], 200)
        self.assertTrue(result["profile_synced"])
        self.assertEqual(result["profile_pic"], result["url"])
        self.assertEqual(len(result["files"]), 1)


if __name__ == "__main__":
    unittest.main()
