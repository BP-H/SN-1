# Alpha Release Candidate Signoff - 2026-04-30

This signoff records the evidence pass for the post-PR #128 alpha release
candidate. It is evidence only; it does not tag, promote, merge, or mark a PR
ready for review.

## Candidate

- Candidate commit SHA: `99399b9201ef7ad82f386646e0c7b9ef00ed7e06`
- Release branch or tag: `master` at the candidate SHA; no release tag created
  in this pass.
- Previous known-good rollback target: PR #127 production commit
  `39b0a9d1983360037632b98db0b07c9de3f734a2`.
- FE7 production URL: `https://2177.tech`
- MCP health URL: `https://sn-1-anls.vercel.app/health`
- MCP connector URL: `https://sn-1-anls.vercel.app/mcp`
- Manual QA owner: release owner
- Evidence recorded by: Codex
- Evidence date: 2026-04-30 23:07 Pacific

## Deployment Evidence

- FE7 Vercel project: `sn-1`
- FE7 production deployment: `dpl_7KUwUJfTwKLmojricuRyS2ni6P3W`
- FE7 deployment state: `READY`
- FE7 deployment commit: `99399b9201ef7ad82f386646e0c7b9ef00ed7e06`
- MCP Vercel project: `sn-1-anls`
- MCP production deployment: `dpl_73vZyY9oQMM85SWa7S5BdaSQ1A5s`
- MCP deployment state: `READY`
- MCP deployment commit: `99399b9201ef7ad82f386646e0c7b9ef00ed7e06`
- Public page smoke:
  - `https://2177.tech` returned `200 text/html`.
  - `https://2177.tech/universe` returned `200 text/html`.
  - `https://sn-1-anls.vercel.app/health` returned `200 application/json`.
  - Browser `GET https://sn-1-anls.vercel.app/mcp` returned `405`, which is
    expected because MCP clients POST to `/mcp`.

## Automated Evidence

- FE7 lint result: `PASS` (`npm run lint`)
- FE7 build result: `PASS` (`npm run build`)
- Backend compile result: `PASS`
  (`python -m py_compile super-nova-2177/backend/app.py`)
- Backend focused test result: `PASS`
  - `test_connector_ai_review_actions.py`: 3 tests
  - `test_connector_action_draft_routes.py`: 3 tests
  - `test_connector_action_inbox_cancel.py`: 4 tests
  - `test_connector_vote_approval.py`: 4 tests
  - `test_public_gpt_connector_facade.py`: 8 tests
  - `test_upload_size_limits.py`: 8 tests
  - `test_proposal_write_auth_routes.py`: 5 tests
  - `test_auth_bound_write_routes.py`: 12 tests
  - `test_comment_auth_routes.py`: 3 tests
  - `test_follow_auth_routes.py`: 2 tests
  - `test_system_vote_auth_deadline.py`: 5 tests
  - `test_proposal_collab_visibility.py`: 8 tests
  - `test_proposal_collab_routes.py`: 6 tests
  - `test_delete_with_collabs.py`: 3 tests
- `python scripts/check_safe.py --local-only` result: `PASS`
- `python scripts/check_safe.py` result: `PASS` after network permission;
  public protocol smoke reported `72 passed, 0 failed`.
- Protected core zero-diff result: `PASS`
- Public social/backend smoke result: `PASS` with expected public skips:
  `2 passed, 3 skipped, 0 failed`.
- MCP build result: `PASS`
- MCP unit test result: `PASS` after sandbox spawn permission; 6 tests passed.
- MCP deployed smoke result: `PASS`
  (`npm run smoke -- https://sn-1-anls.vercel.app`)
  - `/health` returned `ok:true`.
  - `tools/list` returned read-only tools:
    `search_proposals`, `get_proposal`, `get_proposal_comments`,
    `get_proposal_vote_summary`, `get_profile`,
    `get_supernova_connector_spec`.
- `git diff --check` result: `PASS`

## Manual QA Evidence

Codex performed the non-mutating public/deployed smoke portion:

- Public FE7 home: `PASS` via HTTP 200.
- Public `/universe`: `PASS` via HTTP 200.
- MCP `/health`: `PASS` via JSON 200.
- MCP `/mcp` browser behavior: `PASS`; GET returns 405 as documented for POST
  transport.
- MCP runtime posture: `PASS`; smoke lists read-only tools only.

The following production-mutating or credential-dependent manual QA items were
not executed by Codex to avoid creating accounts, posts, votes, messages, or
collab rows in production without an explicit release-owner test account plan:

- Account/session: create account, sign in, reload/persist, sign out, stale
  session UX.
- Posting/media: create text post, create image/media post, oversized media
  rejection, unsupported extension rejection.
- Voting/system vote: vote, unvote, species-weighted breakdown, system vote.
- Comments: create, edit, delete, mention safety.
- Follows: follow, unfollow, friendly auth guardrails.
- Messages: conversation list, send/read, stale session UX.
- Collabs/profile tabs: invite, approve/decline, remove/cancel, approved
  collab on both profiles, delete post with collab.
- AI review drafts: creation visibility for `species=ai`, explicit approval,
  cancel behavior, human/company rejection.
- Mobile/light/dark browser sweep.

Release owner should complete these items from `ALPHA_QA_CHECKLIST.md` before a
public alpha launch. They remain required manual evidence, not automated
evidence.

## Known Exceptions

- `python scripts/smoke_social_backend.py https://2177.tech` skips `/health`,
  `/supernova-status`, and `/proposals?limit=1` on the public frontend origin
  because they are unavailable or non-JSON there. This is accepted for the
  public smoke; strict backend smoke should use the backend API origin.
- Browser `GET /mcp` returns 405. This is expected because ChatGPT/Codex MCP
  clients use POST transport.
- Full production write-flow browser QA remains pending release-owner signoff.

## Release Decision

- Go / no-go recommendation: **conditional go for public read-only/demo
  surfaces; no-go for public alpha launch until the release owner completes the
  production write-flow manual QA checklist.**
- Decision maker: release owner
- Decision timestamp: pending
- Rollback notes: revert to PR #127 production commit
  `39b0a9d1983360037632b98db0b07c9de3f734a2` if candidate-specific issues are
  found.

## Safety Notes

- MCP remains read-only.
- AI review drafts remain approval-required.
- Universe fork visibility remains read-only and does not enable federation
  writes.
- Production backend uses `super-nova-2177/backend/requirements.txt`.
- Optional ML/science packages remain in
  `super-nova-2177/backend/requirements-ml.txt`.
- Protected core remained untouched.
- No payment, reward, token, equity, compensation, payout, or financial promise
  language was added.
