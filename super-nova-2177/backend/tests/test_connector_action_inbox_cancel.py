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


def run_inbox_probe(probe: str) -> dict:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "connector_action_inbox_cancel.sqlite"
        env = os.environ.copy()
        env.update(
            {
                "DATABASE_URL": f"sqlite:///{db_path.as_posix()}",
                "DB_MODE": "central",
                "SECRET_KEY": "strong-test-secret-for-connector-action-inbox",
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
        if line.startswith("CONNECTOR_ACTION_INBOX_RESULT=")
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
from db_models import Base, ConnectorActionProposal, Notification, ProposalCollab

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
            bio="other user",
            species="ai",
            profile_pic="default.jpg",
        )
        db.add_all([alice, bob])
        db.commit()
        db.refresh(alice)
        db.refresh(bob)

        proposal = backend_app.Proposal(
            title="Connector Inbox Target",
            description="Target proposal for connector inbox tests.",
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
            "comments": db.query(backend_app.Comment).count(),
            "proposals": db.query(backend_app.Proposal).count(),
            "collabs": db.query(ProposalCollab).count(),
            "notifications": db.query(Notification).count(),
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
            }
            for row in rows
        ]
    finally:
        db.close()


def draft_vote(username="alice", choice="support", headers=None):
    return client.post(
        "/connector/actions/draft-vote",
        json={"username": username, "proposal_id": seeded["proposal_id"], "choice": choice},
        headers=headers or alice_headers,
    )


def draft_comment(headers=None):
    return client.post(
        "/connector/actions/draft-comment",
        json={
            "username": "alice",
            "proposal_id": seeded["proposal_id"],
            "body": "Draft comment only.",
        },
        headers=headers or alice_headers,
    )
"""


class ConnectorActionInboxCancelTests(unittest.TestCase):
    def test_list_requires_auth_and_returns_only_current_actor_drafts(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            draft_vote()
            client.post(
                "/connector/actions/draft-vote",
                json={"username": "bob", "proposal_id": seeded["proposal_id"], "choice": "oppose"},
                headers=bob_headers,
            )
            missing = client.get("/connector/actions")
            invalid = client.get("/connector/actions", headers=invalid_headers)
            alice_list = client.get("/connector/actions", headers=alice_headers)
            bob_list = client.get("/connector/actions", headers=bob_headers)
            invalid_status = client.get("/connector/actions?status=unknown", headers=alice_headers)
            result = {
                "missing_status": missing.status_code,
                "invalid_status": invalid.status_code,
                "invalid_filter_status": invalid_status.status_code,
                "alice_status": alice_list.status_code,
                "bob_status": bob_list.status_code,
                "alice_payload": alice_list.json(),
                "bob_payload": bob_list.json(),
            }
            print("CONNECTOR_ACTION_INBOX_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_inbox_probe(probe)

        self.assertEqual(result["missing_status"], 401)
        self.assertEqual(result["invalid_status"], 401)
        self.assertEqual(result["invalid_filter_status"], 400)
        self.assertEqual(result["alice_status"], 200)
        self.assertEqual(result["bob_status"], 200)
        self.assertTrue(result["alice_payload"]["ok"])
        self.assertEqual(result["alice_payload"]["count"], 1)
        self.assertEqual(result["bob_payload"]["count"], 1)
        self.assertEqual(result["alice_payload"]["actions"][0]["draft_payload"]["actor"], "alice")
        self.assertEqual(result["bob_payload"]["actions"][0]["draft_payload"]["actor"], "bob")
        self.assertNotEqual(
            result["alice_payload"]["actions"][0]["id"],
            result["bob_payload"]["actions"][0]["id"],
        )

    def test_list_status_filter_limit_clamp_and_offset_normalization(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            first = draft_vote("alice", "support")
            second = draft_comment()
            first_id = first.json()["action_proposal"]["id"]
            second_id = second.json()["action_proposal"]["id"]
            cancel = client.post(f"/connector/actions/{first_id}/cancel", headers=alice_headers)
            drafts = client.get("/connector/actions?status=draft&limit=1000&offset=-4", headers=alice_headers)
            canceled = client.get("/connector/actions?status=canceled", headers=alice_headers)
            empty_page = client.get("/connector/actions?status=draft&limit=1&offset=1", headers=alice_headers)
            result = {
                "cancel_status": cancel.status_code,
                "drafts": drafts.json(),
                "canceled": canceled.json(),
                "empty_page": empty_page.json(),
                "ids": {"first": first_id, "second": second_id},
            }
            print("CONNECTOR_ACTION_INBOX_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_inbox_probe(probe)

        self.assertEqual(result["cancel_status"], 200)
        self.assertEqual(result["drafts"]["limit"], 100)
        self.assertEqual(result["drafts"]["offset"], 0)
        self.assertEqual(result["drafts"]["count"], 1)
        self.assertEqual(result["drafts"]["actions"][0]["id"], result["ids"]["second"])
        self.assertEqual(result["canceled"]["count"], 1)
        self.assertEqual(result["canceled"]["actions"][0]["id"], result["ids"]["first"])
        self.assertEqual(result["canceled"]["actions"][0]["status"], "canceled")
        self.assertEqual(result["empty_page"]["count"], 0)
        self.assertEqual(result["empty_page"]["limit"], 1)
        self.assertEqual(result["empty_page"]["offset"], 1)

    def test_cancel_requires_actor_and_does_not_execute_any_action(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            draft = draft_vote()
            action_id = draft.json()["action_proposal"]["id"]
            before = counts()
            missing = client.post(f"/connector/actions/{action_id}/cancel")
            invalid = client.post(f"/connector/actions/{action_id}/cancel", headers=invalid_headers)
            wrong = client.post(f"/connector/actions/{action_id}/cancel", headers=bob_headers)
            unknown = client.post("/connector/actions/999999/cancel", headers=alice_headers)
            cancel = client.post(f"/connector/actions/{action_id}/cancel", headers=alice_headers)
            repeat = client.post(f"/connector/actions/{action_id}/cancel", headers=alice_headers)
            after = counts()
            result = {
                "missing_status": missing.status_code,
                "invalid_status": invalid.status_code,
                "wrong_status": wrong.status_code,
                "unknown_status": unknown.status_code,
                "cancel_status": cancel.status_code,
                "repeat_status": repeat.status_code,
                "before": before,
                "after": after,
                "cancel_payload": cancel.json(),
                "actions": action_rows(),
            }
            print("CONNECTOR_ACTION_INBOX_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_inbox_probe(probe)

        self.assertEqual(result["missing_status"], 401)
        self.assertEqual(result["invalid_status"], 401)
        self.assertEqual(result["wrong_status"], 403)
        self.assertEqual(result["unknown_status"], 404)
        self.assertEqual(result["cancel_status"], 200)
        self.assertEqual(result["repeat_status"], 409)
        self.assertFalse(result["cancel_payload"]["executed"])
        self.assertEqual(result["cancel_payload"]["action"]["status"], "canceled")
        self.assertEqual(result["after"]["actions"], result["before"]["actions"])
        self.assertEqual(result["after"]["votes"], result["before"]["votes"])
        self.assertEqual(result["after"]["comments"], result["before"]["comments"])
        self.assertEqual(result["after"]["proposals"], result["before"]["proposals"])
        self.assertEqual(result["after"]["collabs"], result["before"]["collabs"])
        self.assertEqual(result["after"]["notifications"], result["before"]["notifications"])
        self.assertEqual(result["actions"][0]["status"], "canceled")

    def test_canceled_action_cannot_be_approved_and_executed_action_cannot_be_canceled(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            canceled_draft = draft_vote("alice", "support")
            canceled_id = canceled_draft.json()["action_proposal"]["id"]
            cancel = client.post(f"/connector/actions/{canceled_id}/cancel", headers=alice_headers)
            approve_canceled = client.post(f"/connector/actions/{canceled_id}/approve-vote", headers=alice_headers)

            executed_draft = draft_vote("alice", "oppose")
            executed_id = executed_draft.json()["action_proposal"]["id"]
            approve = client.post(f"/connector/actions/{executed_id}/approve-vote", headers=alice_headers)
            cancel_executed = client.post(f"/connector/actions/{executed_id}/cancel", headers=alice_headers)

            result = {
                "cancel_status": cancel.status_code,
                "approve_canceled_status": approve_canceled.status_code,
                "approve_status": approve.status_code,
                "cancel_executed_status": cancel_executed.status_code,
                "counts": counts(),
                "actions": action_rows(),
            }
            print("CONNECTOR_ACTION_INBOX_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_inbox_probe(probe)

        self.assertEqual(result["cancel_status"], 200)
        self.assertEqual(result["approve_canceled_status"], 409)
        self.assertEqual(result["approve_status"], 200)
        self.assertEqual(result["cancel_executed_status"], 409)
        self.assertEqual(result["counts"]["votes"], 1)
        self.assertEqual([row["status"] for row in result["actions"]], ["canceled", "executed"])


if __name__ == "__main__":
    unittest.main()
