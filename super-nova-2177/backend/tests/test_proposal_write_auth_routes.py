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


def run_proposal_auth_probe(probe: str) -> dict:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "proposal_write_auth_routes.sqlite"
        env = os.environ.copy()
        env.update(
            {
                "DATABASE_URL": f"sqlite:///{db_path.as_posix()}",
                "DB_MODE": "central",
                "SECRET_KEY": "strong-test-secret-for-proposal-write-auth",
                "SUPERNOVA_ENV": "development",
                "APP_ENV": "development",
                "ENV": "development",
                "UPLOADS_DIR": str(Path(tmpdir) / "uploads"),
            }
        )
        env.pop("RAILWAY_ENVIRONMENT", None)
        env.pop("ENABLE_BULK_PROPOSAL_DELETE", None)

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
        if line.startswith("PROPOSAL_WRITE_AUTH_RESULT=")
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
        cara = backend_app.Harmonizer(
            username="cara",
            email="cara@example.test",
            hashed_password="test",
            species="company",
            profile_pic="default.jpg",
        )
        db.add_all([alice, bob, cara])
        db.commit()
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


def create_proposal(title="Auth proposal", author="alice"):
    db = backend_app.SessionLocal()
    try:
        author_id = user_id_for(author)
        proposal = backend_app.Proposal(
            title=title,
            description=f"{title} body",
            userName=author,
            userInitials=author[:2].upper(),
            author_type="human",
            author_id=author_id,
            voting_deadline=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        )
        db.add(proposal)
        db.commit()
        db.refresh(proposal)
        return proposal.id
    finally:
        db.close()


def add_collab(proposal_id, collaborator="bob", status="pending"):
    db = backend_app.SessionLocal()
    try:
        collab = backend_app.ProposalCollab(
            proposal_id=proposal_id,
            author_user_id=user_id_for("alice"),
            collaborator_user_id=user_id_for(collaborator),
            requested_by_user_id=user_id_for("alice"),
            status=status,
            requested_at=datetime.datetime.utcnow(),
            responded_at=datetime.datetime.utcnow() if status in {"approved", "declined"} else None,
            removed_at=datetime.datetime.utcnow() if status == "removed" else None,
        )
        db.add(collab)
        db.commit()
        db.refresh(collab)
        return collab.id
    finally:
        db.close()


def proposal_exists(proposal_id):
    db = backend_app.SessionLocal()
    try:
        return db.query(backend_app.Proposal).filter(backend_app.Proposal.id == proposal_id).count() == 1
    finally:
        db.close()


def proposal_title(proposal_id):
    db = backend_app.SessionLocal()
    try:
        proposal = db.query(backend_app.Proposal).filter(backend_app.Proposal.id == proposal_id).first()
        return getattr(proposal, "title", "") if proposal else ""
    finally:
        db.close()


def collab_count_for(proposal_id):
    db = backend_app.SessionLocal()
    try:
        return db.query(backend_app.ProposalCollab).filter(
            backend_app.ProposalCollab.proposal_id == proposal_id
        ).count()
    finally:
        db.close()


seed_users()
alice_headers = {"Authorization": f"Bearer {backend_app._create_wrapper_access_token('alice')}"}
bob_headers = {"Authorization": f"Bearer {backend_app._create_wrapper_access_token('bob')}"}
invalid_headers = {"Authorization": "Bearer not-a-valid-token"}
"""


class ProposalWriteAuthRoutesTests(unittest.TestCase):
    def test_create_proposal_requires_matching_bearer_and_keeps_public_reads_open(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            form = {
                "title": "Created by Alice",
                "body": "Proposal create should require matching auth.",
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
                "keys": sorted(payload.keys()),
                "title": payload.get("title"),
                "userName": payload.get("userName"),
                "public_read_status": public_read.status_code,
                "public_read_count": len(public_read.json()),
            }
            print("PROPOSAL_WRITE_AUTH_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_proposal_auth_probe(probe)

        self.assertEqual(result["missing_status"], 401)
        self.assertEqual(result["invalid_status"], 401)
        self.assertEqual(result["wrong_status"], 403)
        self.assertEqual(result["matching_status"], 200)
        self.assertIn("id", result["keys"])
        self.assertEqual(result["title"], "Created by Alice")
        self.assertEqual(result["userName"], "alice")
        self.assertEqual(result["public_read_status"], 200)
        self.assertGreaterEqual(result["public_read_count"], 1)

    def test_edit_proposal_requires_matching_author_bearer(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            proposal_id = create_proposal("Editable proposal")
            body = {"author": "alice", "title": "Edited title", "body": "Edited body"}
            missing = client.patch(f"/proposals/{proposal_id}", json=body)
            invalid = client.patch(f"/proposals/{proposal_id}", json=body, headers=invalid_headers)
            wrong = client.patch(f"/proposals/{proposal_id}", json=body, headers=bob_headers)
            matching = client.patch(f"/proposals/{proposal_id}", json=body, headers=alice_headers)
            payload = matching.json()
            result = {
                "proposal_id": proposal_id,
                "missing_status": missing.status_code,
                "invalid_status": invalid.status_code,
                "wrong_status": wrong.status_code,
                "matching_status": matching.status_code,
                "title": payload.get("title"),
                "text": payload.get("text"),
                "stored_title": proposal_title(proposal_id),
            }
            print("PROPOSAL_WRITE_AUTH_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_proposal_auth_probe(probe)

        self.assertEqual(result["missing_status"], 401)
        self.assertEqual(result["invalid_status"], 401)
        self.assertEqual(result["wrong_status"], 403)
        self.assertEqual(result["matching_status"], 200)
        self.assertEqual(result["title"], "Edited title")
        self.assertEqual(result["text"], "Edited body")
        self.assertEqual(result["stored_title"], "Edited title")

    def test_delete_proposal_requires_matching_author_bearer(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            missing_id = create_proposal("Missing token delete")
            invalid_id = create_proposal("Invalid token delete")
            wrong_id = create_proposal("Wrong token delete")
            matching_id = create_proposal("Matching token delete")
            missing = client.delete(f"/proposals/{missing_id}?author=alice")
            invalid = client.delete(f"/proposals/{invalid_id}?author=alice", headers=invalid_headers)
            wrong = client.delete(f"/proposals/{wrong_id}?author=alice", headers=bob_headers)
            matching = client.delete(f"/proposals/{matching_id}?author=alice", headers=alice_headers)
            result = {
                "missing_status": missing.status_code,
                "invalid_status": invalid.status_code,
                "wrong_status": wrong.status_code,
                "matching_status": matching.status_code,
                "matching_payload": matching.json(),
                "missing_exists": proposal_exists(missing_id),
                "invalid_exists": proposal_exists(invalid_id),
                "wrong_exists": proposal_exists(wrong_id),
                "matching_exists": proposal_exists(matching_id),
            }
            print("PROPOSAL_WRITE_AUTH_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_proposal_auth_probe(probe)

        self.assertEqual(result["missing_status"], 401)
        self.assertEqual(result["invalid_status"], 401)
        self.assertEqual(result["wrong_status"], 403)
        self.assertEqual(result["matching_status"], 200)
        self.assertEqual(result["matching_payload"].get("ok"), True)
        self.assertGreater(result["matching_payload"].get("deleted_id", 0), 0)
        self.assertTrue(result["missing_exists"])
        self.assertTrue(result["invalid_exists"])
        self.assertTrue(result["wrong_exists"])
        self.assertFalse(result["matching_exists"])

    def test_author_can_delete_collab_posts_but_collaborator_cannot(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            pending_id = create_proposal("Pending collab delete")
            approved_id = create_proposal("Approved collab delete")
            collaborator_id = create_proposal("Collaborator cannot delete")
            add_collab(pending_id, status="pending")
            add_collab(approved_id, status="approved")
            add_collab(collaborator_id, status="approved")

            pending_delete = client.delete(f"/proposals/{pending_id}?author=alice", headers=alice_headers)
            approved_delete = client.delete(f"/proposals/{approved_id}?author=alice", headers=alice_headers)
            collaborator_delete = client.delete(f"/proposals/{collaborator_id}?author=bob", headers=bob_headers)
            result = {
                "pending_status": pending_delete.status_code,
                "approved_status": approved_delete.status_code,
                "collaborator_status": collaborator_delete.status_code,
                "pending_exists": proposal_exists(pending_id),
                "approved_exists": proposal_exists(approved_id),
                "collaborator_exists": proposal_exists(collaborator_id),
                "pending_collabs": collab_count_for(pending_id),
                "approved_collabs": collab_count_for(approved_id),
                "collaborator_collabs": collab_count_for(collaborator_id),
            }
            print("PROPOSAL_WRITE_AUTH_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_proposal_auth_probe(probe)

        self.assertEqual(result["pending_status"], 200)
        self.assertEqual(result["approved_status"], 200)
        self.assertEqual(result["collaborator_status"], 403)
        self.assertFalse(result["pending_exists"])
        self.assertFalse(result["approved_exists"])
        self.assertTrue(result["collaborator_exists"])
        self.assertEqual(result["pending_collabs"], 0)
        self.assertEqual(result["approved_collabs"], 0)
        self.assertEqual(result["collaborator_collabs"], 1)

    def test_bulk_delete_proposals_is_disabled_by_default_even_with_confirmation(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            proposal_id = create_proposal("Bulk delete disabled")
            response = client.delete("/proposals", headers={"x-confirm-delete": "yes"})
            result = {
                "status": response.status_code,
                "detail": response.json().get("detail"),
                "proposal_exists": proposal_exists(proposal_id),
            }
            print("PROPOSAL_WRITE_AUTH_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_proposal_auth_probe(probe)

        self.assertEqual(result["status"], 403)
        self.assertEqual(result["detail"], "Bulk proposal deletion is disabled")
        self.assertTrue(result["proposal_exists"])


if __name__ == "__main__":
    unittest.main()
