import json
import os
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def run_rate_probe(probe: str, env_overrides: dict[str, str] | None = None) -> dict:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "rate_limits.sqlite"
        env = os.environ.copy()
        env.update(
            {
                "DATABASE_URL": f"sqlite:///{db_path.as_posix()}",
                "DB_MODE": "central",
                "SECRET_KEY": "strong-test-secret-for-commons-rate-limits",
                "SUPERNOVA_ENV": "development",
                "APP_ENV": "development",
                "ENV": "development",
                "UPLOADS_DIR": str(Path(tmpdir) / "uploads"),
                "FOLLOWS_STORE_PATH": str(Path(tmpdir) / "follows_store.json"),
            }
        )
        if env_overrides:
            env.update(env_overrides)
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
        if line.startswith("RATE_LIMIT_RESULT=")
    ]
    if not result_lines:
        raise AssertionError(f"probe result missing\nstdout:\n{completed.stdout}")
    return json.loads(result_lines[-1].split("=", 1)[1])


PROBE_PREAMBLE = """
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
import commons_rate_limits
try:
    import backend.commons_rate_limits as app_rate_limits
except Exception:
    app_rate_limits = commons_rate_limits

client = TestClient(backend_app.app)

def reset_rate_limits():
    commons_rate_limits._reset_rate_limit_state_for_tests()
    if app_rate_limits is not commons_rate_limits:
        app_rate_limits._reset_rate_limit_state_for_tests()

reset_rate_limits()

def response_payload(response):
    try:
        body = response.json()
    except Exception:
        body = {}
    return {
        "status": response.status_code,
        "body": body,
        "retry_after": response.headers.get("retry-after"),
        "bucket": response.headers.get("x-supernova-ratelimit-bucket"),
    }
"""


class CommonsRateLimitTests(unittest.TestCase):
    def test_rate_limiter_lives_outside_backend_app(self):
        app_text = (PROJECT_ROOT / "backend" / "app.py").read_text(encoding="utf-8")
        module_text = (PROJECT_ROOT / "backend" / "commons_rate_limits.py").read_text(encoding="utf-8")

        self.assertIn("from .commons_rate_limits import RATE_LIMIT_FRIENDLY_DETAIL, rate_limit_attempt", app_text)
        self.assertIn("rate_limit_attempt(", app_text)
        self.assertIn("rate_limit_metadata", app_text)
        self.assertNotIn("RATE_LIMIT_BUCKET_CONFIG", app_text)
        self.assertNotIn("def _rate_limit_path_bucket", app_text)
        self.assertIn("RATE_LIMIT_BUCKET_CONFIG", module_text)
        self.assertIn("def _rate_limit_path_bucket", module_text)
        self.assertIn('"proposals"', module_text)
        self.assertIn('"comments"', module_text)
        self.assertIn('"votes"', module_text)
        self.assertIn('"follows"', module_text)
        self.assertIn('"ai_actions"', module_text)
        self.assertIn('"reads"', module_text)
        self.assertIn("SUPERNOVA_RATE_LIMIT_READS_PER_MINUTE", module_text)
        self.assertNotIn('"public_reads"', module_text)

    def test_auth_bucket_returns_friendly_429_and_status_is_exempt(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            first = response_payload(client.post("/auth/login", json={}))
            second = response_payload(client.post("/auth/login", json={}))
            health_hits = [response_payload(client.get("/health")) for _ in range(3)]
            status_hits = [response_payload(client.get("/supernova-status")) for _ in range(3)]
            proposal_hits = [
                response_payload(client.get("/proposals?filter=latest&limit=30"))
                for _ in range(3)
            ]
            print("RATE_LIMIT_RESULT=" + json.dumps({
                "first": first,
                "second": second,
                "health_hits": health_hits,
                "status_hits": status_hits,
                "proposal_hits": proposal_hits,
            }, sort_keys=True))
            """
        )
        result = run_rate_probe(
            probe,
            {
                "SUPERNOVA_RATE_LIMIT_ENABLED": "true",
                "SUPERNOVA_RATE_LIMIT_AUTH_PER_MINUTE": "1",
            },
        )

        self.assertNotEqual(result["first"]["status"], 429)
        self.assertEqual(result["second"]["status"], 429)
        self.assertEqual(result["second"]["body"]["error_code"], "rate_limited")
        self.assertEqual(result["second"]["body"]["bucket"], "auth")
        self.assertEqual(result["second"]["body"]["identity_type"], "ip")
        self.assertEqual(result["second"]["body"]["limit"], 1)
        self.assertEqual(result["second"]["body"]["window_seconds"], 60)
        self.assertIn("commons stays reachable", result["second"]["body"]["detail"])
        self.assertTrue(result["second"]["retry_after"])
        serialized_429 = json.dumps(result["second"]["body"], sort_keys=True).lower()
        for forbidden in ("postgres://", "postgresql://", "database_url", "password", "secret"):
            self.assertNotIn(forbidden, serialized_429)
        self.assertTrue(all(hit["status"] != 429 for hit in result["health_hits"]))
        self.assertTrue(all(hit["status"] != 429 for hit in result["status_hits"]))
        self.assertTrue(all(hit["status"] != 429 for hit in result["proposal_hits"]))
        self.assertTrue(all(hit["bucket"] == "reads" for hit in result["proposal_hits"]))

    def test_rate_limit_breach_logs_sanitized_observability_event(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            import io
            import logging

            stream = io.StringIO()
            logger = logging.getLogger("supernova.rate_limits")
            previous_level = logger.level
            handler = logging.StreamHandler(stream)
            handler.setFormatter(logging.Formatter(
                "%(message)s "
                "supernova_rate_limit_bucket=%(supernova_rate_limit_bucket)s "
                "supernova_rate_limit_identity_type=%(supernova_rate_limit_identity_type)s "
                "supernova_rate_limit_retry_after=%(supernova_rate_limit_retry_after)s "
                "supernova_rate_limit_limit=%(supernova_rate_limit_limit)s "
                "supernova_rate_limit_window_seconds=%(supernova_rate_limit_window_seconds)s"
            ))
            logger.setLevel(logging.INFO)
            logger.addHandler(handler)
            try:
                ip_headers = {"X-Forwarded-For": "203.0.113.77"}
                client.post("/auth/login", json={}, headers=ip_headers)
                ip_limited = response_payload(client.post("/auth/login", json={}, headers=ip_headers))
                ip_log = stream.getvalue()
                stream.seek(0)
                stream.truncate(0)

                reset_rate_limits()
                token = backend_app._create_wrapper_access_token("sensitive-alice", user_id=8675309)
                user_headers = {
                    "Authorization": f"Bearer {token}",
                    "X-Forwarded-For": "198.51.100.9",
                }
                client.post("/connector/actions/draft-ai-delegate-review", json={}, headers=user_headers)
                user_limited = response_payload(
                    client.post("/connector/actions/draft-ai-delegate-review", json={}, headers=user_headers)
                )
                user_log = stream.getvalue()
            finally:
                logger.removeHandler(handler)
                logger.setLevel(previous_level)

            print("RATE_LIMIT_RESULT=" + json.dumps({
                "ip_limited": ip_limited,
                "ip_log": ip_log,
                "user_limited": user_limited,
                "user_log": user_log,
            }, sort_keys=True))
            """
        )
        result = run_rate_probe(
            probe,
            {
                "SUPERNOVA_RATE_LIMIT_ENABLED": "true",
                "SUPERNOVA_RATE_LIMIT_AUTH_PER_MINUTE": "1",
                "SUPERNOVA_RATE_LIMIT_AI_GENERATION_PER_MINUTE": "1",
            },
        )

        self.assertEqual(result["ip_limited"]["status"], 429)
        self.assertIn("bucket=auth", result["ip_log"])
        self.assertIn("identity_type=ip", result["ip_log"])
        self.assertIn("limit=1", result["ip_log"])
        self.assertIn("window_seconds=60", result["ip_log"])
        self.assertNotIn("203.0.113.77", result["ip_log"])

        self.assertEqual(result["user_limited"]["status"], 429)
        self.assertIn("bucket=ai_generation", result["user_log"])
        self.assertIn("identity_type=user", result["user_log"])
        self.assertIn("limit=1", result["user_log"])
        self.assertIn("window_seconds=60", result["user_log"])
        self.assertNotIn("sensitive-alice", result["user_log"])
        self.assertNotIn("8675309", result["user_log"])
        self.assertNotIn("198.51.100.9", result["user_log"])

    def test_write_buckets_are_route_specific_and_selected_reads_have_a_bucket(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            def limited_pair(path, method="post"):
                first = response_payload(getattr(client, method)(path, json={}))
                second = response_payload(getattr(client, method)(path, json={}))
                return {"first": first, "second": second}

            ai_generation = limited_pair("/connector/actions/draft-ai-delegate-comment")
            reset_rate_limits()
            ai_action = limited_pair("/connector/actions/not-a-real-action/cancel")
            reset_rate_limits()
            upload = limited_pair("/upload-image")
            reset_rate_limits()
            proposal = limited_pair("/proposals")
            reset_rate_limits()
            comment = limited_pair("/comments")
            reset_rate_limits()
            vote = limited_pair("/votes")
            reset_rate_limits()
            comment_vote = limited_pair("/comments/123/votes")
            reset_rate_limits()
            follow = limited_pair("/follows")
            reset_rate_limits()
            message = limited_pair("/messages")
            reset_rate_limits()
            fallback_write = limited_pair("/profile/alice", method="patch")
            public_feed_hits = [
                response_payload(client.get("/proposals?filter=latest&limit=30"))
                for _ in range(4)
            ]
            print("RATE_LIMIT_RESULT=" + json.dumps({
                "ai_generation": ai_generation,
                "ai_action": ai_action,
                "upload": upload,
                "proposal": proposal,
                "comment": comment,
                "vote": vote,
                "comment_vote": comment_vote,
                "follow": follow,
                "message": message,
                "fallback_write": fallback_write,
                "public_feed_hits": public_feed_hits,
            }, sort_keys=True))
            """
        )
        result = run_rate_probe(
            probe,
            {
                "SUPERNOVA_RATE_LIMIT_ENABLED": "true",
                "SUPERNOVA_RATE_LIMIT_AI_GENERATION_PER_MINUTE": "1",
                "SUPERNOVA_RATE_LIMIT_AI_ACTIONS_PER_MINUTE": "1",
                "SUPERNOVA_RATE_LIMIT_UPLOADS_PER_HOUR": "1",
                "SUPERNOVA_RATE_LIMIT_PROPOSALS_PER_MINUTE": "1",
                "SUPERNOVA_RATE_LIMIT_COMMENTS_PER_MINUTE": "1",
                "SUPERNOVA_RATE_LIMIT_VOTES_PER_MINUTE": "1",
                "SUPERNOVA_RATE_LIMIT_FOLLOWS_PER_MINUTE": "1",
                "SUPERNOVA_RATE_LIMIT_MESSAGES_PER_MINUTE": "1",
                "SUPERNOVA_RATE_LIMIT_WRITES_PER_MINUTE": "1",
                "SUPERNOVA_RATE_LIMIT_READS_PER_MINUTE": "240",
            },
        )

        expected_buckets = {
            "ai_generation": "ai_generation",
            "ai_action": "ai_actions",
            "upload": "uploads",
            "proposal": "proposals",
            "comment": "comments",
            "vote": "votes",
            "comment_vote": "votes",
            "follow": "follows",
            "message": "messages",
            "fallback_write": "writes",
        }
        for key, bucket in expected_buckets.items():
            self.assertNotEqual(result[key]["first"]["status"], 429, key)
            self.assertEqual(result[key]["second"]["status"], 429, key)
            self.assertEqual(result[key]["second"]["body"]["bucket"], bucket, key)
        self.assertTrue(all(hit["status"] != 429 for hit in result["public_feed_hits"]))
        self.assertTrue(all(hit["bucket"] == "reads" for hit in result["public_feed_hits"]))

    def test_selected_public_reads_can_be_rate_limited_without_blocking_status_or_protocol(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            proposal_hits = [
                response_payload(client.get("/proposals?filter=latest&limit=30"))
                for _ in range(3)
            ]
            reset_rate_limits()
            graph_hits = [response_payload(client.get("/social-graph")) for _ in range(3)]
            reset_rate_limits()
            analysis_hits = [response_payload(client.get("/network-analysis/")) for _ in range(3)]
            reset_rate_limits()
            exempt_hits = [
                response_payload(client.get("/health")),
                response_payload(client.get("/supernova-status")),
                response_payload(client.get("/status")),
                response_payload(client.get("/.well-known/supernova")),
                response_payload(client.get("/protocol/supernova.public-ai-reader.schema.json")),
                response_payload(client.get("/core")),
            ]
            print("RATE_LIMIT_RESULT=" + json.dumps({
                "proposal_hits": proposal_hits,
                "graph_hits": graph_hits,
                "analysis_hits": analysis_hits,
                "exempt_hits": exempt_hits,
            }, sort_keys=True))
            """
        )
        result = run_rate_probe(
            probe,
            {
                "SUPERNOVA_RATE_LIMIT_ENABLED": "true",
                "SUPERNOVA_RATE_LIMIT_READS_PER_MINUTE": "2",
            },
        )

        for key in ["proposal_hits", "graph_hits", "analysis_hits"]:
            self.assertNotEqual(result[key][0]["status"], 429, key)
            self.assertNotEqual(result[key][1]["status"], 429, key)
            self.assertEqual(result[key][2]["status"], 429, key)
            self.assertEqual(result[key][2]["body"]["bucket"], "reads", key)
            self.assertIn("commons stays reachable", result[key][2]["body"]["detail"])
            self.assertTrue(result[key][2]["retry_after"])

        self.assertTrue(all(hit["status"] != 429 for hit in result["exempt_hits"]))
        self.assertTrue(all(hit["bucket"] is None for hit in result["exempt_hits"]))

    def test_upload_rate_limit_rejection_does_not_create_partial_file(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            upload_root = Path(backend_app.uploads_dir)
            upload_root.mkdir(parents=True, exist_ok=True)
            png = b"\\x89PNG\\r\\n\\x1a\\n" + b"0" * 64
            before = sorted(path.name for path in upload_root.iterdir())
            first = response_payload(client.post(
                "/upload-image",
                files={"file": ("first.png", png, "image/png")},
            ))
            after_first = sorted(path.name for path in upload_root.iterdir())
            second = response_payload(client.post(
                "/upload-image",
                files={"file": ("second.png", png, "image/png")},
            ))
            after_second = sorted(path.name for path in upload_root.iterdir())
            print("RATE_LIMIT_RESULT=" + json.dumps({
                "first": first,
                "second": second,
                "before_count": len(before),
                "after_first_count": len(after_first),
                "after_second_count": len(after_second),
                "created_after_first": len(after_first) - len(before),
                "created_after_second": len(after_second) - len(after_first),
            }, sort_keys=True))
            """
        )
        result = run_rate_probe(
            probe,
            {
                "SUPERNOVA_RATE_LIMIT_ENABLED": "true",
                "SUPERNOVA_RATE_LIMIT_UPLOADS_PER_HOUR": "1",
            },
        )

        self.assertEqual(result["first"]["status"], 200)
        self.assertEqual(result["second"]["status"], 429)
        self.assertEqual(result["second"]["body"]["bucket"], "uploads")
        self.assertEqual(result["created_after_first"], 1)
        self.assertEqual(result["created_after_second"], 0)

    def test_authenticated_user_keying_is_separate_and_switch_can_disable(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            alice = backend_app._create_wrapper_access_token("alice", user_id=1)
            bob = backend_app._create_wrapper_access_token("bob", user_id=2)
            headers_alice = {"Authorization": f"Bearer {alice}"}
            headers_bob = {"Authorization": f"Bearer {bob}"}
            alice_first = response_payload(client.post("/connector/actions/draft-ai-delegate-review", json={}, headers=headers_alice))
            alice_second = response_payload(client.post("/connector/actions/draft-ai-delegate-review", json={}, headers=headers_alice))
            bob_first = response_payload(client.post("/connector/actions/draft-ai-delegate-review", json={}, headers=headers_bob))
            os.environ["SUPERNOVA_RATE_LIMIT_ENABLED"] = "false"
            reset_rate_limits()
            disabled_first = response_payload(client.post("/auth/login", json={}))
            disabled_second = response_payload(client.post("/auth/login", json={}))
            print("RATE_LIMIT_RESULT=" + json.dumps({
                "alice_first": alice_first,
                "alice_second": alice_second,
                "bob_first": bob_first,
                "disabled_first": disabled_first,
                "disabled_second": disabled_second,
            }, sort_keys=True))
            """
        )
        result = run_rate_probe(
            probe,
            {
                "SUPERNOVA_RATE_LIMIT_ENABLED": "true",
                "SUPERNOVA_RATE_LIMIT_AI_GENERATION_PER_MINUTE": "1",
                "SUPERNOVA_RATE_LIMIT_AUTH_PER_MINUTE": "1",
            },
        )

        self.assertNotEqual(result["alice_first"]["status"], 429)
        self.assertEqual(result["alice_second"]["status"], 429)
        self.assertNotEqual(result["bob_first"]["status"], 429)
        self.assertNotEqual(result["disabled_first"]["status"], 429)
        self.assertNotEqual(result["disabled_second"]["status"], 429)

    def test_alpha_docs_cover_rate_limit_env_and_rollback(self):
        checklist = (PROJECT_ROOT / "ALPHA_QA_CHECKLIST.md").read_text(encoding="utf-8")
        sprint = (PROJECT_ROOT / "NEXT_STABILITY_SPRINT.md").read_text(encoding="utf-8")

        for name in [
            "SUPERNOVA_RATE_LIMIT_ENABLED",
            "SUPERNOVA_RATE_LIMIT_AUTH_PER_MINUTE",
            "SUPERNOVA_RATE_LIMIT_UPLOADS_PER_HOUR",
            "SUPERNOVA_RATE_LIMIT_AI_GENERATION_PER_MINUTE",
            "SUPERNOVA_RATE_LIMIT_AI_ACTIONS_PER_MINUTE",
            "SUPERNOVA_RATE_LIMIT_PROPOSALS_PER_MINUTE",
            "SUPERNOVA_RATE_LIMIT_COMMENTS_PER_MINUTE",
            "SUPERNOVA_RATE_LIMIT_VOTES_PER_MINUTE",
            "SUPERNOVA_RATE_LIMIT_FOLLOWS_PER_MINUTE",
            "SUPERNOVA_RATE_LIMIT_WRITES_PER_MINUTE",
            "SUPERNOVA_RATE_LIMIT_MESSAGES_PER_MINUTE",
            "SUPERNOVA_RATE_LIMIT_READS_PER_MINUTE",
        ]:
            self.assertIn(name, checklist)
        self.assertIn("Selected expensive public GET reads share the `reads` bucket", checklist)
        self.assertIn("Health, status, protocol, core, connector discovery, and static upload reads stay exempt", checklist)
        self.assertIn("SUPERNOVA_RATE_LIMIT_ENABLED=false", checklist)
        self.assertIn("not paywalls", checklist)
        self.assertIn("Redis-backed buckets only when `REDIS_URL` is configured", sprint)
        self.assertIn("router split", sprint.lower())
        self.assertIn("Branch Protection", sprint)


if __name__ == "__main__":
    unittest.main()
