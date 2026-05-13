import json
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace


ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
for path in (ROOT, BACKEND_DIR):
    path_str = str(path)
    if path_str not in sys.path:
        sys.path.insert(0, path_str)

from ai_delegate_duplicate_guard import (  # noqa: E402
    _compact_payload,
    _duplicate_ai_delegate_comment_response,
    _payload_parent_comment_id,
    _safe_int,
)


class AiDelegateDuplicateGuardTests(unittest.TestCase):
    def test_safe_int_handles_expected_values(self):
        self.assertEqual(_safe_int(7), 7)
        self.assertEqual(_safe_int("8"), 8)
        self.assertIsNone(_safe_int(""))
        self.assertIsNone(_safe_int(None))
        self.assertIsNone(_safe_int("not-a-number"))
        self.assertIsNone(_safe_int(object()))

    def test_compact_payload_handles_dicts_json_and_invalid_values(self):
        payload = {"ai_actor_id": 12}

        self.assertIs(_compact_payload(payload), payload)
        self.assertEqual(_compact_payload('{"ai_actor_id": 12}'), payload)
        self.assertEqual(_compact_payload('["not", "a", "dict"]'), {})
        self.assertEqual(_compact_payload("{invalid json"), {})
        self.assertEqual(_compact_payload(""), {})
        self.assertEqual(_compact_payload(123), {})

    def test_payload_parent_comment_id_finds_first_parent_across_payloads(self):
        self.assertEqual(
            _payload_parent_comment_id({"other": 1}, {"parent_comment_id": "44"}),
            44,
        )
        self.assertIsNone(_payload_parent_comment_id({"parent_comment_id": ""}, {"parent_comment_id": 55}))
        self.assertIsNone(_payload_parent_comment_id({"other": 1}, {"still_other": 2}))

    def test_duplicate_response_preserves_top_level_draft_shape(self):
        action = self._action(status="draft", action_type="draft_ai_comment")

        response = self._duplicate_response(existing={"action": action, "status": "draft"})

        self.assertEqual(response["mode"], "duplicate_guard")
        self.assertFalse(response["executed"])
        self.assertTrue(response["duplicate"])
        self.assertEqual(response["summary"]["duplicate_scope"], "top_level_comment")
        self.assertEqual(response["summary"]["duplicate_reason"], "draft")
        self.assertIn("pending standalone comment draft", response["summary"]["message"])
        self.assertEqual(response["action_proposal"]["id"], 123)
        self.assertTrue(response["safety"]["duplicate_guard"])
        self.assertTrue(response["safety"]["requires_approval"])
        self.assertTrue(response["safety"]["no_write_action_performed"])

    def test_duplicate_response_preserves_reply_draft_shape(self):
        action = self._action(status="draft", action_type="draft_ai_comment")

        response = self._duplicate_response(
            existing={"action": action, "status": "draft"},
            parent_comment_id=88,
        )

        self.assertEqual(response["summary"]["duplicate_scope"], "comment_reply")
        self.assertEqual(response["summary"]["parent_comment_id"], 88)
        self.assertIn("pending reply draft", response["summary"]["message"])

    def test_duplicate_response_preserves_published_standalone_message(self):
        comment = SimpleNamespace(id=456)

        response = self._duplicate_response(existing={"comment": comment, "status": "published"})

        self.assertEqual(response["summary"]["duplicate_scope"], "top_level_comment")
        self.assertEqual(response["summary"]["existing_comment_id"], 456)
        self.assertIn("standalone AI-authored comment", response["summary"]["message"])

    def test_duplicate_response_preserves_published_reply_message(self):
        comment = SimpleNamespace(id=789)

        response = self._duplicate_response(
            existing={"comment": comment, "status": "published"},
            parent_comment_id=90,
        )

        self.assertEqual(response["summary"]["duplicate_scope"], "comment_reply")
        self.assertEqual(response["summary"]["existing_comment_id"], 789)
        self.assertIn("AI-authored reply", response["summary"]["message"])

    def test_duplicate_response_does_not_include_sensitive_private_fields(self):
        action = self._action(status="draft", action_type="draft_ai_comment")
        action.database_url = "postgres://user:password@example.internal/db"
        action.privateNotifications = [{"body": "do not leak"}]
        action.email = "delegate@example.com"
        action.token = "secret-token-value"

        response = self._duplicate_response(existing={"action": action, "status": "draft"})
        flattened_keys = set()

        def collect_keys(value):
            if isinstance(value, dict):
                for key, nested in value.items():
                    flattened_keys.add(str(key))
                    collect_keys(nested)
            elif isinstance(value, list):
                for nested in value:
                    collect_keys(nested)

        collect_keys(response)
        self.assertFalse(
            {
                "database_url",
                "DATABASE_URL",
                "privateNotifications",
                "private_notifications",
                "email",
                "token",
                "password",
            }
            & flattened_keys
        )
        serialized = json.dumps(response)
        self.assertNotIn("postgres://", serialized)
        self.assertNotIn("example.internal", serialized)
        self.assertNotIn("secret-token-value", serialized)
        self.assertNotIn("delegate@example.com", serialized)

    @staticmethod
    def _action(*, status: str, action_type: str):
        return SimpleNamespace(
            id=123,
            status=status,
            action_type=action_type,
            actor_user_id=22,
            target_type="proposal_ai_comment",
            target_id="77",
        )

    @staticmethod
    def _duplicate_response(*, existing, parent_comment_id=None):
        return _duplicate_ai_delegate_comment_response(
            existing=existing,
            proposal_id=77,
            proposal_title="Public proposal",
            ai_actor_id=12,
            ai_actor_username="nova-reviewer",
            parent_comment_id=parent_comment_id,
        )


if __name__ == "__main__":
    unittest.main()
