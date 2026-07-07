import json
import os
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def run_m2_probe(probe: str, extra_env=None) -> dict:
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
        db_path = Path(tmpdir) / "m2_feed_read_overhaul.sqlite"
        env = os.environ.copy()
        env.update(
            {
                "DATABASE_URL": f"sqlite:///{db_path.as_posix()}",
                "DB_MODE": "central",
                "SECRET_KEY": "strong-test-secret-for-m2-feed-read",
                "SUPERNOVA_ENV": "development",
                "APP_ENV": "development",
                "ENV": "development",
                "UPLOADS_DIR": str(Path(tmpdir) / "uploads"),
            }
        )
        env.update(extra_env or {})
        env.pop("RAILWAY_ENVIRONMENT", None)
        completed = subprocess.run(
            [sys.executable, "-c", probe],
            cwd=PROJECT_ROOT,
            env=env,
            capture_output=True,
            text=True,
            timeout=180,
            check=False,
        )

    if completed.returncode != 0:
        raise AssertionError(
            f"probe failed\nstdout:\n{completed.stdout}\nstderr:\n{completed.stderr}"
        )
    result_lines = [
        line
        for line in completed.stdout.splitlines()
        if line.startswith("M2_FEED_READ_RESULT=")
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


def seed_engagement_world():
    db = backend_app.SessionLocal()
    try:
        users = {}
        for username, species in (
            ("alice", "human"),
            ("bob", "ai"),
            ("carol", "human"),
            ("dana", "company"),
            ("erin", "human"),
        ):
            user = backend_app.Harmonizer(
                username=username,
                email=f"{username}@example.test",
                hashed_password="test",
                species=species,
                profile_pic="default.jpg",
            )
            db.add(user)
            users[username] = user
        db.commit()
        for user in users.values():
            db.refresh(user)

        vibenode = backend_app.VibeNode(name="default", author_id=users["alice"].id)
        db.add(vibenode)
        db.commit()
        db.refresh(vibenode)

        now = datetime.datetime.utcnow()
        proposals = {}
        for key, minutes_ago in (("p3", 30), ("p2", 20), ("p1", 10)):
            proposal = backend_app.Proposal(
                title=f"Engagement fixture {key}",
                description=f"Body for {key}.",
                userName="alice",
                userInitials="AL",
                author_type="human",
                author_id=users["alice"].id,
                created_at=now - datetime.timedelta(minutes=minutes_ago),
                voting_deadline=now + datetime.timedelta(days=7),
            )
            db.add(proposal)
            proposals[key] = proposal
        db.commit()
        for proposal in proposals.values():
            db.refresh(proposal)

        votes = (
            (proposals["p1"].id, users["bob"].id, "up", "ai"),
            (proposals["p1"].id, users["carol"].id, "up", "human"),
            (proposals["p1"].id, users["dana"].id, "up", "company"),
            (proposals["p1"].id, users["erin"].id, "down", "human"),
            (proposals["p2"].id, users["bob"].id, "up", "ai"),
        )
        for proposal_id, harmonizer_id, vote, voter_type in votes:
            db.add(
                backend_app.ProposalVote(
                    proposal_id=proposal_id,
                    harmonizer_id=harmonizer_id,
                    vote=vote,
                    voter_type=voter_type,
                )
            )

        comments = (
            (proposals["p1"].id, users["bob"].id, "First visible comment."),
            (proposals["p1"].id, users["carol"].id, "Second visible comment."),
            (proposals["p1"].id, users["erin"].id, backend_app.DELETED_COMMENT_TEXT),
            (proposals["p2"].id, users["carol"].id, "Only comment on p2."),
        )
        for proposal_id, author_id, content in comments:
            db.add(
                backend_app.Comment(
                    content=content,
                    author_id=author_id,
                    vibenode_id=vibenode.id,
                    proposal_id=proposal_id,
                    created_at=now,
                )
            )
        db.commit()
        return {key: proposal.id for key, proposal in proposals.items()}
    finally:
        db.close()


def feed_entry(feed, proposal_id):
    for item in feed:
        if item.get("id") == proposal_id:
            return item
    raise AssertionError(f"proposal {proposal_id} missing from feed")
"""


class M2AdditiveCountsTests(unittest.TestCase):
    def test_counts_are_additive_true_totals_under_caps_and_on_single_read(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            ids = seed_engagement_world()
            uncapped = client.get("/proposals?filter=latest&limit=10").json()
            capped = client.get(
                "/proposals?filter=latest&limit=10"
                "&embedded_comments_limit=1&embedded_votes_limit=2"
            ).json()
            single = client.get(f"/proposals/{ids['p1']}").json()

            def summary(entry):
                return {
                    "like_count": entry.get("like_count"),
                    "dislike_count": entry.get("dislike_count"),
                    "comment_count": entry.get("comment_count"),
                    "likes_len": len(entry.get("likes") or []),
                    "dislikes_len": len(entry.get("dislikes") or []),
                    "comments_len": len(entry.get("comments") or []),
                }

            result = {
                "order": [entry["id"] for entry in uncapped],
                "ids": ids,
                "uncapped_p1": summary(feed_entry(uncapped, ids["p1"])),
                "uncapped_p2": summary(feed_entry(uncapped, ids["p2"])),
                "uncapped_p3": summary(feed_entry(uncapped, ids["p3"])),
                "capped_p1": summary(feed_entry(capped, ids["p1"])),
                "single_p1": summary(single),
            }
            print("M2_FEED_READ_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_m2_probe(probe)

        self.assertEqual(
            result["order"],
            [result["ids"]["p1"], result["ids"]["p2"], result["ids"]["p3"]],
        )
        # Uncapped: counts equal the embedded array lengths, except that
        # comment_count excludes the deleted-comment sentinel while the
        # comments array still carries the deleted placeholder record.
        self.assertEqual(
            result["uncapped_p1"],
            {
                "like_count": 3,
                "dislike_count": 1,
                "comment_count": 2,
                "likes_len": 3,
                "dislikes_len": 1,
                "comments_len": 3,
            },
        )
        self.assertEqual(
            result["uncapped_p2"],
            {
                "like_count": 1,
                "dislike_count": 0,
                "comment_count": 1,
                "likes_len": 1,
                "dislikes_len": 0,
                "comments_len": 1,
            },
        )
        self.assertEqual(
            result["uncapped_p3"],
            {
                "like_count": 0,
                "dislike_count": 0,
                "comment_count": 0,
                "likes_len": 0,
                "dislikes_len": 0,
                "comments_len": 0,
            },
        )
        # Capped: embedded arrays shrink but counts keep the true totals.
        self.assertEqual(result["capped_p1"]["like_count"], 3)
        self.assertEqual(result["capped_p1"]["dislike_count"], 1)
        self.assertEqual(result["capped_p1"]["comment_count"], 2)
        self.assertEqual(
            result["capped_p1"]["likes_len"] + result["capped_p1"]["dislikes_len"], 2
        )
        self.assertEqual(result["capped_p1"]["comments_len"], 1)
        # Single-proposal read carries the same additive fields.
        self.assertEqual(result["single_p1"]["like_count"], 3)
        self.assertEqual(result["single_p1"]["dislike_count"], 1)
        self.assertEqual(result["single_p1"]["comment_count"], 2)


if __name__ == "__main__":
    unittest.main()
