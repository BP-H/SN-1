# Safe Check Results Snapshot

This snapshot records the known-good baseline after PR #13 merged. It is documentation only and does not replace rerunning checks before future releases, dependency merges, or cleanup branches.

## Baseline

- Date: 2026-04-26
- Baseline commit: `8cd48ad`
- PR #13 merged: yes
- Vercel production/preview status observed for PR #13: Ready

## Checks

| Check | Result |
| --- | --- |
| `python scripts/check_safe.py --local-only` | Passed |
| `python scripts/check_safe.py` | Passed |
| Live public protocol smoke | 72 passed, 0 failed |
| `python scripts/smoke_social_backend.py https://2177.tech` | 2 passed, 3 skipped, 0 failed |
| Backend federation safety tests | 11 OK |
| FE7 `npm run lint` | Passed |
| FE7 `npm run build` | Passed |
| Protected `supernovacore.py` diff | Zero diff |

## Backend Origin Note

- `https://2177.tech` is the frontend/protocol origin and intentionally reports backend health/status/proposal reads as skipped when those routes are not proxied there.
- Direct strict backend smoke still requires a reachable backend API origin, such as the value configured in deployment for `NEXT_PUBLIC_API_URL`.
- No environment values are recorded in this snapshot.

## Guardrail State

- Required branch checks are not enabled.
- Strict branch protection is not enabled.
- CODEOWNERS syntax was validated through PR #8.
- CODEOWNERS auto-review behavior remains inconclusive because PR #8 author and CODEOWNER were both `BP-H`.
- Social/backend smoke tooling is covered by CODEOWNERS after this baseline refresh.
- Cleanup remains branch-only and snapshot-only; no deletion is approved from `master`.
