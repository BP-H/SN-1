import json
import os
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def run_approval_probe(probe: str) -> dict:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "connector_vote_approval.sqlite"
        env = os.environ.copy()
        env.update(
            {
                "DATABASE_URL": f"sqlite:///{db_path.as_posix()}",
                "DB_MODE": "central",
                "SECRET_KEY": "strong-test-secret-for-connector-vote-approval",
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
        if line.startswith("CONNECTOR_VOTE_APPROVAL_RESULT=")
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
from db_models import Base, ConnectorActionProposal

backend_app.FOLLOWS_STORE_PATH = Path(os.environ["FOLLOWS_STORE_PATH"])
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
            bio="author",
            species="human",
            profile_pic="default.jpg",
        )
        bob = backend_app.Harmonizer(
            username="bob",
            email="bob@example.test",
            hashed_password="test",
            bio="wrong user",
            species="ai",
            profile_pic="default.jpg",
        )
        db.add_all([alice, bob])
        db.commit()
        db.refresh(alice)
        db.refresh(bob)

        proposal = backend_app.Proposal(
            title="Connector Vote Target",
            description="Target proposal for connector vote approval tests.",
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


seeded = seed_context()
alice_token = backend_app._create_wrapper_access_token("alice")
bob_token = backend_app._create_wrapper_access_token("bob")
alice_headers = {"Authorization": f"Bearer {alice_token}"}
bob_headers = {"Authorization": f"Bearer {bob_token}"}
invalid_headers = {"Authorization": "Bearer not-a-valid-token"}


def counts():
    db = backend_app.SessionLocal()
    try:
        return {
            "actions": db.query(ConnectorActionProposal).count(),
            "votes": db.query(backend_app.ProposalVote).count(),
            "proposals": db.query(backend_app.Proposal).count(),
            "comments": db.query(backend_app.Comment).count(),
        }
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


def action_rows():
    db = backend_app.SessionLocal()
    try:
        rows = db.query(ConnectorActionProposal).order_by(ConnectorActionProposal.id.asc()).all()
        return [
            {
                "id": row.id,
                "action_type": row.action_type,
                "actor_user_id": row.actor_user_id,
                "target_type": row.target_type,
                "target_id": row.target_id,
                "status": row.status,
                "draft_payload": row.draft_payload,
                "result_payload": row.result_payload,
                "approved_at": row.approved_at.isoformat() if row.approved_at else None,
                "executed_at": row.executed_at.isoformat() if row.executed_at else None,
            }
            for row in rows
        ]
    finally:
        db.close()


def draft_vote(choice="support"):
    return client.post(
        "/connector/actions/draft-vote",
        json={"username": "alice", "proposal_id": seeded["proposal_id"], "choice": choice},
        headers=alice_headers,
    )
"""


class ConnectorVoteApprovalTests(unittest.TestCase):
    def test_approving_draft_vote_executes_exactly_one_vote(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            before = counts()
            draft = draft_vote()
            after_draft = counts()
            action_id = draft.json()["action_proposal"]["id"]
            approve = client.post(f"/connector/actions/{action_id}/approve-vote", headers=alice_headers)
            after_approve = counts()
            payload = approve.json()
            result = {
                "before": before,
                "after_draft": after_draft,
                "after_approve": after_approve,
                "draft_status": draft.status_code,
                "approve_status": approve.status_code,
                "approve_keys": sorted(payload.keys()),
                "executed": payload.get("executed"),
                "mode": payload.get("mode"),
                "summary": payload.get("summary"),
                "action": payload.get("action_proposal"),
                "result": payload.get("result"),
                "votes": vote_rows(),
                "actions": action_rows(),
            }
            print("CONNECTOR_VOTE_APPROVAL_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_approval_probe(probe)

        self.assertEqual(result["draft_status"], 200)
        self.assertEqual(result["approve_status"], 200)
        self.assertEqual(result["after_draft"]["votes"], result["before"]["votes"])
        self.assertEqual(result["after_approve"]["votes"], result["before"]["votes"] + 1)
        self.assertEqual(result["after_approve"]["actions"], result["before"]["actions"] + 1)
        self.assertEqual(result["after_approve"]["proposals"], result["before"]["proposals"])
        self.assertEqual(result["after_approve"]["comments"], result["before"]["comments"])
        self.assertEqual(
            set(result["approve_keys"]),
            {"action_proposal", "executed", "mode", "ok", "result", "safety", "summary"},
        )
        self.assertTrue(result["executed"])
        self.assertEqual(result["mode"], "approval_required")
        self.assertEqual(result["action"]["status"], "executed")
        self.assertEqual(result["summary"]["source_action"], "draft_vote")
        self.assertEqual(result["summary"]["vote"], "up")
        self.assertEqual(result["result"]["proposal_id"], result["summary"]["proposal_id"])
        self.assertEqual(result["result"]["vote"], "up")
        self.assertEqual(len(result["votes"]), 1)
        self.assertEqual(result["votes"][0]["vote"], "up")
        self.assertEqual(result["votes"][0]["harmonizer_id"], result["actions"][0]["actor_user_id"])
        self.assertEqual(result["actions"][0]["status"], "executed")
        self.assertIsNotNone(result["actions"][0]["approved_at"])
        self.assertIsNotNone(result["actions"][0]["executed_at"])
        self.assertEqual(result["actions"][0]["result_payload"]["vote"], "up")

    def test_approving_draft_vote_requires_matching_actor_token(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            draft = draft_vote()
            action_id = draft.json()["action_proposal"]["id"]
            missing = client.post(f"/connector/actions/{action_id}/approve-vote")
            invalid = client.post(f"/connector/actions/{action_id}/approve-vote", headers=invalid_headers)
            wrong = client.post(f"/connector/actions/{action_id}/approve-vote", headers=bob_headers)
            after = counts()
            result = {
                "missing_status": missing.status_code,
                "invalid_status": invalid.status_code,
                "wrong_status": wrong.status_code,
                "after": after,
                "votes": vote_rows(),
                "actions": action_rows(),
            }
            print("CONNECTOR_VOTE_APPROVAL_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_approval_probe(probe)

        self.assertEqual(result["missing_status"], 401)
        self.assertEqual(result["invalid_status"], 401)
        self.assertEqual(result["wrong_status"], 403)
        self.assertEqual(result["after"]["votes"], 0)
        self.assertEqual(result["votes"], [])
        self.assertEqual(result["actions"][0]["status"], "draft")

    def test_vote_approval_rejects_unknown_non_vote_and_reapproved_actions(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            unknown = client.post("/connector/actions/999999/approve-vote", headers=alice_headers)
            comment = client.post(
                "/connector/actions/draft-comment",
                json={
                    "username": "alice",
                    "proposal_id": seeded["proposal_id"],
                    "body": "Draft only comment.",
                },
                headers=alice_headers,
            )
            comment_action_id = comment.json()["action_proposal"]["id"]
            non_vote = client.post(f"/connector/actions/{comment_action_id}/approve-vote", headers=alice_headers)
            draft = draft_vote("oppose")
            vote_action_id = draft.json()["action_proposal"]["id"]
            first = client.post(f"/connector/actions/{vote_action_id}/approve-vote", headers=alice_headers)
            second = client.post(f"/connector/actions/{vote_action_id}/approve-vote", headers=alice_headers)
            after = counts()
            result = {
                "unknown_status": unknown.status_code,
                "non_vote_status": non_vote.status_code,
                "first_status": first.status_code,
                "second_status": second.status_code,
                "after": after,
                "votes": vote_rows(),
                "actions": action_rows(),
                "first_result": first.json().get("result"),
                "second_detail": second.json().get("detail"),
            }
            print("CONNECTOR_VOTE_APPROVAL_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_approval_probe(probe)

        self.assertEqual(result["unknown_status"], 404)
        self.assertEqual(result["non_vote_status"], 400)
        self.assertEqual(result["first_status"], 200)
        self.assertEqual(result["second_status"], 409)
        self.assertEqual(result["second_detail"], "Connector action is not in draft status")
        self.assertEqual(result["after"]["votes"], 1)
        self.assertEqual(len(result["votes"]), 1)
        self.assertEqual(result["votes"][0]["vote"], "down")
        self.assertEqual(result["first_result"]["vote"], "down")
        statuses = [row["status"] for row in result["actions"]]
        self.assertEqual(statuses, ["draft", "executed"])

    def test_approval_updates_existing_vote_without_duplicate(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            first_draft = draft_vote("support")
            first_id = first_draft.json()["action_proposal"]["id"]
            first = client.post(f"/connector/actions/{first_id}/approve-vote", headers=alice_headers)
            second_draft = draft_vote("oppose")
            second_id = second_draft.json()["action_proposal"]["id"]
            second = client.post(f"/connector/actions/{second_id}/approve-vote", headers=alice_headers)
            result = {
                "first_status": first.status_code,
                "second_status": second.status_code,
                "counts": counts(),
                "votes": vote_rows(),
                "actions": action_rows(),
                "second_result": second.json().get("result"),
            }
            print("CONNECTOR_VOTE_APPROVAL_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_approval_probe(probe)

        self.assertEqual(result["first_status"], 200)
        self.assertEqual(result["second_status"], 200)
        self.assertEqual(result["counts"]["actions"], 2)
        self.assertEqual(result["counts"]["votes"], 1)
        self.assertEqual(len(result["votes"]), 1)
        self.assertEqual(result["votes"][0]["vote"], "down")
        self.assertFalse(result["second_result"]["created"])
        self.assertTrue(all(row["status"] == "executed" for row in result["actions"]))


if __name__ == "__main__":
    unittest.main()
