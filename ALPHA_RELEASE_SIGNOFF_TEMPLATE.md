# Alpha Release Signoff Template

Use one copy of this template for each alpha release candidate or public demo
candidate. Keep links and command output summaries short enough to review, but
specific enough that the release can be rolled back or re-tested later.

## Candidate

- Candidate commit SHA:
- Release branch or tag:
- Previous known-good rollback target:
- FE7 production URL:
- MCP health URL:
- MCP connector URL:
- Manual QA owner:
- Manual QA date:

## Automated Evidence

- FE7 lint/build result:
- Backend focused test result:
- `python scripts/check_safe.py --local-only` result:
- `python scripts/check_safe.py` result:
- Protected core zero-diff result:
- Public social/backend smoke result:
- MCP deployed smoke result:

## Manual QA Evidence

- Account/session:
- Posting/media:
- Voting/system vote:
- AI review draft create/approve/cancel:
- Comments:
- Follows:
- Messages:
- Collabs/profile tabs:
- Public signed-out reads:
- Mobile/light/dark smoke:
- MCP `/health` and `/mcp` behavior:

## Known Exceptions

- Exception:
- Impact:
- Owner:
- Follow-up issue or PR:
- Accepted for this candidate by:

## Release Decision

- Go / no-go:
- Decision maker:
- Decision timestamp:
- Rollback notes:
