# Alpha Smoke Signoff Template

Use one copy of this template for each manual alpha smoke pass. This is lighter
than the full release signoff and is meant to capture what was actually checked,
what was blocked, and where to roll back if the smoke fails.

## Candidate

- Commit SHA:
- Branch or PR:
- Frontend URL:
- Backend URL:
- MCP URL, if checked:
- Browser and version:
- Device / viewport:
- Operating system:
- Smoke owner:
- Smoke date:
- Previous known-good rollback target:

## Automated Evidence

- FE7 lint/build:
- Mocked FE7 E2E (`npm run test:e2e` or `npm run test:e2e:mocked`):
- Optional real-backend FE7 E2E (`PLAYWRIGHT_REAL_BACKEND=1 npm run test:e2e:real`):
- Backend focused tests:
- `python scripts/check_safe.py --local-only`:
- Full `python scripts/check_safe.py`:
- Protected core zero-diff:

E2E remains advisory for this smoke pass. Do not treat mocked or real-backend
Playwright results as required branch-protection gates yet.

## Manual Smoke Rows

| Area | Status (`PASS` / `FAIL` / `BLOCKED` / `NOT RUN`) | Evidence / notes | Follow-up |
| --- | --- | --- | --- |
| Account signup/signin/signout |  |  |  |
| Public signed-out feed/profile/proposal reads |  |  |  |
| Status routes: `/health`, `/supernova-status`, `/status` |  |  |  |
| Create/edit/delete post |  |  |  |
| Fresh image upload renders after refresh |  |  |  |
| Missing fresh upload fallback, if practical |  |  |  |
| Legacy uploaded image path check |  |  |  |
| Comments/replies/edit/delete/votes |  |  |  |
| Follows/unfollows |  |  |  |
| Messages empty/conversation/send/reload |  |  |  |
| AI Genesis delegate creation/profile |  |  |  |
| AI review approve/cancel |  |  |  |
| AI comment approve/cancel |  |  |  |
| AI post approve/cancel |  |  |  |
| Mobile modal/feed sanity |  |  |  |
| MCP read-only posture |  |  |  |
| Rate-limit normal-use sanity |  |  |  |

## Known Issues

| Issue | Impact | Status (`accepted` / `blocking` / `follow-up`) | Owner | Link |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

Image persistence note: the bounded DB-backed `data:image/...` fallback protects
newly uploaded proposal images after the fallback shipped. Old images whose
upload bytes are already gone and whose database row only stores
`/uploads/<filename>` cannot be reconstructed by app code alone. Restore those
bytes from source files, backups, or durable storage if available.

## Branch Protection Reminder

Branch protection remains a manual GitHub setting until explicitly enabled.
For the first rollout, enable:

- `Require status checks to pass before merging`.
- `Require branches to be up to date before merging`.
- Required checks: `Backend local deterministic checks` and
  `FE7 local deterministic checks`.

Keep live/network smoke and advisory E2E unrequired until they are broader and
stable enough to avoid noisy blocking failures.

## Decision

- Smoke result (`PASS` / `FAIL` / `BLOCKED`):
- Accepted exceptions:
- Rollback target:
- Follow-up PRs/issues:
- Decision maker:
- Decision timestamp:
