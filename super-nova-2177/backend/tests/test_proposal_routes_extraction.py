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


def run_proposal_snapshot_probe(probe: str) -> dict:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "proposal_route_snapshots.sqlite"
        env = os.environ.copy()
        env.update(
            {
                "DATABASE_URL": f"sqlite:///{db_path.as_posix()}",
                "DB_MODE": "central",
                "SECRET_KEY": "strong-test-secret-for-proposal-route-snapshots",
                "SUPERNOVA_ENV": "development",
                "APP_ENV": "development",
                "ENV": "development",
                "UPLOADS_DIR": str(Path(tmpdir) / "uploads"),
            }
        )
        env.pop("RAILWAY_ENVIRONMENT", None)
        env.pop("ENABLE_BULK_PROPOSAL_DELETE", None)

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
        if line.startswith("PROPOSAL_ROUTE_SNAPSHOT_RESULT=")
    ]
    if not result_lines:
        raise AssertionError(f"probe result missing\nstdout:\n{completed.stdout}")
    return json.loads(result_lines[-1].split("=", 1)[1])


PROPOSAL_SNAPSHOT_PROBE = textwrap.dedent(
    """
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
        db.add(alice)
        db.commit()
    finally:
        db.close()

    headers = {"Authorization": f"Bearer {backend_app._create_wrapper_access_token('alice')}"}
    form = {
        "title": "Neighborhood Climate Commons",
        "body": "Create a shared cooling and tree-care protocol for public blocks.",
        "author": "alice",
        "author_type": "human",
        "link": "https://example.test/climate-commons",
        "media_layout": "grid",
        "governance_kind": "decision",
        "decision_level": "important",
        "voting_days": "5",
        "execution_mode": "manual",
    }
    created = client.post("/proposals", data=form, headers=headers)
    created_payload = created.json()
    proposal_id = created_payload.get("id")
    listed = client.get("/proposals?filter=latest&limit=10")
    detail = client.get(f"/proposals/{proposal_id}")
    missing = client.get("/proposals/987654321")
    tally = client.get(f"/proposals/{proposal_id}/tally-weighted")
    decision = client.post(f"/decide/{proposal_id}?threshold=0.6")
    decisions = client.get("/decisions")
    decision_id = (decision.json() if decision.status_code == 200 else {}).get("id") or 1
    run = client.post("/runs", params={"decision_id": decision_id})
    runs = client.get("/runs")

    first_listed = listed.json()[0] if listed.status_code == 200 and listed.json() else {}
    detail_payload = detail.json() if detail.status_code == 200 else {}
    result = {
        "created_status": created.status_code,
        "created_keys": sorted(created_payload.keys()),
        "created_media": created_payload.get("media"),
        "created_title": created_payload.get("title"),
        "created_userName": created_payload.get("userName"),
        "list_status": listed.status_code,
        "list_count": len(listed.json()) if listed.status_code == 200 else 0,
        "list_first_keys": sorted(first_listed.keys()),
        "detail_status": detail.status_code,
        "detail_keys": sorted(detail_payload.keys()),
        "detail_media": detail_payload.get("media"),
        "missing_status": missing.status_code,
        "missing_detail": missing.json().get("detail"),
        "tally_status": tally.status_code,
        "tally_keys": sorted(tally.json().keys()) if tally.status_code == 200 and isinstance(tally.json(), dict) else [],
        "decision_status": decision.status_code,
        "decision_keys": sorted(decision.json().keys()) if decision.status_code == 200 else [],
        "decisions_status": decisions.status_code,
        "run_status": run.status_code,
        "runs_status": runs.status_code,
        "run_keys": sorted(run.json().keys()) if run.status_code == 200 else [],
    }
    print("PROPOSAL_ROUTE_SNAPSHOT_RESULT=" + json.dumps(result, sort_keys=True))
    """
)


class ProposalRoutesExtractionTests(unittest.TestCase):
    def test_proposal_routes_are_registered_from_dedicated_router(self):
        app_text = (BACKEND_DIR / "app.py").read_text(encoding="utf-8")
        module_text = (BACKEND_DIR / "routers" / "proposals.py").read_text(encoding="utf-8")

        self.assertIn("from .routers.proposals import create_proposals_router", app_text)
        self.assertIn("app.include_router(create_proposals_router(", app_text)
        for app_decorator in [
            '@app.get("/proposals"',
            '@app.post("/proposals"',
            '@app.get("/proposals/{pid}"',
            '@app.patch("/proposals/{pid}"',
            '@app.delete("/proposals/{pid}"',
            '@app.delete("/proposals"',
            '@app.get("/proposals/{pid}/tally-weighted"',
            '@app.post("/decide/{pid}"',
            '@app.get("/decisions"',
            '@app.post("/runs"',
            '@app.get("/runs"',
        ]:
            self.assertNotIn(app_decorator, app_text)

        for path in [
            '"/proposals"',
            '"/proposals/{pid}"',
            '"/proposals/{pid}/tally-weighted"',
            '"/decide/{pid}"',
            '"/decisions"',
            '"/runs"',
        ]:
            self.assertIn(f"router.add_api_route(\n        {path}", module_text)

        registered = {}
        expected = {
            "/proposals": {"GET", "POST", "DELETE"},
            "/proposals/{pid}": {"GET", "PATCH", "DELETE"},
            "/proposals/{pid}/tally-weighted": {"GET"},
            "/decide/{pid}": {"POST"},
            "/decisions": {"GET"},
            "/runs": {"GET", "POST"},
        }
        for route in backend_app.app.routes:
            path = getattr(route, "path", "")
            if path in expected:
                registered.setdefault(path, set()).update(getattr(route, "methods", set()) or set())

        self.assertEqual({path: expected[path] for path in expected}, registered)

    def test_comment_and_vote_route_wrappers_are_not_in_proposal_router(self):
        module_text = (BACKEND_DIR / "routers" / "proposals.py").read_text(encoding="utf-8")

        for route_fragment in [
            '"/comments"',
            '"/comments/{comment_id}"',
            '"/comments/{comment_id}/votes"',
            '"/system-vote"',
            '"/connector/proposals"',
        ]:
            self.assertNotIn(route_fragment, module_text)

    def test_proposal_route_response_snapshots_cover_core_contract(self):
        result = run_proposal_snapshot_probe(PROPOSAL_SNAPSHOT_PROBE)

        self.assertEqual(result["created_status"], 200)
        self.assertEqual(result["created_title"], "Neighborhood Climate Commons")
        self.assertEqual(result["created_userName"], "alice")
        for key in ["id", "title", "text", "userName", "media", "likes", "dislikes", "comments"]:
            self.assertIn(key, result["created_keys"])
            self.assertIn(key, result["detail_keys"])
        self.assertEqual(result["list_status"], 200)
        self.assertGreaterEqual(result["list_count"], 1)
        self.assertIn("media", result["list_first_keys"])
        self.assertEqual(result["detail_status"], 200)
        self.assertEqual(result["missing_status"], 404)
        self.assertEqual(result["missing_detail"], "Proposal not found")
        self.assertEqual(result["created_media"]["layout"], "grid")
        self.assertEqual(result["created_media"]["link"], "https://example.test/climate-commons")
        self.assertEqual(result["created_media"]["governance"]["kind"], "decision")
        self.assertEqual(result["created_media"]["governance"]["decision_level"], "important")
        self.assertEqual(result["detail_media"]["governance"]["voting_days"], 5)
        self.assertIn(result["tally_status"], {200, 501})
        if result["tally_status"] == 200:
            self.assertTrue(result["tally_keys"])
        self.assertEqual(result["decision_status"], 200)
        self.assertEqual(result["decision_keys"], ["id", "proposal_id", "status"])
        self.assertEqual(result["decisions_status"], 200)
        self.assertEqual(result["run_status"], 200)
        self.assertEqual(result["run_keys"], ["decision_id", "id", "status"])
        self.assertEqual(result["runs_status"], 200)


if __name__ == "__main__":
    unittest.main()
