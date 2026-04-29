"""Pure mention parsing helpers.

This module intentionally has no database, notification, or route wiring. It
defines the parser contract that later mention/collab runtime work can reuse
after separate tests and implementation PRs.
"""

from dataclasses import dataclass
import re
from typing import Iterable, List, Optional, Set


MAX_MENTION_USERNAME_LENGTH = 80

_MENTION_RE = re.compile(
    r"(?<![A-Za-z0-9_.+/\-])@"
    r"(?P<username>[A-Za-z0-9_]+(?:[.-][A-Za-z0-9_]+)*)"
    r"(?![A-Za-z0-9_@-])"
)


@dataclass(frozen=True)
class MentionToken:
    raw: str
    username: str
    normalized: str
    start: int
    end: int


def _normalize_username(value: str) -> str:
    return (value or "").strip().lower()


def parse_mentions(
    text: Optional[str],
    *,
    author_username: Optional[str] = None,
    skip_self: bool = True,
) -> List[MentionToken]:
    """Return unique mention tokens in first-seen order.

    The parser accepts a conservative username subset that is compatible with
    existing SuperNova usernames used in public URLs: letters, numbers,
    underscores, and internal dot/hyphen separators. It rejects URL-path
    mentions, email-like mentions, bare `@`, and usernames over 80 characters.

    When `author_username` is supplied, self-mentions are skipped by default so
    future notification creation does not notify the author unless an explicit
    product policy later opts into it.
    """

    if not text:
        return []

    author_key = _normalize_username(author_username or "")
    seen: Set[str] = set()
    tokens: List[MentionToken] = []

    for match in _MENTION_RE.finditer(str(text)):
        username = match.group("username")
        if len(username) > MAX_MENTION_USERNAME_LENGTH:
            continue

        normalized = _normalize_username(username)
        if not normalized:
            continue
        if skip_self and author_key and normalized == author_key:
            continue
        if normalized in seen:
            continue

        seen.add(normalized)
        tokens.append(
            MentionToken(
                raw=match.group(0),
                username=username,
                normalized=normalized,
                start=match.start(),
                end=match.end(),
            )
        )

    return tokens


def mention_usernames(
    text: Optional[str],
    *,
    author_username: Optional[str] = None,
    skip_self: bool = True,
) -> List[str]:
    """Return normalized unique usernames mentioned in text."""

    return [
        token.normalized
        for token in parse_mentions(
            text,
            author_username=author_username,
            skip_self=skip_self,
        )
    ]


__all__: Iterable[str] = (
    "MAX_MENTION_USERNAME_LENGTH",
    "MentionToken",
    "mention_usernames",
    "parse_mentions",
)

