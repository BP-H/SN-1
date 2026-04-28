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
        db_path = Path(tmpdir) / "db_indexes.sqlite"
        secret = "strong-test-secret-for-db-indexes"
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
        line for line in completed.stdout.splitlines() if line.startswith("DB_INDEX_RESULT=")
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
    from db_models import Base


    def current_bind():
        session = backend_app.SessionLocal()
        try:
            return session.get_bind()
        finally:
            session.close()


    def index_names(db, table_name):
        rows = db.execute(text(f"PRAGMA index_list({table_name})")).fetchall()
        return sorted(getattr(row, "_mapping", row)["name"] for row in rows)


    def index_columns(db, index_name):
        rows = db.execute(text(f"PRAGMA index_info({index_name})")).fetchall()
        return [getattr(row, "_mapping", row)["name"] for row in rows]


    Base.metadata.create_all(bind=current_bind())

    db = backend_app.SessionLocal()
    try:
        backend_app._ensure_comment_thread_columns(db)
        backend_app._ensure_direct_messages_table(db)
        backend_app._ensure_comment_thread_columns(db)
        backend_app._ensure_direct_messages_table(db)

        comments_indexes = index_names(db, "comments")
        direct_messages_indexes = index_names(db, "direct_messages")
        result = {
            "comments_indexes": comments_indexes,
            "direct_messages_indexes": direct_messages_indexes,
            "index_columns": {
                "idx_comments_proposal_created_id": index_columns(
                    db, "idx_comments_proposal_created_id"
                ),
                "idx_comments_parent_created_id": index_columns(
                    db, "idx_comments_parent_created_id"
                ),
                "idx_direct_messages_conversation_created_id": index_columns(
                    db, "idx_direct_messages_conversation_created_id"
                ),
            },
        }
    finally:
        db.close()

    print("DB_INDEX_RESULT=" + json.dumps(result, sort_keys=True))
    """
)


class DbIndexTests(unittest.TestCase):
    def test_read_path_indexes_are_created_idempotently(self):
        result = run_probe(PROBE)

        self.assertIn("idx_comments_proposal_created_id", result["comments_indexes"])
        self.assertIn("idx_comments_parent_created_id", result["comments_indexes"])
        self.assertIn(
            "idx_direct_messages_conversation_created_id",
            result["direct_messages_indexes"],
        )
        self.assertEqual(
            result["index_columns"]["idx_comments_proposal_created_id"],
            ["proposal_id", "created_at", "id"],
        )
        self.assertEqual(
            result["index_columns"]["idx_comments_parent_created_id"],
            ["parent_comment_id", "created_at", "id"],
        )
        self.assertEqual(
            result["index_columns"]["idx_direct_messages_conversation_created_id"],
            ["conversation_id", "created_at", "id"],
        )

    def test_existing_direct_message_indexes_are_preserved(self):
        result = run_probe(PROBE)

        existing_names = {
            "idx_direct_messages_conversation",
            "idx_direct_messages_sender",
            "idx_direct_messages_recipient",
        }
        self.assertTrue(existing_names.issubset(set(result["direct_messages_indexes"])))


if __name__ == "__main__":
    unittest.main()
