import json
import os
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def run_delete_collab_probe(probe: str) -> dict:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "delete_with_collabs.sqlite"
        env = os.environ.copy()
        env.update(
            {
                "DATABASE_URL": f"sqlite:///{db_path.as_posix()}",
                "DB_MODE": "central",
                "SECRET_KEY": "strong-test-secret-for-delete-collabs",
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
        if line.startswith("DELETE_COLLAB_RESULT=")
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

project_root = Path.cwd()
backend_dir = project_root / "backend"
for path in (project_root, backend_dir):
    path_text = str(path)
    if path_text not in sys.path:
        sys.path.insert(0, path_text)

import backend.app as backend_app
from db_models import Base, ProposalCollab

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
                profile_pic="alice.png",
            ),
            backend_app.Harmonizer(
                username="bob",
                email="bob@example.test",
                hashed_password="test",
                bio="collaborator",
                species="ai",
                profile_pic="bob.png",
            ),
            backend_app.Harmonizer(
                username="cara",
                email="cara@example.test",
                hashed_password="test",
                bio="wrong user",
                species="company",
                profile_pic="cara.png",
            ),
        ]
        db.add_all(users)
        db.commit()
        return {
            "alice_id": users[0].id,
            "bob_id": users[1].id,
            "cara_id": users[2].id,
        }
    finally:
        db.close()


seeded_users = seed_users()
alice_token = backend_app._create_wrapper_access_token("alice")
bob_token = backend_app._create_wrapper_access_token("bob")
cara_token = backend_app._create_wrapper_access_token("cara")
alice_headers = {"Authorization": f"Bearer {alice_token}"}
bob_headers = {"Authorization": f"Bearer {bob_token}"}
cara_headers = {"Authorization": f"Bearer {cara_token}"}


def create_proposal(title, author="alice", author_id=None):
    db = backend_app.SessionLocal()
    try:
        author_id = author_id or seeded_users[f"{author}_id"]
        proposal = backend_app.Proposal(
            title=title,
            description=f"{title} body",
            userName=author,
            userInitials=author[:2].upper(),
            author_type="human",
            author_img=f"{author}.png",
            author_id=author_id,
            voting_deadline=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        )
        db.add(proposal)
        db.commit()
        db.refresh(proposal)
        return proposal.id
    finally:
        db.close()


def add_collab(proposal_id, status):
    db = backend_app.SessionLocal()
    try:
        collab = ProposalCollab(
            proposal_id=proposal_id,
            author_user_id=seeded_users["alice_id"],
            collaborator_user_id=seeded_users["bob_id"],
            requested_by_user_id=seeded_users["alice_id"],
            status=status,
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
        return bool(db.query(backend_app.Proposal).filter(backend_app.Proposal.id == proposal_id).first())
    finally:
        db.close()


def collab_count_for(proposal_id):
    db = backend_app.SessionLocal()
    try:
        return db.query(ProposalCollab).filter(ProposalCollab.proposal_id == proposal_id).count()
    finally:
        db.close()
"""


class DeleteWithCollabsTests(unittest.TestCase):
    def test_author_can_delete_posts_with_any_collab_status(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            statuses = ["pending", "approved", "declined", "removed"]
            proposals = {}
            collabs = {}
            deletes = {}
            exists_after = {}
            collabs_after = {}
            public_reads = {}
            for status in statuses:
                proposal_id = create_proposal(f"Delete {status} collab")
                collab_id = add_collab(proposal_id, status)
                proposals[status] = proposal_id
                collabs[status] = collab_id
                deleted = client.delete(
                    f"/proposals/{proposal_id}?author=alice",
                    headers=alice_headers,
                )
                deletes[status] = {
                    "status": deleted.status_code,
                    "payload": deleted.json(),
                }
                exists_after[status] = proposal_exists(proposal_id)
                collabs_after[status] = collab_count_for(proposal_id)
                public_reads[status] = client.get(f"/proposals/{proposal_id}").status_code

            print(
                "DELETE_COLLAB_RESULT="
                + json.dumps(
                    {
                        "proposals": proposals,
                        "collabs": collabs,
                        "deletes": deletes,
                        "exists_after": exists_after,
                        "collabs_after": collabs_after,
                        "public_reads": public_reads,
                    },
                    sort_keys=True,
                )
            )
            """
        )

        result = run_delete_collab_probe(probe)

        for status, proposal_id in result["proposals"].items():
            self.assertGreater(proposal_id, 0)
            self.assertEqual(result["deletes"][status]["status"], 200)
            self.assertEqual(result["deletes"][status]["payload"], {"deleted_id": proposal_id, "ok": True})
            self.assertFalse(result["exists_after"][status])
            self.assertEqual(result["collabs_after"][status], 0)
            self.assertEqual(result["public_reads"][status], 404)

    def test_wrong_user_and_collaborator_cannot_delete_author_post(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            proposal_id = create_proposal("Only author can delete collab post")
            add_collab(proposal_id, "approved")
            collaborator = client.delete(
                f"/proposals/{proposal_id}?author=bob",
                headers=bob_headers,
            )
            wrong_user = client.delete(
                f"/proposals/{proposal_id}?author=cara",
                headers=cara_headers,
            )
            still_exists = proposal_exists(proposal_id)
            collabs_still_exist = collab_count_for(proposal_id)

            print(
                "DELETE_COLLAB_RESULT="
                + json.dumps(
                    {
                        "proposal_id": proposal_id,
                        "collaborator_status": collaborator.status_code,
                        "wrong_user_status": wrong_user.status_code,
                        "still_exists": still_exists,
                        "collabs_still_exist": collabs_still_exist,
                    },
                    sort_keys=True,
                )
            )
            """
        )

        result = run_delete_collab_probe(probe)

        self.assertEqual(result["collaborator_status"], 403)
        self.assertEqual(result["wrong_user_status"], 403)
        self.assertTrue(result["still_exists"])
        self.assertEqual(result["collabs_still_exist"], 1)

    def test_deleted_approved_collab_post_leaves_collaborator_profile(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            proposal_id = create_proposal("Profile collab post")
            add_collab(proposal_id, "approved")
            before = client.get("/proposals?filter=latest&author=bob&include_collabs=true&limit=20&offset=0")
            deleted = client.delete(
                f"/proposals/{proposal_id}?author=alice",
                headers=alice_headers,
            )
            after = client.get("/proposals?filter=latest&author=bob&include_collabs=true&limit=20&offset=0")

            print(
                "DELETE_COLLAB_RESULT="
                + json.dumps(
                    {
                        "proposal_id": proposal_id,
                        "before_status": before.status_code,
                        "before_ids": [item["id"] for item in before.json()],
                        "delete_status": deleted.status_code,
                        "after_status": after.status_code,
                        "after_ids": [item["id"] for item in after.json()],
                    },
                    sort_keys=True,
                )
            )
            """
        )

        result = run_delete_collab_probe(probe)

        self.assertEqual(result["before_status"], 200)
        self.assertIn(result["proposal_id"], result["before_ids"])
        self.assertEqual(result["delete_status"], 200)
        self.assertEqual(result["after_status"], 200)
        self.assertNotIn(result["proposal_id"], result["after_ids"])


if __name__ == "__main__":
    unittest.main()
