# Alpha Smoke Signoff - 2026-05-04 (Incomplete)

This note records the state after PR #44 merged. No completed manual smoke result
rows were provided with this pass, so the rows below are marked `NOT RUN` rather
than inferred from automated checks or prior PRs.

## Candidate

- Commit SHA: `5ad20f3da258f3ffeb7d931e56e8b27b15c74054`
- Branch or PR: `master` after PR #44
- Frontend URL: NOT PROVIDED
- Backend URL: NOT PROVIDED
- MCP URL, if checked: NOT PROVIDED
- Browser and version: NOT PROVIDED
- Device / viewport: NOT PROVIDED
- Operating system: NOT PROVIDED
- Smoke owner: NOT PROVIDED
- Smoke date: 2026-05-04
- Previous known-good rollback target: NOT PROVIDED

## Automated Evidence

- FE7 lint/build: NOT RUN in provided smoke results
- Mocked FE7 E2E (`npm run test:e2e` or `npm run test:e2e:mocked`): NOT RUN in provided smoke results
- Optional real-backend FE7 E2E (`PLAYWRIGHT_REAL_BACKEND=1 npm run test:e2e:real`): NOT RUN in provided smoke results
- Backend focused tests: NOT RUN in provided smoke results
- `python scripts/check_safe.py --local-only`: NOT RUN in provided smoke results
- Full `python scripts/check_safe.py`: NOT RUN in provided smoke results
- Protected core zero-diff: NOT RUN in provided smoke results

E2E remains advisory for this smoke pass. Do not treat mocked or real-backend
Playwright results as required branch-protection gates yet.

## Manual Smoke Rows

| Area | Status (`PASS` / `FAIL` / `BLOCKED` / `NOT RUN`) | Evidence / notes | Follow-up |
| --- | --- | --- | --- |
| Account signup/signin/signout | NOT RUN | No manual smoke evidence was provided. | Run from `ALPHA_SMOKE_NOW.md`. |
| Public signed-out feed/profile/proposal reads | NOT RUN | No manual smoke evidence was provided. | Run from `ALPHA_SMOKE_NOW.md`. |
| Status routes: `/health`, `/supernova-status`, `/status` | NOT RUN | No manual smoke evidence was provided. | Run from `ALPHA_SMOKE_NOW.md`. |
| Create/edit/delete post | NOT RUN | No manual smoke evidence was provided. | Run from `ALPHA_SMOKE_NOW.md`. |
| Fresh image upload renders after refresh | NOT RUN | No manual smoke evidence was provided. | Run from `ALPHA_SMOKE_NOW.md`. |
| Missing fresh upload fallback, if practical | NOT RUN | No manual smoke evidence was provided. | Run from `ALPHA_SMOKE_NOW.md`. |
| Legacy uploaded image path check | NOT RUN | No manual smoke evidence was provided. | Run from `ALPHA_SMOKE_NOW.md`; already-missing bytes remain unrecoverable from app code alone. |
| Comments/replies/edit/delete/votes | NOT RUN | No manual smoke evidence was provided. | Run from `ALPHA_SMOKE_NOW.md`. |
| Follows/unfollows | NOT RUN | No manual smoke evidence was provided. | Run from `ALPHA_SMOKE_NOW.md`. |
| Messages empty/conversation/send/reload | NOT RUN | No manual smoke evidence was provided. | Run from `ALPHA_SMOKE_NOW.md`. |
| AI Genesis delegate creation/profile | NOT RUN | No manual smoke evidence was provided. | Run from `ALPHA_SMOKE_NOW.md`. |
| AI review approve/cancel | NOT RUN | No manual smoke evidence was provided. | Run from `ALPHA_SMOKE_NOW.md`. |
| AI comment approve/cancel | NOT RUN | No manual smoke evidence was provided. | Run from `ALPHA_SMOKE_NOW.md`. |
| AI post approve/cancel | NOT RUN | No manual smoke evidence was provided. | Run from `ALPHA_SMOKE_NOW.md`. |
| Mobile modal/feed sanity | NOT RUN | No manual smoke evidence was provided. | Run from `ALPHA_SMOKE_NOW.md`. |
| MCP read-only posture | NOT RUN | No manual smoke evidence was provided. | Run from `ALPHA_SMOKE_NOW.md`. |
| Rate-limit normal-use sanity | NOT RUN | No manual smoke evidence was provided. | Run from `ALPHA_SMOKE_NOW.md`. |

## Known Issues

| Issue | Impact | Status (`accepted` / `blocking` / `follow-up`) | Owner | Link |
| --- | --- | --- | --- | --- |
| Manual smoke evidence was not provided. | Alpha readiness cannot be signed off from this note. | blocking | Smoke owner | `ALPHA_SMOKE_NOW.md` |
| Old uploaded images whose bytes are already missing cannot be reconstructed by app code alone. | Legacy image rows may remain broken unless bytes are restored from source files, backups, or durable storage. | follow-up | Release owner | `ALPHA_QA_CHECKLIST.md` |

Image persistence note: the bounded DB-backed `data:image/...` fallback protects
newly uploaded proposal images after the fallback shipped. Old images whose
upload bytes are already gone and whose database row only stores
`/uploads/<filename>` cannot be reconstructed by app code alone.

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

- Smoke result (`PASS` / `FAIL` / `BLOCKED`): BLOCKED - no completed manual smoke results were provided.
- Accepted exceptions: None recorded.
- Rollback target: NOT PROVIDED
- Follow-up PRs/issues: Run and record the manual smoke pass from `ALPHA_SMOKE_NOW.md`.
- Decision maker: NOT PROVIDED
- Decision timestamp: NOT PROVIDED
