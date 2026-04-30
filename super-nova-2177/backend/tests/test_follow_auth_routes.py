import sys
import textwrap
import unittest
from pathlib import Path


TESTS_DIR = Path(__file__).resolve().parent
if str(TESTS_DIR) not in sys.path:
    sys.path.insert(0, str(TESTS_DIR))

from test_auth_bound_write_routes import PROBE_PREAMBLE, run_auth_probe


class FollowAuthRoutesTests(unittest.TestCase):
    def test_follow_requires_matching_bearer_identity(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            body = {"follower": "alice", "target": "bob"}
            missing = client.post("/follows", json=body)
            invalid = client.post("/follows", json=body, headers=invalid_headers)
            wrong = client.post("/follows", json=body, headers=bob_headers)
            matching = client.post("/follows", json=body, headers=alice_headers)
            public_read = client.get("/follows?user=alice")
            result = {
                "missing_status": missing.status_code,
                "invalid_status": invalid.status_code,
                "wrong_status": wrong.status_code,
                "matching_status": matching.status_code,
                "matching_payload": matching.json(),
                "public_following": public_read.json().get("following", []),
            }
            print("AUTH_BOUND_WRITE_ROUTES_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_auth_probe(probe)

        self.assertEqual(result["missing_status"], 401)
        self.assertEqual(result["invalid_status"], 401)
        self.assertEqual(result["wrong_status"], 403)
        self.assertEqual(result["matching_status"], 200)
        self.assertEqual(
            result["matching_payload"],
            {"following": True, "follower": "alice", "target": "bob"},
        )
        self.assertEqual(len(result["public_following"]), 1)
        self.assertEqual(result["public_following"][0]["username"], "bob")

    def test_unfollow_requires_matching_bearer_identity(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            body = {"follower": "alice", "target": "bob"}
            client.post("/follows", json=body, headers=alice_headers)
            missing = client.delete("/follows?follower=alice&target=bob")
            invalid = client.delete("/follows?follower=alice&target=bob", headers=invalid_headers)
            wrong = client.delete("/follows?follower=alice&target=bob", headers=bob_headers)
            matching = client.delete("/follows?follower=alice&target=bob", headers=alice_headers)
            public_read = client.get("/follows?user=alice")
            result = {
                "missing_status": missing.status_code,
                "invalid_status": invalid.status_code,
                "wrong_status": wrong.status_code,
                "matching_status": matching.status_code,
                "matching_payload": matching.json(),
                "public_following": public_read.json().get("following", []),
            }
            print("AUTH_BOUND_WRITE_ROUTES_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_auth_probe(probe)

        self.assertEqual(result["missing_status"], 401)
        self.assertEqual(result["invalid_status"], 401)
        self.assertEqual(result["wrong_status"], 403)
        self.assertEqual(result["matching_status"], 200)
        self.assertEqual(
            result["matching_payload"],
            {"following": False, "follower": "alice", "target": "bob"},
        )
        self.assertEqual(result["public_following"], [])


if __name__ == "__main__":
    unittest.main()
