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
        db_path = Path(tmpdir) / "proposal_collabs.sqlite"
        secret = "strong-test-secret-for-proposal-collabs"
        env = os.environ.copy()
        env.update(
            {
                "DATABASE_URL": f"sqlite:///{db_path.as_posix()}",
                "DB_MODE": "central",
                "SECRET_KEY": secret,
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

        combined_output = f"{completed.stdout}\n{completed.stderr}"
        if db_path.as_posix() in combined_output or secret in combined_output:
            raise AssertionError("probe printed a DB URL/path or secret value")

    if completed.returncode != 0:
        raise AssertionError(
            f"probe failed\nstdout:\n{completed.stdout}\nstderr:\n{completed.stderr}"
        )
    result_lines = [
        line
        for line in completed.stdout.splitlines()
        if line.startswith("PROPOSAL_COLLAB_MODEL_RESULT=")
    ]
    if not result_lines:
        raise AssertionError(f"probe result missing\nstdout:\n{completed.stdout}")
    return json.loads(result_lines[-1].split("=", 1)[1])


PROBE = textwrap.dedent(
    """
    import json
    import sys
    from pathlib import Path

    from sqlalchemy import text

    project_root = Path.cwd()
    backend_dir = project_root / "backend"
    for path in (project_root, backend_dir):
        path_text = str(path)
        if path_text not in sys.path:
            sys.path.insert(0, path_text)

    import backend.app as backend_app
    from db_models import Base, PROPOSAL_COLLAB_STATUSES, ProposalCollab


    def current_bind():
        session = backend_app.SessionLocal()
        try:
            return session.get_bind()
        finally:
            session.close()


    def table_columns(db, table_name):
        rows = db.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
        return {
            getattr(row, "_mapping", row)["name"]: {
                "notnull": int(getattr(row, "_mapping", row)["notnull"]),
                "type": str(getattr(row, "_mapping", row)["type"]),
            }
            for row in rows
        }


    def index_names(db, table_name):
        rows = db.execute(text(f"PRAGMA index_list({table_name})")).fetchall()
        return sorted(getattr(row, "_mapping", row)["name"] for row in rows)


    def index_columns(db, index_name):
        rows = db.execute(text(f"PRAGMA index_info({index_name})")).fetchall()
        return [getattr(row, "_mapping", row)["name"] for row in rows]


    Base.metadata.create_all(bind=current_bind())
    Base.metadata.create_all(bind=current_bind())

    db = backend_app.SessionLocal()
    try:
        columns = table_columns(db, "proposal_collabs")
        indexes = index_names(db, "proposal_collabs")
        result = {
            "columns": columns,
            "indexes": indexes,
            "index_columns": {
                "idx_proposal_collabs_proposal_collaborator_status": index_columns(
                    db,
                    "idx_proposal_collabs_proposal_collaborator_status",
                ),
                "idx_proposal_collabs_collaborator_status_requested": index_columns(
                    db,
                    "idx_proposal_collabs_collaborator_status_requested",
                ),
            },
            "model_columns": sorted(ProposalCollab.__table__.columns.keys()),
            "statuses": list(PROPOSAL_COLLAB_STATUSES),
            "status_default": str(ProposalCollab.__table__.c.status.default.arg),
        }
    finally:
        db.close()

    print("PROPOSAL_COLLAB_MODEL_RESULT=" + json.dumps(result, sort_keys=True))
    """
)


class ProposalCollabModelTests(unittest.TestCase):
    def test_proposal_collabs_table_is_created_idempotently(self):
        result = run_probe(PROBE)

        expected_columns = {
            "id",
            "proposal_id",
            "author_user_id",
            "collaborator_user_id",
            "requested_by_user_id",
            "status",
            "requested_at",
            "responded_at",
            "removed_at",
        }
        self.assertEqual(set(result["columns"]), expected_columns)
        self.assertEqual(set(result["model_columns"]), expected_columns)

    def test_proposal_collabs_columns_match_contract(self):
        result = run_probe(PROBE)

        required_columns = {
            "proposal_id",
            "author_user_id",
            "collaborator_user_id",
            "requested_by_user_id",
            "status",
            "requested_at",
        }
        for column_name in required_columns:
            self.assertEqual(result["columns"][column_name]["notnull"], 1)

        self.assertEqual(
            result["statuses"],
            ["pending", "approved", "declined", "removed"],
        )
        self.assertEqual(result["status_default"], "pending")

    def test_proposal_collabs_indexes_match_contract(self):
        result = run_probe(PROBE)

        self.assertIn(
            "idx_proposal_collabs_proposal_collaborator_status",
            result["indexes"],
        )
        self.assertIn(
            "idx_proposal_collabs_collaborator_status_requested",
            result["indexes"],
        )
        self.assertEqual(
            result["index_columns"]["idx_proposal_collabs_proposal_collaborator_status"],
            ["proposal_id", "collaborator_user_id", "status"],
        )
        self.assertEqual(
            result["index_columns"]["idx_proposal_collabs_collaborator_status_requested"],
            ["collaborator_user_id", "status", "requested_at"],
        )


if __name__ == "__main__":
    unittest.main()
