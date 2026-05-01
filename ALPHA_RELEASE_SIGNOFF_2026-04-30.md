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
- Manual QA completion update: release owner reported completed production
  manual QA on 2026-05-01 UTC / 2026-04-30 Pacific, with no release-blocking
  issues reported.
- Release-blocker follow-up: sign-out sometimes required a second click because
  an in-flight social-profile sync could restore backend auth state after the
  first sign-out. This PR adds a tiny FE7 logout-generation guard so stale sync
  responses are ignored after sign-out.

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
- FE7 sign-out fix validation: `PASS` (`npm run lint`, `npm run build`)
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

Release-owner manual QA completion was reported for the credentialed and
production-mutating flows that Codex intentionally did not run directly:

- Account/session: `PASS` - create account, sign in, reload/persist, sign out,
  and stale/invalid session friendly-error behavior completed.
- Posting/media: `PASS` - text post, image/media post, oversized media
  rejection, and unsupported extension rejection completed.
- Voting/system vote: `PASS` - vote, unvote, species-weighted breakdown, and
  manual/safe system vote behavior completed.
- Comments: `PASS` - create comment, edit/delete own comment where supported,
  and mention safety completed.
- Follows: `PASS` - follow, unfollow, and friendly missing/wrong-auth
  guardrails completed.
- Messages: `PASS` - conversation list, send/read, and stale session UX
  completed.
- Collabs/profile tabs: `PASS` - invite, approve/decline, remove/cancel,
  approved collab appearing on both profiles, and delete post with collab
  completed.
- AI review drafts: `PASS` - `species=ai` creation visibility, explicit
  approval, cancel-prevents-publication behavior, and human/company rejection
  completed.
- Universe: `PASS` - `/universe` loads, manifest card is visible, and copy does
  not claim live federation, verified organizations, or financial value.
- Public signed-out reads: `PASS` - feed, profile, proposal detail, and public
  approved-collab reads completed.
- MCP: `PASS` - `/health` JSON and `/mcp` POST-transport behavior confirmed;
  MCP tools remain read-only.
- Mobile/light/dark: `PASS` - home, profile, AI widget, universe page, light
  theme, and dark theme smoke completed.

## Known Exceptions

- `python scripts/smoke_social_backend.py https://2177.tech` skips `/health`,
  `/supernova-status`, and `/proposals?limit=1` on the public frontend origin
  because they are unavailable or non-JSON there. This is accepted for the
  public smoke; strict backend smoke should use the backend API origin.
- Browser `GET /mcp` returns 405. This is expected because ChatGPT/Codex MCP
  clients use POST transport.
- No release-blocking manual QA exceptions were reported by the release owner.
- Sign-out double-click issue was identified as a tiny release blocker and
  fixed in FE7 by preventing stale social-sync responses from restoring auth
  after sign-out.

## Release Decision

- Go / no-go recommendation: **go for alpha release candidate, subject to the
  release owner making the final publish/tag decision.**
- Decision maker: release owner
- Decision timestamp: pending release owner final approval
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
