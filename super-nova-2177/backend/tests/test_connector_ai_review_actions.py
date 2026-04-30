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


def run_ai_review_probe(probe: str) -> dict:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "connector_ai_review_actions.sqlite"
        env = os.environ.copy()
        env.update(
            {
                "DATABASE_URL": f"sqlite:///{db_path.as_posix()}",
                "DB_MODE": "central",
                "SECRET_KEY": "strong-test-secret-for-connector-ai-review",
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
        if line.startswith("CONNECTOR_AI_REVIEW_RESULT=")
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
            bio="human author",
            species="human",
            profile_pic="default.jpg",
        )
        bob = backend_app.Harmonizer(
            username="bob-ai",
            email="bob-ai@example.test",
            hashed_password="test",
            bio="ai reviewer",
            species="ai",
            profile_pic="default.jpg",
        )
        cara = backend_app.Harmonizer(
            username="cara",
            email="cara@example.test",
            hashed_password="test",
            bio="wrong user",
            species="company",
            profile_pic="default.jpg",
        )
        db.add_all([alice, bob, cara])
        db.commit()
        db.refresh(alice)
        db.refresh(bob)
        db.refresh(cara)

        proposal = backend_app.Proposal(
            title="AI Review Target",
            description="Target proposal for AI review drafts.",
            userName="alice",
            userInitials="AL",
            author_type="human",
            author_id=alice.id,
            voting_deadline=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        )
        db.add(proposal)
        db.commit()
        db.refresh(proposal)
        return {
            "proposal_id": proposal.id,
            "alice_id": alice.id,
            "bob_id": bob.id,
            "cara_id": cara.id,
        }
    finally:
        db.close()


seeded = seed_context()
alice_token = backend_app._create_wrapper_access_token("alice")
bob_token = backend_app._create_wrapper_access_token("bob-ai")
cara_token = backend_app._create_wrapper_access_token("cara")
alice_headers = {"Authorization": f"Bearer {alice_token}"}
bob_headers = {"Authorization": f"Bearer {bob_token}"}
cara_headers = {"Authorization": f"Bearer {cara_token}"}
invalid_headers = {"Authorization": "Bearer not-a-valid-token"}


def counts():
    db = backend_app.SessionLocal()
    try:
        return {
            "actions": db.query(ConnectorActionProposal).count(),
            "votes": db.query(backend_app.ProposalVote).count(),
            "comments": db.query(backend_app.Comment).count(),
            "proposals": db.query(backend_app.Proposal).count(),
        }
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


def vote_rows():
    db = backend_app.SessionLocal()
    try:
        rows = db.query(backend_app.ProposalVote).order_by(
            backend_app.ProposalVote.proposal_id.asc(),
            backend_app.ProposalVote.harmonizer_id.asc(),
        ).all()
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


def comment_rows():
    db = backend_app.SessionLocal()
    try:
        rows = db.query(backend_app.Comment).order_by(backend_app.Comment.id.asc()).all()
        return [
            {
                "id": row.id,
                "proposal_id": row.proposal_id,
                "content": row.content,
                "author_id": row.author_id,
                "author": getattr(getattr(row, "author", None), "username", ""),
            }
            for row in rows
        ]
    finally:
        db.close()


def draft_ai_review(choice="support", rationale="AI sees strong public-interest alignment.", confidence=0.82):
    return client.post(
        "/connector/actions/draft-ai-review",
        json={
            "username": "bob-ai",
            "proposal_id": seeded["proposal_id"],
            "choice": choice,
            "rationale": rationale,
            "confidence": confidence,
        },
        headers=bob_headers,
    )
"""


class ConnectorAiReviewActionTests(unittest.TestCase):
    def test_draft_ai_review_requires_auth_ai_actor_and_does_not_execute(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            before = counts()
            body = {
                "username": "bob-ai",
                "proposal_id": seeded["proposal_id"],
                "choice": "support",
                "rationale": "AI sees a useful review path.",
                "confidence": 1.4,
            }
            missing = client.post("/connector/actions/draft-ai-review", json=body)
            invalid = client.post("/connector/actions/draft-ai-review", json=body, headers=invalid_headers)
            wrong = client.post("/connector/actions/draft-ai-review", json=body, headers=alice_headers)
            non_ai = client.post(
                "/connector/actions/draft-ai-review",
                json={**body, "username": "alice"},
                headers=alice_headers,
            )
            unknown_proposal = client.post(
                "/connector/actions/draft-ai-review",
                json={**body, "proposal_id": 999999},
                headers=bob_headers,
            )
            invalid_choice = client.post(
                "/connector/actions/draft-ai-review",
                json={**body, "choice": "maybe"},
                headers=bob_headers,
            )
            long_rationale = client.post(
                "/connector/actions/draft-ai-review",
                json={**body, "rationale": "x" * 801},
                headers=bob_headers,
            )
            matching = client.post("/connector/actions/draft-ai-review", json=body, headers=bob_headers)
            after = counts()
            payload = matching.json()
            result = {
                "before": before,
                "after": after,
                "missing_status": missing.status_code,
                "invalid_status": invalid.status_code,
                "wrong_status": wrong.status_code,
                "non_ai_status": non_ai.status_code,
                "unknown_proposal_status": unknown_proposal.status_code,
                "invalid_choice_status": invalid_choice.status_code,
                "long_rationale_status": long_rationale.status_code,
                "matching_status": matching.status_code,
                "response_keys": sorted(payload.keys()),
                "executed": payload.get("executed"),
                "action_type": payload.get("action_proposal", {}).get("action_type"),
                "status": payload.get("action_proposal", {}).get("status"),
                "summary": payload.get("summary"),
                "actions": action_rows(),
            }
            print("CONNECTOR_AI_REVIEW_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_ai_review_probe(probe)

        self.assertEqual(result["missing_status"], 401)
        self.assertEqual(result["invalid_status"], 401)
        self.assertEqual(result["wrong_status"], 403)
        self.assertEqual(result["non_ai_status"], 403)
        self.assertEqual(result["unknown_proposal_status"], 404)
        self.assertEqual(result["invalid_choice_status"], 400)
        self.assertEqual(result["long_rationale_status"], 400)
        self.assertEqual(result["matching_status"], 200)
        self.assertEqual(
            set(result["response_keys"]),
            {"action_proposal", "executed", "mode", "ok", "safety", "summary"},
        )
        self.assertFalse(result["executed"])
        self.assertEqual(result["action_type"], "draft_ai_review")
        self.assertEqual(result["status"], "draft")
        self.assertEqual(result["summary"]["actor_species"], "ai")
        self.assertEqual(result["summary"]["intended_choice"], "support")
        self.assertEqual(result["summary"]["normalized_vote"], "up")
        self.assertEqual(result["summary"]["confidence"], 1.0)
        self.assertEqual(result["after"]["actions"], result["before"]["actions"] + 1)
        self.assertEqual(result["after"]["votes"], result["before"]["votes"])
        self.assertEqual(result["after"]["comments"], result["before"]["comments"])
        self.assertEqual(result["after"]["proposals"], result["before"]["proposals"])
        self.assertEqual(result["actions"][0]["action_type"], "draft_ai_review")
        self.assertEqual(result["actions"][0]["status"], "draft")

    def test_approving_ai_review_executes_one_vote_and_one_comment_once(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            before = counts()
            draft = draft_ai_review("oppose", "AI rationale: risk needs review.", 0.33)
            after_draft = counts()
            action_id = draft.json()["action_proposal"]["id"]
            approve = client.post(f"/connector/actions/{action_id}/approve-ai-review", headers=bob_headers)
            after_approve = counts()
            repeat = client.post(f"/connector/actions/{action_id}/approve-ai-review", headers=bob_headers)
            after_repeat = counts()
            payload = approve.json()
            result = {
                "before": before,
                "after_draft": after_draft,
                "after_approve": after_approve,
                "after_repeat": after_repeat,
                "draft_status": draft.status_code,
                "approve_status": approve.status_code,
                "repeat_status": repeat.status_code,
                "repeat_detail": repeat.json().get("detail"),
                "approve_keys": sorted(payload.keys()),
                "executed": payload.get("executed"),
                "summary": payload.get("summary"),
                "result": payload.get("result"),
                "actions": action_rows(),
                "votes": vote_rows(),
                "comments": comment_rows(),
            }
            print("CONNECTOR_AI_REVIEW_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_ai_review_probe(probe)

        self.assertEqual(result["draft_status"], 200)
        self.assertEqual(result["approve_status"], 200)
        self.assertEqual(result["repeat_status"], 409)
        self.assertEqual(result["repeat_detail"], "Connector action is not in draft status")
        self.assertEqual(result["after_draft"]["votes"], result["before"]["votes"])
        self.assertEqual(result["after_draft"]["comments"], result["before"]["comments"])
        self.assertEqual(result["after_approve"]["votes"], result["before"]["votes"] + 1)
        self.assertEqual(result["after_approve"]["comments"], result["before"]["comments"] + 1)
        self.assertEqual(result["after_repeat"], result["after_approve"])
        self.assertEqual(
            set(result["approve_keys"]),
            {"action_proposal", "executed", "mode", "ok", "result", "safety", "summary"},
        )
        self.assertTrue(result["executed"])
        self.assertEqual(result["summary"]["source_action"], "draft_ai_review")
        self.assertEqual(result["summary"]["actor_species"], "ai")
        self.assertEqual(result["summary"]["vote"], "down")
        self.assertEqual(result["result"]["executed_action"], "ai_review")
        self.assertEqual(result["result"]["comment_id"], result["comments"][0]["id"])
        self.assertEqual(result["result"]["confidence"], 0.33)
        self.assertEqual(len(result["votes"]), 1)
        self.assertEqual(result["votes"][0]["vote"], "down")
        self.assertEqual(result["votes"][0]["voter_type"], "ai")
        self.assertEqual(len(result["comments"]), 1)
        self.assertEqual(result["comments"][0]["author"], "bob-ai")
        self.assertEqual(result["comments"][0]["content"], "AI rationale: risk needs review.")
        self.assertEqual(result["actions"][0]["status"], "executed")
        self.assertIsNotNone(result["actions"][0]["approved_at"])
        self.assertIsNotNone(result["actions"][0]["executed_at"])

    def test_approve_ai_review_requires_matching_actor_and_right_action_state(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            unknown = client.post("/connector/actions/999999/approve-ai-review", headers=bob_headers)
            vote_draft = client.post(
                "/connector/actions/draft-vote",
                json={"username": "bob-ai", "proposal_id": seeded["proposal_id"], "choice": "support"},
                headers=bob_headers,
            )
            vote_action_id = vote_draft.json()["action_proposal"]["id"]
            wrong_type = client.post(f"/connector/actions/{vote_action_id}/approve-ai-review", headers=bob_headers)

            review_draft = draft_ai_review("abstain", "AI abstains pending more context.", 0.5)
            review_action_id = review_draft.json()["action_proposal"]["id"]
            missing = client.post(f"/connector/actions/{review_action_id}/approve-ai-review")
            invalid = client.post(f"/connector/actions/{review_action_id}/approve-ai-review", headers=invalid_headers)
            wrong_user = client.post(f"/connector/actions/{review_action_id}/approve-ai-review", headers=alice_headers)
            cancel = client.post(f"/connector/actions/{review_action_id}/cancel", headers=bob_headers)
            canceled_approval = client.post(f"/connector/actions/{review_action_id}/approve-ai-review", headers=bob_headers)
            result = {
                "unknown_status": unknown.status_code,
                "wrong_type_status": wrong_type.status_code,
                "missing_status": missing.status_code,
                "invalid_status": invalid.status_code,
                "wrong_user_status": wrong_user.status_code,
                "cancel_status": cancel.status_code,
                "canceled_approval_status": canceled_approval.status_code,
                "counts": counts(),
                "actions": action_rows(),
                "votes": vote_rows(),
                "comments": comment_rows(),
            }
            print("CONNECTOR_AI_REVIEW_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_ai_review_probe(probe)

        self.assertEqual(result["unknown_status"], 404)
        self.assertEqual(result["wrong_type_status"], 400)
        self.assertEqual(result["missing_status"], 401)
        self.assertEqual(result["invalid_status"], 401)
        self.assertEqual(result["wrong_user_status"], 403)
        self.assertEqual(result["cancel_status"], 200)
        self.assertEqual(result["canceled_approval_status"], 409)
        self.assertEqual(result["counts"]["votes"], 0)
        self.assertEqual(result["counts"]["comments"], 0)
        self.assertEqual([row["status"] for row in result["actions"]], ["draft", "canceled"])
        self.assertEqual(result["votes"], [])
        self.assertEqual(result["comments"], [])


if __name__ == "__main__":
    unittest.main()
