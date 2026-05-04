import json
import os
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path

from fastapi.testclient import TestClient


ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
for path in (ROOT, BACKEND_DIR):
    path_str = str(path)
    if path_str not in sys.path:
        sys.path.insert(0, path_str)

import backend.app as backend_app  # noqa: E402


client = TestClient(backend_app.app)


def run_comment_snapshot_probe(probe: str) -> dict:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "comment_route_snapshots.sqlite"
        env = os.environ.copy()
        env.update(
            {
                "DATABASE_URL": f"sqlite:///{db_path.as_posix()}",
                "DB_MODE": "central",
                "SECRET_KEY": "strong-test-secret-for-comment-route-snapshots",
                "SUPERNOVA_ENV": "development",
                "APP_ENV": "development",
                "ENV": "development",
                "UPLOADS_DIR": str(Path(tmpdir) / "uploads"),
            }
        )
        env.pop("RAILWAY_ENVIRONMENT", None)

        completed = subprocess.run(
            [sys.executable, "-c", probe],
            cwd=ROOT,
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
        if line.startswith("COMMENT_ROUTE_SNAPSHOT_RESULT=")
    ]
    if not result_lines:
        raise AssertionError(f"probe result missing\nstdout:\n{completed.stdout}")
    return json.loads(result_lines[-1].split("=", 1)[1])


COMMENT_SNAPSHOT_PROBE = textwrap.dedent(
    """
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
            species="human",
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
        db.refresh(alice)
        db.refresh(bob)
        proposal = backend_app.Proposal(
            title="Comment route snapshot",
            description="Snapshot target for comment route extraction.",
            userName="bob",
            userInitials="BO",
            author_type="human",
            author_id=bob.id,
            voting_deadline=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        )
        db.add(proposal)
        db.commit()
        db.refresh(proposal)
        proposal_id = proposal.id
    finally:
        db.close()

    alice_headers = {"Authorization": f"Bearer {backend_app._create_wrapper_access_token('alice')}"}
    bob_headers = {"Authorization": f"Bearer {backend_app._create_wrapper_access_token('bob')}"}
    cara_headers = {"Authorization": f"Bearer {backend_app._create_wrapper_access_token('cara')}"}

    create_body = {
        "proposal_id": proposal_id,
        "user": "alice",
        "species": "human",
        "comment": "Snapshot comment about public reply behavior.",
    }
    created = client.post("/comments", json=create_body, headers=alice_headers)
    created_payload = created.json()
    comment_id = created_payload.get("comments", [{}])[0].get("id")
    reply = client.post(
        "/comments",
        json={
            "proposal_id": proposal_id,
            "user": "alice",
            "species": "human",
            "comment": "Snapshot reply that should keep its parent.",
            "parent_comment_id": comment_id,
        },
        headers=alice_headers,
    )
    list_response = client.get(f"/comments?proposal_id={proposal_id}&limit=10&offset=0")
    connector_response = client.get(f"/connector/proposals/{proposal_id}/comments?limit=10&offset=0")
    missing_connector = client.get("/connector/proposals/987654321/comments")
    wrong_edit = client.patch(
        f"/comments/{comment_id}",
        json={"user": "alice", "comment": "wrong edit"},
        headers=cara_headers,
    )
    edit = client.patch(
        f"/comments/{comment_id}",
        json={"user": "alice", "comment": "edited snapshot comment"},
        headers=alice_headers,
    )
    owner_delete = client.delete(f"/comments/{comment_id}?user=bob", headers=bob_headers)
    upvote = client.post(
        f"/comments/{comment_id}/votes",
        json={"username": "bob", "choice": "up", "voter_type": "human"},
        headers=bob_headers,
    )
    downvote = client.post(
        f"/comments/{comment_id}/votes",
        json={"username": "bob", "choice": "down", "voter_type": "human"},
        headers=bob_headers,
    )
    remove_vote = client.delete(f"/comments/{comment_id}/votes?username=bob", headers=bob_headers)
    wrong_delete = client.delete(f"/comments/{comment_id}?user=alice", headers=cara_headers)
    delete = client.delete(f"/comments/{comment_id}?user=alice", headers=alice_headers)
    after_delete = client.get(f"/comments?proposal_id={proposal_id}&limit=10&offset=0")

    list_payload = list_response.json()
    connector_payload = connector_response.json()
    result = {
        "created_status": created.status_code,
        "created_keys": sorted(created_payload.keys()),
        "created_comment_keys": sorted(created_payload.get("comments", [{}])[0].keys()),
        "comment_id": comment_id,
        "reply_status": reply.status_code,
        "reply_parent": reply.json().get("comments", [{}])[0].get("parent_comment_id"),
        "list_status": list_response.status_code,
        "list_count": len(list_payload),
        "list_first_keys": sorted(list_payload[0].keys()) if list_payload else [],
        "connector_status": connector_response.status_code,
        "connector_keys": sorted(connector_payload.keys()),
        "connector_item_keys": sorted(connector_payload.get("items", [{}])[0].keys()),
        "connector_resource": connector_payload.get("resource"),
        "missing_connector_status": missing_connector.status_code,
        "wrong_edit_status": wrong_edit.status_code,
        "edit_status": edit.status_code,
        "edit_comment": edit.json().get("comment"),
        "owner_delete_status": owner_delete.status_code,
        "owner_delete_detail": owner_delete.json().get("detail"),
        "upvote_status": upvote.status_code,
        "upvote_likes": upvote.json().get("likes"),
        "downvote_status": downvote.status_code,
        "downvote_dislikes": downvote.json().get("dislikes"),
        "remove_vote_status": remove_vote.status_code,
        "remove_vote_likes": remove_vote.json().get("likes"),
        "remove_vote_dislikes": remove_vote.json().get("dislikes"),
        "wrong_delete_status": wrong_delete.status_code,
        "delete_status": delete.status_code,
        "delete_tombstone": delete.json().get("tombstone"),
        "after_delete_status": after_delete.status_code,
        "after_delete_count": len(after_delete.json()),
        "after_delete_first_deleted": after_delete.json()[0].get("deleted") if after_delete.json() else None,
    }
    print("COMMENT_ROUTE_SNAPSHOT_RESULT=" + json.dumps(result, sort_keys=True))
    """
)


class CommentRoutesExtractionTests(unittest.TestCase):
    def test_comment_routes_are_registered_from_dedicated_router(self):
        app_text = (BACKEND_DIR / "app.py").read_text(encoding="utf-8")
        module_text = (BACKEND_DIR / "routers" / "comments.py").read_text(encoding="utf-8")

        self.assertIn("from .routers.comments import create_comments_router", app_text)
        self.assertIn("app.include_router(create_comments_router(", app_text)
        for app_decorator in [
            '@app.get("/comments"',
            '@app.post("/comments"',
            '@app.patch("/comments/{comment_id}"',
            '@app.delete("/comments/{comment_id}"',
            '@app.post("/comments/{comment_id}/votes"',
            '@app.delete("/comments/{comment_id}/votes"',
            '@app.get("/connector/proposals/{proposal_id}/comments"',
        ]:
            self.assertNotIn(app_decorator, app_text)

        for path in [
            '"/comments"',
            '"/comments/{comment_id}"',
            '"/comments/{comment_id}/votes"',
            '"/connector/proposals/{proposal_id}/comments"',
        ]:
            self.assertIn(f"router.add_api_route(\n        {path}", module_text)

        registered = {}
        expected = {
            "/comments": {"GET", "POST"},
            "/comments/{comment_id}": {"PATCH", "DELETE"},
            "/comments/{comment_id}/votes": {"POST", "DELETE"},
            "/connector/proposals/{proposal_id}/comments": {"GET"},
        }
        for route in backend_app.app.routes:
            path = getattr(route, "path", "")
            if path in expected:
                registered.setdefault(path, set()).update(getattr(route, "methods", set()) or set())

        self.assertEqual({path: expected[path] for path in expected}, registered)

    def test_proposal_and_vote_routes_are_not_in_comment_router(self):
        module_text = (BACKEND_DIR / "routers" / "comments.py").read_text(encoding="utf-8")

        for route_fragment in [
            '"/proposals"',
            '"/proposals/{pid}"',
            '"/system-vote"',
            '"/decide/{pid}"',
            '"/runs"',
            '"/connector/actions"',
        ]:
            self.assertNotIn(route_fragment, module_text)

    def test_comment_route_response_snapshots_cover_core_contract(self):
        result = run_comment_snapshot_probe(COMMENT_SNAPSHOT_PROBE)

        self.assertEqual(result["created_status"], 200)
        self.assertEqual(set(result["created_keys"]), {"comments", "ok", "species"})
        self.assertEqual(
            set(result["created_comment_keys"]),
            {
                "comment",
                "created_at",
                "deleted",
                "dislikes",
                "id",
                "likes",
                "parent_comment_id",
                "proposal_id",
                "species",
                "user",
                "user_img",
            },
        )
        self.assertEqual(result["reply_status"], 200)
        self.assertEqual(result["reply_parent"], result["comment_id"])
        self.assertEqual(result["list_status"], 200)
        self.assertGreaterEqual(result["list_count"], 2)
        self.assertIn("likes", result["list_first_keys"])
        self.assertIn("dislikes", result["list_first_keys"])
        self.assertEqual(result["connector_status"], 200)
        self.assertEqual(result["connector_resource"], "comments")
        self.assertEqual(
            set(result["connector_keys"]),
            {"items", "limit", "mode", "offset", "proposal_id", "resource"},
        )
        self.assertIn("comment", result["connector_item_keys"])
        self.assertEqual(result["missing_connector_status"], 404)
        self.assertEqual(result["wrong_edit_status"], 403)
        self.assertEqual(result["edit_status"], 200)
        self.assertEqual(result["edit_comment"], "edited snapshot comment")
        self.assertEqual(result["owner_delete_status"], 403)
        self.assertIn("original comment author", result["owner_delete_detail"])
        self.assertEqual(result["upvote_status"], 200)
        self.assertEqual(len(result["upvote_likes"]), 1)
        self.assertEqual(result["downvote_status"], 200)
        self.assertEqual(len(result["downvote_dislikes"]), 1)
        self.assertEqual(result["remove_vote_status"], 200)
        self.assertEqual(result["remove_vote_likes"], [])
        self.assertEqual(result["remove_vote_dislikes"], [])
        self.assertEqual(result["wrong_delete_status"], 403)
        self.assertEqual(result["delete_status"], 200)
        self.assertEqual(result["delete_tombstone"], True)
        self.assertEqual(result["after_delete_status"], 200)
        self.assertGreaterEqual(result["after_delete_count"], 2)
        self.assertEqual(result["after_delete_first_deleted"], True)


if __name__ == "__main__":
    unittest.main()
