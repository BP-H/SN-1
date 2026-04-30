import sys
import textwrap
import unittest
from pathlib import Path


TESTS_DIR = Path(__file__).resolve().parent
if str(TESTS_DIR) not in sys.path:
    sys.path.insert(0, str(TESTS_DIR))

from test_auth_bound_write_routes import PROBE_PREAMBLE, run_auth_probe


class CommentAuthRoutesTests(unittest.TestCase):
    def test_comment_create_rejects_registered_username_spoofing(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            seeded = seed_comment_target(author="alice", proposal_owner="bob")
            body = {
                "proposal_id": seeded["proposal_id"],
                "user": "alice",
                "species": "human",
                "comment": "account-bound comment",
            }
            missing = client.post("/comments", json=body)
            invalid = client.post("/comments", json=body, headers=invalid_headers)
            wrong = client.post("/comments", json=body, headers=bob_headers)
            matching = client.post("/comments", json=body, headers=alice_headers)
            result = {
                "missing_status": missing.status_code,
                "invalid_status": invalid.status_code,
                "wrong_status": wrong.status_code,
                "matching_status": matching.status_code,
                "matching_user": matching.json().get("comments", [{}])[0].get("user"),
            }
            print("AUTH_BOUND_WRITE_ROUTES_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_auth_probe(probe)

        self.assertEqual(result["missing_status"], 401)
        self.assertEqual(result["invalid_status"], 401)
        self.assertEqual(result["wrong_status"], 403)
        self.assertEqual(result["matching_status"], 200)
        self.assertEqual(result["matching_user"], "alice")

    def test_comment_edit_rejects_missing_or_wrong_author_token(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            seeded = seed_comment_target(author="alice", proposal_owner="bob")
            comment_id = seeded["comment_id"]
            missing = client.patch(
                f"/comments/{comment_id}",
                json={"user": "alice", "comment": "missing token edit"},
            )
            invalid = client.patch(
                f"/comments/{comment_id}",
                json={"user": "alice", "comment": "invalid token edit"},
                headers=invalid_headers,
            )
            wrong = client.patch(
                f"/comments/{comment_id}",
                json={"user": "alice", "comment": "wrong user edit"},
                headers=bob_headers,
            )
            matching = client.patch(
                f"/comments/{comment_id}",
                json={"user": "alice", "comment": "edited by author"},
                headers=alice_headers,
            )
            result = {
                "missing_status": missing.status_code,
                "invalid_status": invalid.status_code,
                "wrong_status": wrong.status_code,
                "matching_status": matching.status_code,
                "matching_comment": matching.json().get("comment"),
            }
            print("AUTH_BOUND_WRITE_ROUTES_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_auth_probe(probe)

        self.assertEqual(result["missing_status"], 401)
        self.assertEqual(result["invalid_status"], 401)
        self.assertEqual(result["wrong_status"], 403)
        self.assertEqual(result["matching_status"], 200)
        self.assertEqual(result["matching_comment"], "edited by author")

    def test_comment_delete_requires_author_or_proposal_owner_token(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            author_seeded = seed_comment_target(
                author="alice",
                proposal_owner="bob",
                content="author-owned delete",
            )
            author_comment_id = author_seeded["comment_id"]
            missing = client.delete(f"/comments/{author_comment_id}?user=alice")
            invalid = client.delete(
                f"/comments/{author_comment_id}?user=alice",
                headers=invalid_headers,
            )
            wrong = client.delete(
                f"/comments/{author_comment_id}?user=alice",
                headers=cara_headers,
            )
            matching_author = client.delete(
                f"/comments/{author_comment_id}?user=alice",
                headers=alice_headers,
            )

            owner_seeded = seed_comment_target(
                author="alice",
                proposal_owner="bob",
                content="owner-moderated delete",
            )
            owner_comment_id = owner_seeded["comment_id"]
            matching_owner = client.delete(
                f"/comments/{owner_comment_id}?user=bob",
                headers=bob_headers,
            )
            result = {
                "missing_status": missing.status_code,
                "invalid_status": invalid.status_code,
                "wrong_status": wrong.status_code,
                "matching_author_status": matching_author.status_code,
                "matching_author_deleted": matching_author.json().get("deleted"),
                "matching_owner_status": matching_owner.status_code,
                "matching_owner_deleted": matching_owner.json().get("deleted"),
            }
            print("AUTH_BOUND_WRITE_ROUTES_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_auth_probe(probe)

        self.assertEqual(result["missing_status"], 401)
        self.assertEqual(result["invalid_status"], 401)
        self.assertEqual(result["wrong_status"], 403)
        self.assertEqual(result["matching_author_status"], 200)
        self.assertTrue(result["matching_author_deleted"])
        self.assertEqual(result["matching_owner_status"], 200)
        self.assertTrue(result["matching_owner_deleted"])


if __name__ == "__main__":
    unittest.main()
