import json
import os
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def run_collab_probe(probe: str) -> dict:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "proposal_collab_routes.sqlite"
        env = os.environ.copy()
        env.update(
            {
                "DATABASE_URL": f"sqlite:///{db_path.as_posix()}",
                "DB_MODE": "central",
                "SECRET_KEY": "strong-test-secret-for-proposal-collab-routes",
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
        if line.startswith("PROPOSAL_COLLAB_ROUTES_RESULT=")
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
from db_models import Base, ConnectorActionProposal, Notification as RealNotification, ProposalCollab

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
            profile_pic="alice.png",
        )
        bob = backend_app.Harmonizer(
            username="bob",
            email="bob@example.test",
            hashed_password="test",
            bio="collaborator",
            species="ai",
            profile_pic="bob.png",
        )
        cara = backend_app.Harmonizer(
            username="cara",
            email="cara@example.test",
            hashed_password="test",
            bio="wrong user",
            species="company",
            profile_pic="cara.png",
        )
        db.add_all([alice, bob, cara])
        db.commit()
        db.refresh(alice)
        db.refresh(bob)
        db.refresh(cara)

        proposal = backend_app.Proposal(
            title="Collab Route Target",
            description="Target proposal for collab route tests.",
            userName="alice",
            userInitials="AL",
            author_type="human",
            author_img="alice.png",
            author_id=alice.id,
            voting_deadline=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        )
        other_proposal = backend_app.Proposal(
            title="Other Author Target",
            description="Proposal owned by bob.",
            userName="bob",
            userInitials="BO",
            author_type="ai",
            author_img="bob.png",
            author_id=bob.id,
            voting_deadline=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        )
        db.add_all([proposal, other_proposal])
        db.commit()
        db.refresh(proposal)
        db.refresh(other_proposal)
        return {
            "proposal_id": proposal.id,
            "other_proposal_id": other_proposal.id,
            "alice_id": alice.id,
            "bob_id": bob.id,
            "cara_id": cara.id,
        }
    finally:
        db.close()


seeded = seed_context()
alice_token = backend_app._create_wrapper_access_token("alice")
bob_token = backend_app._create_wrapper_access_token("bob")
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
            "collabs": db.query(ProposalCollab).count(),
            "notifications": db.query(RealNotification).count(),
            "votes": db.query(backend_app.ProposalVote).count(),
            "comments": db.query(backend_app.Comment).count(),
            "proposals": db.query(backend_app.Proposal).count(),
        }
    finally:
        db.close()


def collab_rows():
    db = backend_app.SessionLocal()
    try:
        rows = db.query(ProposalCollab).order_by(ProposalCollab.id.asc()).all()
        return [
            {
                "id": row.id,
                "proposal_id": row.proposal_id,
                "author_user_id": row.author_user_id,
                "collaborator_user_id": row.collaborator_user_id,
                "requested_by_user_id": row.requested_by_user_id,
                "status": row.status,
                "responded": bool(row.responded_at),
                "removed": bool(row.removed_at),
            }
            for row in rows
        ]
    finally:
        db.close()


def notification_payloads():
    db = backend_app.SessionLocal()
    try:
        rows = db.query(RealNotification).order_by(RealNotification.id.asc()).all()
        payloads = []
        for row in rows:
            try:
                payloads.append(json.loads(row.message))
            except Exception:
                payloads.append({"raw": row.message})
        return payloads
    finally:
        db.close()


def request_collab(headers=alice_headers, proposal_id=None, collaborator="bob"):
    return client.post(
        "/proposal-collabs/request",
        json={
            "proposal_id": proposal_id or seeded["proposal_id"],
            "collaborator_username": collaborator,
        },
        headers=headers,
    )
"""


class ProposalCollabRouteTests(unittest.TestCase):
    def test_request_collab_requires_author_auth_and_valid_collaborator(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            before = counts()
            body = {"proposal_id": seeded["proposal_id"], "collaborator_username": "bob"}
            missing = client.post("/proposal-collabs/request", json=body)
            invalid = client.post("/proposal-collabs/request", json=body, headers=invalid_headers)
            non_author = request_collab(headers=bob_headers)
            wrong_proposal = request_collab(headers=alice_headers, proposal_id=seeded["other_proposal_id"])
            self_collab = request_collab(headers=alice_headers, collaborator="alice")
            unknown = request_collab(headers=alice_headers, collaborator="ghost")
            ok = request_collab(headers=alice_headers)
            duplicate = request_collab(headers=alice_headers)
            after = counts()
            result = {
                "before": before,
                "after": after,
                "missing_status": missing.status_code,
                "invalid_status": invalid.status_code,
                "non_author_status": non_author.status_code,
                "wrong_proposal_status": wrong_proposal.status_code,
                "self_status": self_collab.status_code,
                "unknown_status": unknown.status_code,
                "ok_status": ok.status_code,
                "duplicate_status": duplicate.status_code,
                "ok_payload": ok.json(),
                "collabs": collab_rows(),
                "notifications": notification_payloads(),
            }
            print("PROPOSAL_COLLAB_ROUTES_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_collab_probe(probe)

        self.assertEqual(result["missing_status"], 401)
        self.assertEqual(result["invalid_status"], 401)
        self.assertEqual(result["non_author_status"], 403)
        self.assertEqual(result["wrong_proposal_status"], 403)
        self.assertEqual(result["self_status"], 400)
        self.assertEqual(result["unknown_status"], 404)
        self.assertEqual(result["ok_status"], 200)
        self.assertEqual(result["duplicate_status"], 409)
        self.assertEqual(result["after"]["collabs"], result["before"]["collabs"] + 1)
        self.assertEqual(result["after"]["notifications"], result["before"]["notifications"] + 1)
        self.assertEqual(len(result["collabs"]), 1)
        self.assertEqual(result["collabs"][0]["status"], "pending")
        self.assertEqual(result["ok_payload"]["collab"]["proposal_title"], "Collab Route Target")
        self.assertEqual(result["ok_payload"]["collab"]["author"]["username"], "alice")
        self.assertEqual(result["ok_payload"]["collab"]["collaborator"]["username"], "bob")
        self.assertEqual(result["ok_payload"]["collab"]["requested_by"], "alice")
        self.assertEqual(result["notifications"][0]["type"], "collab_request")

    def test_list_collabs_is_scoped_by_actor_role_status_limit_and_offset(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            first = request_collab(headers=alice_headers)
            second = client.post(
                "/proposal-collabs/request",
                json={
                    "proposal_id": seeded["other_proposal_id"],
                    "collaborator_username": "cara",
                },
                headers=bob_headers,
            )
            bob_pending = client.get("/proposal-collabs", headers=bob_headers)
            alice_author = client.get("/proposal-collabs?role=author", headers=alice_headers)
            cara_pending = client.get("/proposal-collabs", headers=cara_headers)
            alice_collaborator = client.get("/proposal-collabs", headers=alice_headers)
            invalid_role = client.get("/proposal-collabs?role=viewer", headers=alice_headers)
            invalid_status = client.get("/proposal-collabs?status=active", headers=alice_headers)
            missing = client.get("/proposal-collabs")
            invalid = client.get("/proposal-collabs", headers=invalid_headers)
            clamped = client.get(
                "/proposal-collabs?role=author&limit=999&offset=-5",
                headers=alice_headers,
            )
            result = {
                "first_status": first.status_code,
                "second_status": second.status_code,
                "bob_pending": bob_pending.json(),
                "alice_author": alice_author.json(),
                "cara_pending": cara_pending.json(),
                "alice_collaborator": alice_collaborator.json(),
                "invalid_role_status": invalid_role.status_code,
                "invalid_status_status": invalid_status.status_code,
                "missing_status": missing.status_code,
                "invalid_auth_status": invalid.status_code,
                "clamped": clamped.json(),
            }
            print("PROPOSAL_COLLAB_ROUTES_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_collab_probe(probe)

        self.assertEqual(result["first_status"], 200)
        self.assertEqual(result["second_status"], 200)
        self.assertEqual(result["bob_pending"]["count"], 1)
        self.assertEqual(result["bob_pending"]["role"], "collaborator")
        self.assertEqual(result["bob_pending"]["collabs"][0]["author"]["username"], "alice")
        self.assertEqual(result["alice_author"]["count"], 1)
        self.assertEqual(result["alice_author"]["role"], "author")
        self.assertEqual(result["cara_pending"]["count"], 1)
        self.assertEqual(result["cara_pending"]["collabs"][0]["author"]["username"], "bob")
        self.assertEqual(result["alice_collaborator"]["count"], 0)
        self.assertEqual(result["invalid_role_status"], 400)
        self.assertEqual(result["invalid_status_status"], 400)
        self.assertEqual(result["missing_status"], 401)
        self.assertEqual(result["invalid_auth_status"], 401)
        self.assertEqual(result["clamped"]["limit"], 100)
        self.assertEqual(result["clamped"]["offset"], 0)

    def test_approve_decline_and_remove_enforce_actor_and_status_rules(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            approved_request = request_collab(headers=alice_headers)
            approved_id = approved_request.json()["collab"]["id"]
            wrong_approve = client.post(f"/proposal-collabs/{approved_id}/approve", headers=cara_headers)
            author_approve = client.post(f"/proposal-collabs/{approved_id}/approve", headers=alice_headers)
            approve = client.post(f"/proposal-collabs/{approved_id}/approve", headers=bob_headers)
            reapprove = client.post(f"/proposal-collabs/{approved_id}/approve", headers=bob_headers)
            decline_after_approve = client.post(f"/proposal-collabs/{approved_id}/decline", headers=bob_headers)
            duplicate_after_approve = request_collab(headers=alice_headers)
            collaborator_remove = client.post(f"/proposal-collabs/{approved_id}/remove", headers=bob_headers)
            remove_again = client.post(f"/proposal-collabs/{approved_id}/remove", headers=bob_headers)

            declined_request = request_collab(headers=alice_headers)
            declined_id = declined_request.json()["collab"]["id"]
            decline = client.post(f"/proposal-collabs/{declined_id}/decline", headers=bob_headers)
            approve_after_decline = client.post(f"/proposal-collabs/{declined_id}/approve", headers=bob_headers)
            author_remove_declined = client.post(f"/proposal-collabs/{declined_id}/remove", headers=alice_headers)

            pending_request = request_collab(headers=alice_headers)
            pending_id = pending_request.json()["collab"]["id"]
            wrong_remove = client.post(f"/proposal-collabs/{pending_id}/remove", headers=cara_headers)
            author_remove_pending = client.post(f"/proposal-collabs/{pending_id}/remove", headers=alice_headers)

            result = {
                "wrong_approve_status": wrong_approve.status_code,
                "author_approve_status": author_approve.status_code,
                "approve_status": approve.status_code,
                "reapprove_status": reapprove.status_code,
                "decline_after_approve_status": decline_after_approve.status_code,
                "duplicate_after_approve_status": duplicate_after_approve.status_code,
                "collaborator_remove_status": collaborator_remove.status_code,
                "remove_again_status": remove_again.status_code,
                "decline_status": decline.status_code,
                "approve_after_decline_status": approve_after_decline.status_code,
                "author_remove_declined_status": author_remove_declined.status_code,
                "wrong_remove_status": wrong_remove.status_code,
                "author_remove_pending_status": author_remove_pending.status_code,
                "collabs": collab_rows(),
                "notifications": notification_payloads(),
            }
            print("PROPOSAL_COLLAB_ROUTES_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_collab_probe(probe)

        self.assertEqual(result["wrong_approve_status"], 403)
        self.assertEqual(result["author_approve_status"], 403)
        self.assertEqual(result["approve_status"], 200)
        self.assertEqual(result["reapprove_status"], 409)
        self.assertEqual(result["decline_after_approve_status"], 409)
        self.assertEqual(result["duplicate_after_approve_status"], 409)
        self.assertEqual(result["collaborator_remove_status"], 200)
        self.assertEqual(result["remove_again_status"], 409)
        self.assertEqual(result["decline_status"], 200)
        self.assertEqual(result["approve_after_decline_status"], 409)
        self.assertEqual(result["author_remove_declined_status"], 200)
        self.assertEqual(result["wrong_remove_status"], 403)
        self.assertEqual(result["author_remove_pending_status"], 200)
        statuses = [row["status"] for row in result["collabs"]]
        self.assertEqual(statuses, ["removed", "removed", "removed"])
        self.assertTrue(result["collabs"][0]["responded"])
        self.assertTrue(result["collabs"][0]["removed"])
        notification_types = [payload.get("type") for payload in result["notifications"]]
        self.assertIn("collab_approved", notification_types)
        self.assertIn("collab_declined", notification_types)
        self.assertIn("collab_removed", notification_types)

    def test_notification_failure_does_not_break_collab_state(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            class BrokenNotification:
                def __init__(self, *_args, **_kwargs):
                    raise RuntimeError("notification write failed")

            backend_app.Notification = BrokenNotification
            before = counts()
            response = request_collab(headers=alice_headers)
            after = counts()
            result = {
                "status": response.status_code,
                "before": before,
                "after": after,
                "collabs": collab_rows(),
            }
            print("PROPOSAL_COLLAB_ROUTES_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_collab_probe(probe)

        self.assertEqual(result["status"], 200)
        self.assertEqual(result["after"]["collabs"], result["before"]["collabs"] + 1)
        self.assertEqual(result["after"]["notifications"], result["before"]["notifications"])
        self.assertEqual(result["collabs"][0]["status"], "pending")

    def test_connector_draft_collab_stays_draft_only(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            before = counts()
            response = client.post(
                "/connector/actions/draft-collab-request",
                json={
                    "author": "alice",
                    "proposal_id": seeded["proposal_id"],
                    "collaborator_username": "bob",
                },
                headers=alice_headers,
            )
            after = counts()
            result = {
                "status": response.status_code,
                "payload": response.json(),
                "before": before,
                "after": after,
            }
            print("PROPOSAL_COLLAB_ROUTES_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_collab_probe(probe)

        self.assertEqual(result["status"], 200)
        self.assertEqual(result["payload"]["action_proposal"]["action_type"], "draft_collab_request")
        self.assertFalse(result["payload"]["executed"])
        self.assertEqual(result["after"]["actions"], result["before"]["actions"] + 1)
        self.assertEqual(result["after"]["collabs"], result["before"]["collabs"])
        self.assertEqual(result["after"]["notifications"], result["before"]["notifications"])


if __name__ == "__main__":
    unittest.main()
