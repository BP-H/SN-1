import json
import os
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def run_votes_probe(probe: str) -> dict:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "votes_router_auth.sqlite"
        env = os.environ.copy()
        env.update(
            {
                "DATABASE_URL": f"sqlite:///{db_path.as_posix()}",
                "DB_MODE": "central",
                "SECRET_KEY": "strong-test-secret-for-votes-router-auth",
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
        if line.startswith("VOTES_ROUTER_AUTH_RESULT=")
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


def seed_vote_world():
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
        db.add_all([alice, bob])
        db.commit()
        for user in (alice, bob):
            db.refresh(user)

        proposal = backend_app.Proposal(
            title="Votes router auth proposal",
            description="Pins authenticated vote route behavior.",
            userName="alice",
            userInitials="AL",
            author_type="human",
            author_id=alice.id,
            voting_deadline=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        )
        db.add(proposal)
        db.commit()
        db.refresh(proposal)
        return {"proposal_id": proposal.id, "alice_id": alice.id, "bob_id": bob.id}
    finally:
        db.close()


def vote_rows():
    db = backend_app.SessionLocal()
    try:
        rows = db.query(backend_app.ProposalVote).all()
        return [
            {
                "proposal_id": row.proposal_id,
                "harmonizer_id": row.harmonizer_id,
                "vote": getattr(row, "vote", None),
                "voter_type": getattr(row, "voter_type", None),
            }
            for row in rows
        ]
    finally:
        db.close()


def dummy_harmonizers():
    db = backend_app.SessionLocal()
    try:
        rows = db.query(backend_app.Harmonizer).filter(
            (backend_app.Harmonizer.hashed_password == "dummy")
            | (backend_app.Harmonizer.email.like("%@example.com"))
        ).all()
        return [
            {
                "username": row.username,
                "email": row.email,
                "hashed_password": row.hashed_password,
            }
            for row in rows
        ]
    finally:
        db.close()


def token_for(username):
    return backend_app._create_wrapper_access_token(username)


alice_headers = {"Authorization": f"Bearer {token_for('alice')}"}
bob_headers = {"Authorization": f"Bearer {token_for('bob')}"}
ghost_headers = {"Authorization": f"Bearer {token_for('ghost')}"}
invalid_headers = {"Authorization": "Bearer not-a-valid-token"}
"""


class VotesRouterAuthTests(unittest.TestCase):
    def test_post_votes_requires_matching_bearer_identity_and_preserves_shape(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            seeded = seed_vote_world()
            body = {
                "proposal_id": seeded["proposal_id"],
                "username": "alice",
                "choice": "up",
                "voter_type": "human",
            }
            missing = client.post("/votes", json=body)
            invalid = client.post("/votes", json=body, headers=invalid_headers)
            wrong = client.post("/votes", json=body, headers=bob_headers)
            matching = client.post("/votes", json=body, headers=alice_headers)
            payload = matching.json()
            result = {
                "missing_status": missing.status_code,
                "invalid_status": invalid.status_code,
                "wrong_status": wrong.status_code,
                "matching_status": matching.status_code,
                "matching_keys": sorted(payload.keys()),
                "ok": payload.get("ok"),
                "votes": vote_rows(),
            }
            print("VOTES_ROUTER_AUTH_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_votes_probe(probe)

        self.assertEqual(result["missing_status"], 401)
        self.assertEqual(result["invalid_status"], 401)
        self.assertEqual(result["wrong_status"], 403)
        self.assertEqual(result["matching_status"], 200)
        self.assertEqual(set(result["matching_keys"]), {"ok"})
        self.assertTrue(result["ok"])
        self.assertEqual(len(result["votes"]), 1)
        self.assertEqual(result["votes"][0]["vote"], "up")
        self.assertEqual(result["votes"][0]["voter_type"], "human")

    def test_post_votes_updates_existing_vote_without_duplicate(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            seeded = seed_vote_world()
            first = {
                "proposal_id": seeded["proposal_id"],
                "username": "alice",
                "choice": "up",
                "voter_type": "human",
            }
            second = {
                "proposal_id": seeded["proposal_id"],
                "username": "alice",
                "choice": "down",
                "voter_type": "human",
            }
            client.post("/votes", json=first, headers=alice_headers)
            update = client.post("/votes", json=second, headers=alice_headers)
            result = {
                "update_status": update.status_code,
                "update_payload": update.json(),
                "votes": vote_rows(),
            }
            print("VOTES_ROUTER_AUTH_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_votes_probe(probe)

        self.assertEqual(result["update_status"], 200)
        self.assertEqual(result["update_payload"], {"ok": True})
        self.assertEqual(len(result["votes"]), 1)
        self.assertEqual(result["votes"][0]["vote"], "down")

    def test_post_votes_does_not_auto_create_unknown_harmonizer(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            seeded = seed_vote_world()
            body = {
                "proposal_id": seeded["proposal_id"],
                "username": "ghost",
                "choice": "up",
                "voter_type": "human",
            }
            response = client.post("/votes", json=body, headers=ghost_headers)
            result = {
                "status_code": response.status_code,
                "detail": response.json().get("detail"),
                "dummy_harmonizers": dummy_harmonizers(),
                "votes": vote_rows(),
            }
            print("VOTES_ROUTER_AUTH_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_votes_probe(probe)

        self.assertEqual(result["status_code"], 404)
        self.assertIn("not found", result["detail"].lower())
        self.assertEqual(result["dummy_harmonizers"], [])
        self.assertEqual(result["votes"], [])

    def test_post_votes_invalid_voter_type_and_choice_return_400(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            seeded = seed_vote_world()
            invalid_type = client.post(
                "/votes",
                json={
                    "proposal_id": seeded["proposal_id"],
                    "username": "alice",
                    "choice": "up",
                    "voter_type": "robot",
                },
                headers=alice_headers,
            )
            invalid_choice = client.post(
                "/votes",
                json={
                    "proposal_id": seeded["proposal_id"],
                    "username": "alice",
                    "choice": "sideways",
                    "voter_type": "human",
                },
                headers=alice_headers,
            )
            result = {
                "invalid_type_status": invalid_type.status_code,
                "invalid_type_detail": invalid_type.json().get("detail"),
                "invalid_choice_status": invalid_choice.status_code,
                "invalid_choice_detail": invalid_choice.json().get("detail"),
                "votes": vote_rows(),
            }
            print("VOTES_ROUTER_AUTH_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_votes_probe(probe)

        self.assertEqual(result["invalid_type_status"], 400)
        self.assertEqual(result["invalid_type_detail"], "Invalid voter_type")
        self.assertEqual(result["invalid_choice_status"], 400)
        self.assertEqual(result["invalid_choice_detail"], "Invalid choice")
        self.assertEqual(result["votes"], [])

    def test_post_votes_preserves_saved_species_over_client_voter_type(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            seeded = seed_vote_world()
            response = client.post(
                "/votes",
                json={
                    "proposal_id": seeded["proposal_id"],
                    "username": "alice",
                    "choice": "up",
                    "voter_type": "company",
                },
                headers=alice_headers,
            )
            result = {
                "status_code": response.status_code,
                "payload": response.json(),
                "votes": vote_rows(),
            }
            print("VOTES_ROUTER_AUTH_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_votes_probe(probe)

        self.assertEqual(result["status_code"], 200)
        self.assertEqual(result["payload"], {"ok": True})
        self.assertEqual(len(result["votes"]), 1)
        self.assertEqual(result["votes"][0]["voter_type"], "human")

    def test_delete_votes_requires_matching_bearer_identity_and_preserves_shape(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            seeded = seed_vote_world()
            body = {
                "proposal_id": seeded["proposal_id"],
                "username": "alice",
                "choice": "up",
                "voter_type": "human",
            }
            client.post("/votes", json=body, headers=alice_headers)
            missing = client.delete(f"/votes?proposal_id={seeded['proposal_id']}&username=alice")
            invalid = client.delete(
                f"/votes?proposal_id={seeded['proposal_id']}&username=alice",
                headers=invalid_headers,
            )
            wrong = client.delete(
                f"/votes?proposal_id={seeded['proposal_id']}&username=alice",
                headers=bob_headers,
            )
            matching = client.delete(
                f"/votes?proposal_id={seeded['proposal_id']}&username=alice",
                headers=alice_headers,
            )
            payload = matching.json()
            result = {
                "missing_status": missing.status_code,
                "invalid_status": invalid.status_code,
                "wrong_status": wrong.status_code,
                "matching_status": matching.status_code,
                "matching_keys": sorted(payload.keys()),
                "ok": payload.get("ok"),
                "removed": payload.get("removed"),
                "votes": vote_rows(),
            }
            print("VOTES_ROUTER_AUTH_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_votes_probe(probe)

        self.assertEqual(result["missing_status"], 401)
        self.assertEqual(result["invalid_status"], 401)
        self.assertEqual(result["wrong_status"], 403)
        self.assertEqual(result["matching_status"], 200)
        self.assertEqual(set(result["matching_keys"]), {"ok", "removed"})
        self.assertTrue(result["ok"])
        self.assertEqual(result["removed"], 1)
        self.assertEqual(result["votes"], [])

    def test_delete_votes_missing_vote_and_unknown_user_do_not_create_harmonizer(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            seeded = seed_vote_world()
            missing_vote = client.delete(
                f"/votes?proposal_id={seeded['proposal_id']}&username=alice",
                headers=alice_headers,
            )
            unknown_user = client.delete(
                f"/votes?proposal_id={seeded['proposal_id']}&username=ghost",
                headers=ghost_headers,
            )
            result = {
                "missing_vote_status": missing_vote.status_code,
                "missing_vote_detail": missing_vote.json().get("detail"),
                "unknown_user_status": unknown_user.status_code,
                "unknown_user_detail": unknown_user.json().get("detail"),
                "dummy_harmonizers": dummy_harmonizers(),
                "votes": vote_rows(),
            }
            print("VOTES_ROUTER_AUTH_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_votes_probe(probe)

        self.assertEqual(result["missing_vote_status"], 404)
        self.assertEqual(result["missing_vote_detail"], "Vote not found")
        self.assertEqual(result["unknown_user_status"], 404)
        self.assertIn("not found", result["unknown_user_detail"].lower())
        self.assertEqual(result["dummy_harmonizers"], [])
        self.assertEqual(result["votes"], [])


if __name__ == "__main__":
    unittest.main()
