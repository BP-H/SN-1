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

from connector_action_response_helpers import (  # noqa: E402
    connector_action_list_response,
    connector_cancel_action_response,
    connector_draft_ai_review_summary,
    connector_draft_collab_request_summary,
    connector_draft_comment_summary,
    connector_draft_proposal_summary,
    connector_draft_vote_summary,
)


class ConnectorActionResponseHelperTests(unittest.TestCase):
    def test_action_list_response_preserves_shape(self):
        rows = [SimpleNamespace(id=1), SimpleNamespace(id=2)]

        response = connector_action_list_response(
            rows,
            limit=25,
            offset=5,
            serialize_connector_action=lambda row: {"id": row.id, "status": "draft"},
        )

        self.assertEqual(
            response,
            {
                "ok": True,
                "actions": [{"id": 1, "status": "draft"}, {"id": 2, "status": "draft"}],
                "count": 2,
                "limit": 25,
                "offset": 5,
            },
        )

    def test_cancel_action_response_preserves_safety_payload(self):
        action = SimpleNamespace(id=10, status="canceled")

        response = connector_cancel_action_response(
            action,
            serialize_connector_action=lambda row: {"id": row.id, "status": row.status},
        )

        self.assertEqual(response["ok"], True)
        self.assertEqual(response["action"], {"id": 10, "status": "canceled"})
        self.assertFalse(response["executed"])
        self.assertEqual(
            response["safety"],
            {
                "canceled_only": True,
                "no_write_action_performed": True,
            },
        )

    def test_draft_vote_summary_preserves_existing_keys(self):
        summary = connector_draft_vote_summary(
            actor=SimpleNamespace(username="alice"),
            proposal=SimpleNamespace(id=77),
            fallback_proposal_id=70,
            proposal_title="Public proposal",
            choice={"intended_choice": "support", "normalized_vote": "up"},
        )

        self.assertEqual(
            summary,
            {
                "action": "draft_vote",
                "actor": "alice",
                "proposal_id": 77,
                "proposal_title": "Public proposal",
                "intended_choice": "support",
                "normalized_vote": "up",
            },
        )

    def test_draft_ai_review_summary_preserves_custody_metadata(self):
        summary = connector_draft_ai_review_summary(
            actor=SimpleNamespace(username="reviewer-ai"),
            proposal=SimpleNamespace(id=88),
            fallback_proposal_id=80,
            proposal_title="AI review target",
            actor_metadata={"ai_actor_id": 12, "charter_name": "Review Charter"},
            rationale="Looks ready for alpha review.",
            reasoning_hash="hash-123",
            confidence="medium",
            choice={"intended_choice": "support", "normalized_vote": "up"},
        )

        self.assertEqual(summary["action"], "draft_ai_review")
        self.assertEqual(summary["actor"], "reviewer-ai")
        self.assertEqual(summary["actor_species"], "ai")
        self.assertEqual(summary["ai_actor_id"], 12)
        self.assertEqual(summary["proposal_id"], 88)
        self.assertEqual(summary["rationale"], "Looks ready for alpha review.")
        self.assertEqual(summary["reasoning_summary"], "Looks ready for alpha review.")
        self.assertEqual(summary["reasoning_hash"], "hash-123")
        self.assertEqual(summary["confidence"], "medium")
        self.assertFalse(summary["sealed_reasoning"])
        self.assertEqual(summary["reasoning_source"], "ai_actor_submitted_draft")
        self.assertEqual(summary["approval_effect"], "Publish one AI vote and one AI rationale comment.")

    def test_simple_draft_summaries_preserve_shapes(self):
        actor = SimpleNamespace(username="alice")
        proposal = SimpleNamespace(id=99)

        self.assertEqual(
            connector_draft_comment_summary(
                actor=actor,
                proposal=proposal,
                fallback_proposal_id=90,
                proposal_title="Comment target",
                body="Draft only.",
            ),
            {
                "action": "draft_comment",
                "actor": "alice",
                "proposal_id": 99,
                "proposal_title": "Comment target",
                "body": "Draft only.",
            },
        )
        self.assertEqual(
            connector_draft_proposal_summary(
                actor=actor,
                title="Draft title",
                body="Draft body.",
            ),
            {
                "action": "draft_proposal",
                "actor": "alice",
                "title": "Draft title",
                "body": "Draft body.",
            },
        )
        self.assertEqual(
            connector_draft_collab_request_summary(
                actor=actor,
                proposal=proposal,
                fallback_proposal_id=90,
                proposal_title="Collab target",
                collaborator=SimpleNamespace(username="bob"),
                fallback_collaborator_username="fallback-bob",
            ),
            {
                "action": "draft_collab_request",
                "actor": "alice",
                "proposal_id": 99,
                "proposal_title": "Collab target",
                "collaborator_username": "bob",
            },
        )


if __name__ == "__main__":
    unittest.main()
