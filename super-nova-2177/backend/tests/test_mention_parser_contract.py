import sys
import unittest
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from mention_parser import MAX_MENTION_USERNAME_LENGTH, parse_mentions


class MentionParserContractTests(unittest.TestCase):
    def normalized(self, text, **kwargs):
        return [token.normalized for token in parse_mentions(text, **kwargs)]

    def test_parses_username_and_punctuation_boundaries(self):
        tokens = parse_mentions("Hello @alice, (@bob) and @carol.")

        self.assertEqual([token.username for token in tokens], ["alice", "bob", "carol"])
        self.assertEqual([token.raw for token in tokens], ["@alice", "@bob", "@carol"])
        self.assertEqual([token.normalized for token in tokens], ["alice", "bob", "carol"])

    def test_parses_multiple_mentions_and_deduplicates_case_insensitively(self):
        tokens = parse_mentions("@Alice says hi to @alice and @BOB, then @bob again.")

        self.assertEqual([token.username for token in tokens], ["Alice", "BOB"])
        self.assertEqual([token.normalized for token in tokens], ["alice", "bob"])

    def test_allows_conservative_username_characters(self):
        self.assertEqual(
            self.normalized("@alice_01 @bob.smith @carol-team"),
            ["alice_01", "bob.smith", "carol-team"],
        )

    def test_rejects_malformed_email_and_url_mentions(self):
        text = (
            "@ @-bad @.bad alice@example.com "
            "https://example.test/@dave @eve@example.com"
        )

        self.assertEqual(parse_mentions(text), [])

    def test_rejects_overly_long_names(self):
        valid = "a" * MAX_MENTION_USERNAME_LENGTH
        too_long = "b" * (MAX_MENTION_USERNAME_LENGTH + 1)

        self.assertEqual(self.normalized(f"@{valid}"), [valid])
        self.assertEqual(parse_mentions(f"@{too_long}"), [])

    def test_handles_empty_null_and_very_long_text(self):
        self.assertEqual(parse_mentions(None), [])
        self.assertEqual(parse_mentions(""), [])

        long_text = ("ordinary text " * 2000) + "@alice"
        self.assertEqual(self.normalized(long_text), ["alice"])

    def test_skips_self_mentions_by_default_when_author_is_supplied(self):
        self.assertEqual(
            self.normalized("Hi @alice and @bob", author_username="ALICE"),
            ["bob"],
        )

    def test_can_include_self_mentions_when_explicitly_requested(self):
        self.assertEqual(
            self.normalized(
                "Hi @alice and @bob",
                author_username="ALICE",
                skip_self=False,
            ),
            ["alice", "bob"],
        )

    def test_preserves_display_text_and_positions(self):
        text = "Please ask @Alice.Team for review."
        token = parse_mentions(text)[0]

        self.assertEqual(token.raw, "@Alice.Team")
        self.assertEqual(token.username, "Alice.Team")
        self.assertEqual(token.normalized, "alice.team")
        self.assertEqual(text[token.start:token.end], "@Alice.Team")


if __name__ == "__main__":
    unittest.main()
