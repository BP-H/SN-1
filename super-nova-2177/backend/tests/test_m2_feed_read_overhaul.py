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
backend_app._ensure_schema_compatibility_once()


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


def seed_busy_world(proposal_count=30, comments_per=10, votes_per=20):
    db = backend_app.SessionLocal()
    try:
        author = backend_app.Harmonizer(
            username="alice",
            email="alice@example.test",
            hashed_password="test",
            species="human",
            profile_pic="default.jpg",
        )
        db.add(author)
        voters = []
        for index in range(votes_per):
            species = ("human", "ai", "company")[index % 3]
            voter = backend_app.Harmonizer(
                username=f"voter{index:02d}",
                email=f"voter{index:02d}@example.test",
                hashed_password="test",
                species=species,
                profile_pic="default.jpg" if index % 2 else f"/uploads/avatar{index}.jpg",
            )
            db.add(voter)
            voters.append(voter)
        db.commit()
        db.refresh(author)
        for voter in voters:
            db.refresh(voter)

        vibenode = backend_app.VibeNode(name="default", author_id=author.id)
        db.add(vibenode)
        db.commit()
        db.refresh(vibenode)

        base_time = datetime.datetime(2026, 7, 1, 12, 0, 0)
        proposals = []
        for index in range(proposal_count):
            proposal = backend_app.Proposal(
                title=f"Busy fixture proposal {index:02d}",
                description=f"Body {index:02d}. " * 20,
                userName="alice",
                userInitials="AL",
                author_type="human",
                # every 5th proposal exercises the name-fallback resolution
                author_id=None if index % 5 == 0 else author.id,
                created_at=base_time - datetime.timedelta(minutes=index),
                voting_deadline=base_time + datetime.timedelta(days=7),
            )
            db.add(proposal)
            proposals.append(proposal)
        db.commit()
        for proposal in proposals:
            db.refresh(proposal)

        comment_ids = []
        for p_index, proposal in enumerate(proposals):
            for v_index, voter in enumerate(voters):
                db.add(
                    backend_app.ProposalVote(
                        proposal_id=proposal.id,
                        harmonizer_id=voter.id,
                        vote="up" if v_index % 4 else "down",
                        voter_type=voter.species,
                    )
                )
            for c_index in range(comments_per):
                if c_index == 7:
                    content = backend_app.DELETED_COMMENT_TEXT
                else:
                    content = f"Comment {c_index} on proposal {p_index}."
                comment = backend_app.Comment(
                    content=content,
                    # one dangling author per proposal exercises the
                    # Anonymous fallback; the rest rotate through voters
                    author_id=999999 if c_index == 3 else voters[c_index % len(voters)].id,
                    vibenode_id=vibenode.id,
                    proposal_id=proposal.id,
                    created_at=base_time - datetime.timedelta(minutes=p_index, seconds=c_index),
                )
                db.add(comment)
        db.commit()

        comment_rows = db.query(backend_app.Comment).order_by(backend_app.Comment.id.asc()).all()
        comment_ids = [row.id for row in comment_rows]

        from sqlalchemy import text as sql_text

        for offset, comment_id in enumerate(comment_ids[:40]):
            db.execute(
                sql_text(
                    "INSERT INTO comment_votes "
                    "(comment_id, harmonizer_id, voter, voter_type, vote) "
                    "VALUES (:comment_id, :harmonizer_id, :voter, :voter_type, :vote)"
                ),
                {
                    "comment_id": comment_id,
                    "harmonizer_id": voters[offset % len(voters)].id,
                    "voter": voters[offset % len(voters)].username,
                    "voter_type": voters[offset % len(voters)].species,
                    "vote": "up" if offset % 3 else "down",
                },
            )

        collab_statuses = ("approved", "pending", "approved", "declined")
        for p_index, proposal in enumerate(proposals[:8]):
            for c_index, status in enumerate(collab_statuses):
                db.add(
                    backend_app.ProposalCollab(
                        proposal_id=proposal.id,
                        author_user_id=author.id,
                        collaborator_user_id=voters[(p_index + c_index) % len(voters)].id,
                        requested_by_user_id=author.id,
                        status=status,
                    )
                )
        db.commit()

        backend_app._upsert_profile_metadata(db, "alice", "https://alice.example", True)
        return [proposal.id for proposal in proposals]
    finally:
        db.close()
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


class M2BatchedSerializerTests(unittest.TestCase):
    def test_batched_serializer_matches_legacy_byte_for_byte(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            import os

            seed_busy_world()
            urls = (
                "/proposals?filter=latest&limit=30",
                "/proposals?filter=latest&limit=30"
                "&embedded_comments_limit=3&embedded_votes_limit=5",
                "/proposals?filter=all&limit=12&offset=6",
            )
            os.environ["FEED_SERIALIZER"] = "legacy"
            legacy_bodies = [client.get(url).text for url in urls]
            os.environ.pop("FEED_SERIALIZER", None)
            new_bodies = [client.get(url).text for url in urls]
            first_page = json.loads(new_bodies[0])
            result = {
                "equal": [legacy == new for legacy, new in zip(legacy_bodies, new_bodies)],
                "items": len(first_page),
                "sample_counts": {
                    "like_count": first_page[0].get("like_count"),
                    "dislike_count": first_page[0].get("dislike_count"),
                    "comment_count": first_page[0].get("comment_count"),
                },
                "sample_comment_user": first_page[0]["comments"][3].get("user"),
                "collabs_nonempty": any(entry.get("collabs") for entry in first_page),
                "comment_vote_likes": first_page[0]["comments"][0].get("likes"),
            }
            print("M2_FEED_READ_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_m2_probe(probe)

        self.assertEqual(result["equal"], [True, True, True])
        self.assertEqual(result["items"], 30)
        # 20 votes per proposal: every 4th is a down vote.
        self.assertEqual(
            result["sample_counts"],
            {"like_count": 15, "dislike_count": 5, "comment_count": 9},
        )
        # Dangling comment author resolves through the Anonymous fallback in
        # both serializer paths.
        self.assertEqual(result["sample_comment_user"], "Anonymous")
        self.assertTrue(result["collabs_nonempty"])

    def test_feed_query_budget_within_twelve_statements(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            from sqlalchemy import event

            seed_busy_world()
            engine = current_bind()
            warm = client.get("/proposals?filter=latest&limit=30")
            statements = []

            def count_statement(conn, cursor, statement, parameters, context, executemany):
                statements.append(statement)

            event.listen(engine, "before_cursor_execute", count_statement)
            try:
                measured = client.get("/proposals?filter=latest&limit=30")
            finally:
                event.remove(engine, "before_cursor_execute", count_statement)
            result = {
                "warm_status": warm.status_code,
                "measured_status": measured.status_code,
                "items": len(measured.json()),
                "statement_count": len(statements),
            }
            print("M2_FEED_READ_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_m2_probe(probe)

        self.assertEqual(result["warm_status"], 200)
        self.assertEqual(result["measured_status"], 200)
        self.assertEqual(result["items"], 30)
        self.assertLessEqual(result["statement_count"], 12)

    def test_raw_sql_fallback_branch_keeps_shape(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            seed_busy_world(proposal_count=6, comments_per=2, votes_per=3)
            backend_app.CRUD_MODELS_AVAILABLE = False
            try:
                response = client.get("/proposals?filter=latest&limit=6")
            finally:
                backend_app.CRUD_MODELS_AVAILABLE = True
            payload = response.json()
            first = payload[0] if payload else {}
            result = {
                "status": response.status_code,
                "items": len(payload),
                "keys": sorted(first.keys()),
                "likes_len": len(first.get("likes") or []),
                "comments_len": len(first.get("comments") or []),
                "like_count": first.get("like_count"),
                "comment_count": first.get("comment_count"),
            }
            print("M2_FEED_READ_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_m2_probe(probe)

        self.assertEqual(result["status"], 200)
        self.assertEqual(result["items"], 6)
        for key in (
            "id",
            "title",
            "userName",
            "userInitials",
            "text",
            "author_img",
            "time",
            "author_type",
            "profile_url",
            "domain_as_profile",
            "likes",
            "dislikes",
            "comments",
            "collabs",
            "media",
            "voting_closed",
            "like_count",
            "dislike_count",
            "comment_count",
        ):
            self.assertIn(key, result["keys"])
        self.assertEqual(result["likes_len"], 2)
        self.assertEqual(result["comments_len"], 2)
        self.assertEqual(result["like_count"], 2)
        self.assertEqual(result["comment_count"], 2)


if __name__ == "__main__":
    unittest.main()
