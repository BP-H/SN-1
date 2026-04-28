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
        db_path = Path(tmpdir) / "proposal_embedded_caps.sqlite"
        env = os.environ.copy()
        env.update(
            {
                "DATABASE_URL": f"sqlite:///{db_path.as_posix()}",
                "DB_MODE": "central",
                "SECRET_KEY": "strong-test-secret-for-proposal-embedded-caps",
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
        if line.startswith("PROPOSAL_EMBEDDED_CAPS_RESULT=")
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


def seed_proposals(comment_count=4, vote_count=4):
    db = backend_app.SessionLocal()
    try:
        users = []
        for index in range(max(vote_count, 2)):
            users.append(
                backend_app.Harmonizer(
                    username=f"user{index:03d}",
                    email=f"user{index:03d}@example.test",
                    hashed_password="test",
                    species=("human" if index % 3 == 0 else "ai" if index % 3 == 1 else "company"),
                    profile_pic="",
                )
            )
        db.add_all(users)
        db.commit()
        for user in users:
            db.refresh(user)

        node = backend_app.VibeNode(name="proposal-embedded-caps-node", author_id=users[0].id)
        primary = backend_app.Proposal(
            title="Primary embedded caps proposal",
            description="Primary proposal for embedded payload cap tests.",
            userName="user000",
            userInitials="US",
            author_type="human",
            author_id=users[0].id,
            voting_deadline=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        )
        secondary = backend_app.Proposal(
            title="Secondary proposal",
            description="Used to confirm top-level pagination remains intact.",
            userName="user001",
            userInitials="US",
            author_type="ai",
            author_id=users[1].id,
            voting_deadline=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        )
        db.add_all([node, primary, secondary])
        db.commit()
        db.refresh(node)
        db.refresh(primary)
        db.refresh(secondary)

        comments = [
            backend_app.Comment(
                content=f"primary comment {index:03d}",
                author_id=users[index % len(users)].id,
                vibenode_id=node.id,
                proposal_id=primary.id,
                created_at=datetime.datetime(2026, 1, 1, 12, 0, 0)
                + datetime.timedelta(minutes=index),
            )
            for index in range(comment_count)
        ]
        comments.append(
            backend_app.Comment(
                content="secondary comment",
                author_id=users[1].id,
                vibenode_id=node.id,
                proposal_id=secondary.id,
                created_at=datetime.datetime(2026, 1, 2, 12, 0, 0),
            )
        )
        votes = [
            backend_app.ProposalVote(
                proposal_id=primary.id,
                harmonizer_id=users[index].id,
                vote=("up" if index % 2 == 0 else "down"),
                voter_type=getattr(users[index], "species", "human"),
            )
            for index in range(vote_count)
        ]
        votes.append(
            backend_app.ProposalVote(
                proposal_id=secondary.id,
                harmonizer_id=users[1].id,
                vote="up",
                voter_type=getattr(users[1], "species", "ai"),
            )
        )
        db.add_all(comments + votes)
        db.commit()
        return {
            "primary_id": primary.id,
            "secondary_id": secondary.id,
        }
    finally:
        db.close()
"""


class ProposalEmbeddedCapsTests(unittest.TestCase):
    def test_proposals_without_embedded_caps_keep_full_shape(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            seed_proposals(comment_count=4, vote_count=4)
            response = client.get("/proposals?filter=latest&author=user000&limit=10")
            payload = response.json()
            proposal = payload[0]
            result = {
                "status_code": response.status_code,
                "count": len(payload),
                "comment_count": len(proposal.get("comments", [])),
                "like_count": len(proposal.get("likes", [])),
                "dislike_count": len(proposal.get("dislikes", [])),
                "comment_texts": [item.get("comment") for item in proposal.get("comments", [])],
                "proposal_keys": sorted(proposal.keys()),
            }
            print("PROPOSAL_EMBEDDED_CAPS_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_probe(probe)

        self.assertEqual(result["status_code"], 200)
        self.assertEqual(result["count"], 1)
        self.assertEqual(result["comment_count"], 4)
        self.assertEqual(result["like_count"], 2)
        self.assertEqual(result["dislike_count"], 2)
        self.assertEqual(
            result["comment_texts"],
            [
                "primary comment 000",
                "primary comment 001",
                "primary comment 002",
                "primary comment 003",
            ],
        )
        self.assertIn("comments", result["proposal_keys"])
        self.assertIn("likes", result["proposal_keys"])
        self.assertIn("dislikes", result["proposal_keys"])

    def test_proposals_embedded_comments_limit_caps_comments_only(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            seed_proposals(comment_count=4, vote_count=4)
            response = client.get(
                "/proposals?filter=latest&author=user000&limit=10&embedded_comments_limit=2"
            )
            proposal = response.json()[0]
            result = {
                "status_code": response.status_code,
                "comment_count": len(proposal.get("comments", [])),
                "comment_texts": [item.get("comment") for item in proposal.get("comments", [])],
                "like_count": len(proposal.get("likes", [])),
                "dislike_count": len(proposal.get("dislikes", [])),
            }
            print("PROPOSAL_EMBEDDED_CAPS_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_probe(probe)

        self.assertEqual(result["status_code"], 200)
        self.assertEqual(result["comment_count"], 2)
        self.assertEqual(result["comment_texts"], ["primary comment 000", "primary comment 001"])
        self.assertEqual(result["like_count"], 2)
        self.assertEqual(result["dislike_count"], 2)

    def test_proposals_embedded_votes_limit_caps_vote_payload(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            seed_proposals(comment_count=4, vote_count=4)
            response = client.get(
                "/proposals?filter=latest&author=user000&limit=10&embedded_votes_limit=2"
            )
            proposal = response.json()[0]
            result = {
                "status_code": response.status_code,
                "comment_count": len(proposal.get("comments", [])),
                "like_count": len(proposal.get("likes", [])),
                "dislike_count": len(proposal.get("dislikes", [])),
                "like_voters": [item.get("voter") for item in proposal.get("likes", [])],
                "dislike_voters": [item.get("voter") for item in proposal.get("dislikes", [])],
            }
            print("PROPOSAL_EMBEDDED_CAPS_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_probe(probe)

        self.assertEqual(result["status_code"], 200)
        self.assertEqual(result["comment_count"], 4)
        self.assertEqual(result["like_count"], 1)
        self.assertEqual(result["dislike_count"], 1)
        self.assertEqual(result["like_voters"], ["user000"])
        self.assertEqual(result["dislike_voters"], ["user001"])

    def test_proposals_both_caps_and_zero_caps_work(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            seed_proposals(comment_count=4, vote_count=4)
            capped = client.get(
                "/proposals?filter=latest&author=user000&limit=10&embedded_comments_limit=2&embedded_votes_limit=2"
            ).json()[0]
            zero = client.get(
                "/proposals?filter=latest&author=user000&limit=10&embedded_comments_limit=0&embedded_votes_limit=0"
            ).json()[0]
            result = {
                "capped_comments": len(capped.get("comments", [])),
                "capped_votes": len(capped.get("likes", [])) + len(capped.get("dislikes", [])),
                "zero_keys": sorted(zero.keys()),
                "zero_comments": len(zero.get("comments", [])),
                "zero_votes": len(zero.get("likes", [])) + len(zero.get("dislikes", [])),
            }
            print("PROPOSAL_EMBEDDED_CAPS_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_probe(probe)

        self.assertEqual(result["capped_comments"], 2)
        self.assertEqual(result["capped_votes"], 2)
        self.assertIn("comments", result["zero_keys"])
        self.assertIn("likes", result["zero_keys"])
        self.assertIn("dislikes", result["zero_keys"])
        self.assertEqual(result["zero_comments"], 0)
        self.assertEqual(result["zero_votes"], 0)

    def test_proposals_excessive_caps_are_clamped(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            seed_proposals(comment_count=505, vote_count=505)
            response = client.get(
                "/proposals?filter=latest&author=user000&limit=10&embedded_comments_limit=9999&embedded_votes_limit=9999"
            )
            proposal = response.json()[0]
            result = {
                "status_code": response.status_code,
                "comment_count": len(proposal.get("comments", [])),
                "vote_count": len(proposal.get("likes", [])) + len(proposal.get("dislikes", [])),
            }
            print("PROPOSAL_EMBEDDED_CAPS_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_probe(probe)

        self.assertEqual(result["status_code"], 200)
        self.assertEqual(result["comment_count"], 500)
        self.assertEqual(result["vote_count"], 500)

    def test_proposals_invalid_caps_reject_and_top_level_pagination_remains(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            seed_proposals(comment_count=4, vote_count=4)
            invalid_comments = client.get(
                "/proposals?embedded_comments_limit=not-an-int"
            )
            invalid_votes = client.get(
                "/proposals?embedded_votes_limit=not-an-int"
            )
            top_level = client.get("/proposals?filter=all&limit=1&offset=1")
            result = {
                "invalid_comments_status": invalid_comments.status_code,
                "invalid_votes_status": invalid_votes.status_code,
                "top_level_status": top_level.status_code,
                "top_level_count": len(top_level.json()),
                "top_level_keys": sorted(top_level.json()[0].keys()),
            }
            print("PROPOSAL_EMBEDDED_CAPS_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_probe(probe)

        self.assertEqual(result["invalid_comments_status"], 422)
        self.assertEqual(result["invalid_votes_status"], 422)
        self.assertEqual(result["top_level_status"], 200)
        self.assertEqual(result["top_level_count"], 1)
        self.assertIn("comments", result["top_level_keys"])
        self.assertIn("likes", result["top_level_keys"])
        self.assertIn("dislikes", result["top_level_keys"])


if __name__ == "__main__":
    unittest.main()
