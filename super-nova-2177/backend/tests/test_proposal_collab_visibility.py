import datetime
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def run_probe(probe: str) -> dict:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "proposal_collab_visibility.sqlite"
        env = os.environ.copy()
        env.update(
            {
                "DATABASE_URL": f"sqlite:///{db_path.as_posix()}",
                "DB_MODE": "central",
                "SECRET_KEY": "strong-test-secret-for-proposal-collab-visibility",
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
        if line.startswith("PROPOSAL_COLLAB_VISIBILITY_RESULT=")
    ]
    if not result_lines:
        raise AssertionError(f"probe result missing\nstdout:\n{completed.stdout}")
    return json.loads(result_lines[-1].split("=", 1)[1])


PROBE = r"""
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
from db_models import Base, ProposalCollab

client = TestClient(backend_app.app)


def current_bind():
    session = backend_app.SessionLocal()
    try:
        return session.get_bind()
    finally:
        session.close()


Base.metadata.create_all(bind=current_bind())


def seed_context():
    db = backend_app.SessionLocal()
    try:
        alice = backend_app.Harmonizer(
            username="alice",
            email="alice@example.test",
            hashed_password="test",
            species="human",
            profile_pic="alice.png",
        )
        bob = backend_app.Harmonizer(
            username="bob",
            email="bob@example.test",
            hashed_password="test",
            species="ai",
            profile_pic="bob.png",
        )
        cara = backend_app.Harmonizer(
            username="cara",
            email="cara@example.test",
            hashed_password="test",
            species="company",
            profile_pic="cara.png",
        )
        dana = backend_app.Harmonizer(
            username="dana",
            email="dana@example.test",
            hashed_password="test",
            species="human",
            profile_pic="dana.png",
        )
        empty = backend_app.Harmonizer(
            username="empty",
            email="empty@example.test",
            hashed_password="test",
            species="ai",
            profile_pic="empty.png",
        )
        db.add_all([alice, bob, cara, dana, empty])
        db.commit()
        db.refresh(alice)
        db.refresh(bob)
        db.refresh(cara)
        db.refresh(dana)
        db.refresh(empty)

        alice_post = backend_app.Proposal(
            title="Alice approved collab post",
            description="Approved collab should be public.",
            userName="alice",
            userInitials="AL",
            author_type="human",
            author_id=alice.id,
            created_at=datetime.datetime(2026, 1, 2, 12, 0, 0),
            voting_deadline=datetime.datetime(2026, 1, 9, 12, 0, 0),
        )
        bob_post = backend_app.Proposal(
            title="Bob authored post",
            description="Author-only profile post.",
            userName="bob",
            userInitials="BO",
            author_type="ai",
            author_id=bob.id,
            created_at=datetime.datetime(2026, 1, 2, 12, 1, 0),
            voting_deadline=datetime.datetime(2026, 1, 9, 12, 1, 0),
        )
        cara_pending_post = backend_app.Proposal(
            title="Cara pending collab post",
            description="Pending collab should stay private.",
            userName="alice",
            userInitials="AL",
            author_type="human",
            author_id=alice.id,
            created_at=datetime.datetime(2026, 1, 2, 12, 2, 0),
            voting_deadline=datetime.datetime(2026, 1, 9, 12, 2, 0),
        )
        dana_post = backend_app.Proposal(
            title="Dana authored post",
            description="Author has no collabs but should still load.",
            userName="dana",
            userInitials="DA",
            author_type="human",
            author_id=dana.id,
            created_at=datetime.datetime(2026, 1, 2, 12, 3, 0),
            voting_deadline=datetime.datetime(2026, 1, 9, 12, 3, 0),
        )
        db.add_all([alice_post, bob_post, cara_pending_post, dana_post])
        db.commit()
        db.refresh(alice_post)
        db.refresh(bob_post)
        db.refresh(cara_pending_post)
        db.refresh(dana_post)

        db.add_all(
            [
                ProposalCollab(
                    proposal_id=alice_post.id,
                    author_user_id=alice.id,
                    collaborator_user_id=bob.id,
                    requested_by_user_id=alice.id,
                    status="approved",
                    responded_at=datetime.datetime(2026, 1, 2, 12, 10, 0),
                ),
                ProposalCollab(
                    proposal_id=alice_post.id,
                    author_user_id=alice.id,
                    collaborator_user_id=cara.id,
                    requested_by_user_id=alice.id,
                    status="pending",
                ),
                ProposalCollab(
                    proposal_id=alice_post.id,
                    author_user_id=alice.id,
                    collaborator_user_id=cara.id,
                    requested_by_user_id=alice.id,
                    status="declined",
                    responded_at=datetime.datetime(2026, 1, 2, 12, 11, 0),
                ),
                ProposalCollab(
                    proposal_id=cara_pending_post.id,
                    author_user_id=alice.id,
                    collaborator_user_id=cara.id,
                    requested_by_user_id=alice.id,
                    status="removed",
                    removed_at=datetime.datetime(2026, 1, 2, 12, 12, 0),
                ),
            ]
        )
        db.commit()
        return {
            "alice_post_id": alice_post.id,
            "bob_post_id": bob_post.id,
            "cara_pending_post_id": cara_pending_post.id,
            "dana_post_id": dana_post.id,
        }
    finally:
        db.close()


seeded = seed_context()
detail = client.get(f"/proposals/{seeded['alice_post_id']}")
bob_author_only = client.get("/proposals?filter=latest&author=bob&limit=20&offset=0")
bob_with_collabs = client.get("/proposals?filter=latest&author=bob&include_collabs=true&limit=20&offset=0")
cara_with_collabs = client.get("/proposals?filter=latest&author=cara&include_collabs=true&limit=20&offset=0")
dana_with_collabs = client.get("/proposals?filter=latest&author=dana&include_collabs=true&limit=20&offset=0")
empty_with_collabs = client.get("/proposals?filter=latest&author=empty&include_collabs=true&limit=20&offset=0")
unknown_with_collabs = client.get("/proposals?filter=latest&author=unknown&include_collabs=true&limit=20&offset=0")

print(
    "PROPOSAL_COLLAB_VISIBILITY_RESULT="
    + json.dumps(
        {
            "seeded": seeded,
            "detail_status": detail.status_code,
            "detail": detail.json(),
            "bob_author_only_status": bob_author_only.status_code,
            "bob_author_only": bob_author_only.json(),
            "bob_with_collabs_status": bob_with_collabs.status_code,
            "bob_with_collabs": bob_with_collabs.json(),
            "cara_with_collabs_status": cara_with_collabs.status_code,
            "cara_with_collabs": cara_with_collabs.json(),
            "dana_with_collabs_status": dana_with_collabs.status_code,
            "dana_with_collabs": dana_with_collabs.json(),
            "empty_with_collabs_status": empty_with_collabs.status_code,
            "empty_with_collabs": empty_with_collabs.json(),
            "unknown_with_collabs_status": unknown_with_collabs.status_code,
            "unknown_with_collabs": unknown_with_collabs.json(),
        },
        sort_keys=True,
    )
)
"""


class ProposalCollabVisibilityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.result = run_probe(PROBE)

    def test_proposal_serializes_only_approved_collabs(self):
        self.assertEqual(self.result["detail_status"], 200)
        collabs = self.result["detail"]["collabs"]
        self.assertEqual(len(collabs), 1)
        self.assertEqual(collabs[0]["username"], "bob")
        self.assertEqual(collabs[0]["status"], "approved")
        self.assertEqual(collabs[0]["species"], "ai")
        self.assertEqual(collabs[0]["avatar"], "/uploads/bob.png")

        serialized = json.dumps(self.result["detail"], sort_keys=True).lower()
        self.assertNotIn("pending", serialized)
        self.assertNotIn("declined", serialized)
        self.assertNotIn("removed", serialized)
        self.assertNotIn("cara", serialized)

    def test_profile_posts_are_author_only_without_include_collabs(self):
        self.assertEqual(self.result["bob_author_only_status"], 200)
        ids = {item["id"] for item in self.result["bob_author_only"]}
        self.assertEqual(ids, {self.result["seeded"]["bob_post_id"]})

    def test_profile_posts_include_approved_collabs_when_requested(self):
        self.assertEqual(self.result["bob_with_collabs_status"], 200)
        ids = [item["id"] for item in self.result["bob_with_collabs"]]
        self.assertIn(self.result["seeded"]["bob_post_id"], ids)
        self.assertIn(self.result["seeded"]["alice_post_id"], ids)
        self.assertEqual(len(ids), len(set(ids)))

        collab_post = next(
            item for item in self.result["bob_with_collabs"]
            if item["id"] == self.result["seeded"]["alice_post_id"]
        )
        self.assertEqual(collab_post["userName"], "alice")
        self.assertEqual(collab_post["collabs"][0]["username"], "bob")

    def test_declined_pending_removed_collabs_do_not_expand_public_profile(self):
        self.assertEqual(self.result["cara_with_collabs_status"], 200)
        ids = {item["id"] for item in self.result["cara_with_collabs"]}
        self.assertNotIn(self.result["seeded"]["alice_post_id"], ids)
        self.assertNotIn(self.result["seeded"]["cara_pending_post_id"], ids)

    def test_include_collabs_handles_profiles_without_collabs_or_posts(self):
        self.assertEqual(self.result["dana_with_collabs_status"], 200)
        dana_ids = {item["id"] for item in self.result["dana_with_collabs"]}
        self.assertEqual(dana_ids, {self.result["seeded"]["dana_post_id"]})

        self.assertEqual(self.result["empty_with_collabs_status"], 200)
        self.assertEqual(self.result["empty_with_collabs"], [])

        self.assertEqual(self.result["unknown_with_collabs_status"], 200)
        self.assertEqual(self.result["unknown_with_collabs"], [])


if __name__ == "__main__":
    unittest.main()
