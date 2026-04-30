# Final Alpha QA Fixpack Notes

This pass used `ALPHA_QA_CHECKLIST.md` as a code and documentation audit after
the retired `frontend-nova` source folder was deleted.

## Reviewed

- Account/session flows and account-bound FE7 calls.
- Posting/media, proposal votes, system vote, comments, follows, and messages.
- Collab invite, approve, decline, remove, profile tab placement, and approved
  public collab visibility.
- Profile All, Visuals, Decisions, Posts, and Collabs tab behavior.
- Public signed-out feed, profile, and proposal reads.
- MCP `/health` and `/mcp` documentation.
- Deleted `frontend-nova` launcher and cleanup fallout.
- Contribution-record wording guardrails.

## Tiny Fixpack Outcome

- Clarified that profile support percentages belong on visual-grid tiles while
  normal profile cards rely on their existing vote bar.
- Added an alpha checklist item for deleted `frontend-nova` fallout.
- No FE7 runtime code, backend runtime code, MCP runtime code, deployment config,
  schema, route path, or package/lockfile change was needed.

## Frontend Nova Fallout Check

- `super-nova-2177/frontend-nova` is absent.
- `super-nova-2177/start_frontend_nova.ps1` is absent.
- `run_local.py` has no runnable `nova` frontend option.
- `start_supernova.ps1` keeps option 5 as a deleted/off-path message that exits
  instead of launching a missing app.
- `scripts/list_cleanup_candidates.py` no longer lists `frontend-nova` as a
  current source candidate.
- Package/deployment/workflow searches found no active `frontend-nova` target.

## Left Alone

- No additional legacy source folder was deleted.
- No backend auth behavior was changed.
- No MCP runtime behavior was changed.
- No new product feature was added.
- Manual browser QA remains the final release gate for real account, posting,
  voting, comments, follows, messages, collab, mobile, light, and dark flows.

## Contribution Copy Guardrail

This pass did not add payment, payout, token, equity, compensation, or automatic
value-distribution language. Contribution-record copy remains non-financial and
public-interest framed.
