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


def run_probe(probe: str) -> dict:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "public_gpt_connector.sqlite"
        env = os.environ.copy()
        env.update(
            {
                "DATABASE_URL": f"sqlite:///{db_path.as_posix()}",
                "DB_MODE": "central",
                "SECRET_KEY": "strong-test-secret-for-public-gpt-connector",
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
        if line.startswith("PUBLIC_GPT_CONNECTOR_RESULT=")
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
from db_models import Base, Notification, ProposalCollab

client = TestClient(backend_app.app)


def current_bind():
    session = backend_app.SessionLocal()
    try:
        return session.get_bind()
    finally:
        session.close()


Base.metadata.create_all(bind=current_bind())


def seed_public_context():
    db = backend_app.SessionLocal()
    try:
        alice = backend_app.Harmonizer(
            username="alice",
            email="alice@example.test",
            hashed_password="test",
            species="human",
            bio="Public Alice bio",
            profile_pic="alice.png",
        )
        bob = backend_app.Harmonizer(
            username="bob",
            email="bob@example.test",
            hashed_password="test",
            species="ai",
            bio="Public Bob bio",
            profile_pic="bob.png",
        )
        cara = backend_app.Harmonizer(
            username="cara",
            email="cara@example.test",
            hashed_password="test",
            species="company",
            bio="Public Cara bio",
            profile_pic="cara.png",
        )
        db.add_all([alice, bob, cara])
        db.commit()
        db.refresh(alice)
        db.refresh(bob)
        db.refresh(cara)

        node = backend_app.VibeNode(name="connector-node", author_id=alice.id)
        primary = backend_app.Proposal(
            title="Connector Public Proposal",
            description="Public connector body mentioning @bob.",
            userName="alice",
            userInitials="AL",
            author_type="human",
            author_id=alice.id,
            image="connector-image.png",
            voting_deadline=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        )
        other = backend_app.Proposal(
            title="Other Public Proposal",
            description="Other public body.",
            userName="bob",
            userInitials="BO",
            author_type="ai",
            author_id=bob.id,
            voting_deadline=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        )
        db.add_all([node, primary, other])
        db.commit()
        db.refresh(node)
        db.refresh(primary)
        db.refresh(other)

        db.add_all(
            [
                backend_app.Comment(
                    content="first public connector comment",
                    author_id=bob.id,
                    vibenode_id=node.id,
                    proposal_id=primary.id,
                    created_at=datetime.datetime(2026, 1, 1, 12, 0, 0),
                ),
                backend_app.Comment(
                    content="second public connector comment",
                    author_id=alice.id,
                    vibenode_id=node.id,
                    proposal_id=primary.id,
                    created_at=datetime.datetime(2026, 1, 1, 12, 1, 0),
                ),
                backend_app.Comment(
                    content="other proposal comment should not leak",
                    author_id=alice.id,
                    vibenode_id=node.id,
                    proposal_id=other.id,
                    created_at=datetime.datetime(2026, 1, 1, 12, 2, 0),
                ),
                backend_app.ProposalVote(
                    proposal_id=primary.id,
                    harmonizer_id=bob.id,
                    vote="up",
                    voter_type="ai",
                ),
                backend_app.ProposalVote(
                    proposal_id=primary.id,
                    harmonizer_id=alice.id,
                    vote="down",
                    voter_type="human",
                ),
                Notification(
                    harmonizer_id=alice.id,
                    message="PRIVATE_NOTIFICATION_SENTINEL",
                ),
                ProposalCollab(
                    proposal_id=primary.id,
                    author_user_id=alice.id,
                    collaborator_user_id=bob.id,
                    requested_by_user_id=alice.id,
                    status="approved",
                    responded_at=datetime.datetime(2026, 1, 1, 12, 3, 0),
                ),
                ProposalCollab(
                    proposal_id=primary.id,
                    author_user_id=alice.id,
                    collaborator_user_id=cara.id,
                    requested_by_user_id=alice.id,
                    status="pending",
                ),
            ]
        )
        db.commit()
        return {"primary_id": primary.id, "other_id": other.id}
    finally:
        db.close()


seeded = seed_public_context()
discovery = client.get("/connector/supernova")
spec = client.get("/connector/supernova/spec")
proposal_list = client.get("/connector/proposals?search=Connector&limit=10&offset=0")
proposal_detail = client.get(f"/connector/proposals/{seeded['primary_id']}")
proposal_votes = client.get(f"/connector/proposals/{seeded['primary_id']}/votes")
comments = client.get(f"/connector/proposals/{seeded['primary_id']}/comments?limit=1&offset=1")
profile = client.get("/connector/profiles/alice")
missing_profile = client.get("/connector/profiles/missing-user")
write_attempt = client.post("/connector/proposals", json={"title": "no writes"})

result = {
    "discovery_status": discovery.status_code,
    "discovery": discovery.json(),
    "spec_status": spec.status_code,
    "spec": spec.json(),
    "list_status": proposal_list.status_code,
    "list": proposal_list.json(),
    "detail_status": proposal_detail.status_code,
    "detail": proposal_detail.json(),
    "votes_status": proposal_votes.status_code,
    "votes": proposal_votes.json(),
    "comments_status": comments.status_code,
    "comments": comments.json(),
    "profile_status": profile.status_code,
    "profile": profile.json(),
    "missing_profile_status": missing_profile.status_code,
    "write_attempt_status": write_attempt.status_code,
}
print("PUBLIC_GPT_CONNECTOR_RESULT=" + json.dumps(result, sort_keys=True))
"""


class PublicGptConnectorFacadeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.result = run_probe(PROBE)

    def test_discovery_endpoint_is_public_read_only_without_write_tools(self):
        discovery = self.result["discovery"]
        self.assertEqual(self.result["discovery_status"], 200)
        self.assertEqual(discovery["name"], "SuperNova")
        self.assertEqual(discovery["mode"], "public_read_only")
        self.assertFalse(discovery["write_tools_enabled"])
        self.assertFalse(discovery["private_user_state_exposed"])
        self.assertEqual(discovery["action_tools"], [])
        self.assertTrue(discovery["safety"]["read_only"])
        self.assertIn("profiles", discovery["resources"])
        self.assertIn("proposals", discovery["resources"])
        self.assertIn("comments", discovery["resources"])
        self.assertEqual(discovery["endpoints"]["spec"], "/connector/supernova/spec")
        self.assertEqual(discovery["endpoints"]["proposal_votes"], "/connector/proposals/{id}/votes")

    def test_spec_endpoint_describes_public_read_only_facade(self):
        self.assertEqual(self.result["spec_status"], 200)
        spec = self.result["spec"]
        self.assertEqual(spec["name"], "SuperNova")
        self.assertEqual(spec["mode"], "public_read_only")
        self.assertTrue(spec["base_url"].startswith("http"))
        self.assertFalse(spec["write_tools_enabled"])
        self.assertFalse(spec["private_user_state_exposed"])
        self.assertEqual(spec["action_tools"], [])
        self.assertTrue(spec["safety"]["public_only"])
        self.assertTrue(spec["safety"]["read_only"])
        self.assertFalse(spec["safety"]["requires_auth"])
        self.assertTrue(spec["safety"]["no_writes"])
        self.assertTrue(spec["safety"]["no_private_notifications"])
        self.assertTrue(spec["safety"]["no_pending_collab_requests"])
        self.assertTrue(spec["safety"]["no_protected_core_internals"])

        self.assertEqual(spec["endpoints"]["proposals"], "/connector/proposals")
        self.assertEqual(spec["endpoints"]["proposal"], "/connector/proposals/{id}")
        self.assertEqual(spec["endpoints"]["proposal_comments"], "/connector/proposals/{id}/comments")
        self.assertEqual(spec["endpoints"]["proposal_votes"], "/connector/proposals/{id}/votes")
        self.assertEqual(spec["endpoints"]["profile"], "/connector/profiles/{username}")
        self.assertIn("search", spec["parameters"])
        self.assertIn("limit", spec["parameters"])
        self.assertIn("offset", spec["parameters"])
        self.assertIn("profiles", spec["resources"])
        self.assertIn("proposals", spec["resources"])
        self.assertIn("comments", spec["resources"])
        self.assertIn("vote_summaries", spec["resources"])

    def test_spec_endpoint_does_not_expose_runtime_or_private_fields(self):
        spec_text = json.dumps(self.result["spec"], sort_keys=True).lower()
        forbidden = [
            "private_notification_sentinel",
            "alice@example.test",
            "hashed_password",
            "secret_key",
            "database_url",
            "sys.path",
            "os.getcwd",
            "filesystem",
            "oauth",
            "access_token",
            "cookie",
        ]
        for value in forbidden:
            self.assertNotIn(value, spec_text)

    def test_connector_proposal_list_and_detail_return_compact_public_data(self):
        self.assertEqual(self.result["list_status"], 200)
        items = self.result["list"]["items"]
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["title"], "Connector Public Proposal")
        self.assertEqual(items[0]["author"]["username"], "alice")
        self.assertEqual(
            items[0]["vote_summary"],
            {"approval_ratio": 0.5, "down": 1, "oppose": 1, "support": 1, "total": 2, "up": 1},
        )
        self.assertEqual(items[0]["collabs"][0]["username"], "bob")
        self.assertEqual(items[0]["collabs"][0]["status"], "approved")
        self.assertTrue(items[0]["web_url"].endswith(f"/proposals/{items[0]['id']}"))
        self.assertNotIn("comments", items[0])
        self.assertNotIn("likes", items[0])
        self.assertNotIn("dislikes", items[0])

        self.assertEqual(self.result["detail_status"], 200)
        detail = self.result["detail"]["item"]
        self.assertEqual(detail["id"], items[0]["id"])
        self.assertEqual(detail["text"], "Public connector body mentioning @bob.")
        self.assertEqual(detail["media"]["image"], "/uploads/connector-image.png")
        self.assertEqual(detail["collabs"][0]["username"], "bob")

    def test_connector_vote_summary_endpoint_returns_public_aggregate_only(self):
        self.assertEqual(self.result["votes_status"], 200)
        votes = self.result["votes"]
        self.assertEqual(votes["mode"], "public_read_only")
        self.assertEqual(votes["resource"], "proposal_vote_summary")
        self.assertEqual(
            votes["vote_summary"],
            {"approval_ratio": 0.5, "down": 1, "oppose": 1, "support": 1, "total": 2, "up": 1},
        )

        votes_text = json.dumps(votes, sort_keys=True).lower()
        self.assertNotIn("alice@example.test", votes_text)
        self.assertNotIn("bob@example.test", votes_text)
        self.assertNotIn("token", votes_text)

    def test_connector_comments_are_limited_to_public_proposal_comments(self):
        self.assertEqual(self.result["comments_status"], 200)
        comments = self.result["comments"]
        self.assertEqual(comments["mode"], "public_read_only")
        self.assertEqual(comments["limit"], 1)
        self.assertEqual(comments["offset"], 1)
        self.assertEqual(len(comments["items"]), 1)
        self.assertEqual(comments["items"][0]["comment"], "second public connector comment")
        self.assertNotIn("other proposal comment should not leak", json.dumps(comments))

    def test_connector_profile_returns_public_profile_without_private_fields(self):
        self.assertEqual(self.result["profile_status"], 200)
        profile = self.result["profile"]["item"]
        self.assertEqual(profile["username"], "alice")
        self.assertEqual(profile["bio"], "Public Alice bio")
        self.assertEqual(profile["species"], "human")
        self.assertEqual(profile["avatar_url"], "/uploads/alice.png")
        self.assertTrue(profile["web_url"].endswith("/users/alice"))
        self.assertEqual(self.result["missing_profile_status"], 404)

        profile_text = json.dumps(profile)
        self.assertNotIn("alice@example.test", profile_text)
        self.assertNotIn("hashed_password", profile_text)
        self.assertNotIn("PRIVATE_NOTIFICATION_SENTINEL", profile_text)

    def test_connector_facade_does_not_expose_private_or_pending_collab_state(self):
        combined = json.dumps(
            {
                "list": self.result["list"],
                "detail": self.result["detail"],
                "comments": self.result["comments"],
                "profile": self.result["profile"],
            },
            sort_keys=True,
        )
        self.assertNotIn("PRIVATE_NOTIFICATION_SENTINEL", combined)
        self.assertNotIn("pending", combined.lower())
        self.assertNotIn("cara", combined.lower())
        self.assertNotIn("email", combined.lower())
        self.assertNotIn("token", combined.lower())
        self.assertIn(self.result["write_attempt_status"], (405, 404))


if __name__ == "__main__":
    unittest.main()
