# Branch Protection Rollout Status

This file records the current enforcement posture so SuperNova does not jump from manual safety checks to strict branch rules too quickly.

## Current Status

| Area | Status | Notes |
| --- | --- | --- |
| Manual local checks | Active | `python scripts/check_safe.py --local-only` is available. |
| Public protocol smoke | Active | Daily/manual GitHub Action exists and live smoke passes when deployment is healthy. |
| Local safe-check workflow | Active, manual-only | Not PR-blocking yet. |
| FE7 lint/build | Manual | Run directly in `super-nova-2177/frontend-social-seven`. |
| Protected core diff check | Active locally | `scripts/check_safe.py` checks protected core zero diff. |
| CODEOWNERS | Syntax validated through PR #8; auto-review inconclusive | PR #8 touched a CODEOWNERS-protected docs file and merged cleanly. Auto-review behavior remains inconclusive because the PR author was also the repo owner/CODEOWNER. |
| Required checks | Not enabled | No workflow is required as a blocking branch rule yet. |
| Strict branch protection | Not enabled | Wait until workflows are stable and CODEOWNERS behavior is confirmed. |

## Next Validation Steps

Do these without changing runtime behavior:

1. Use a future PR from a different contributor or bot to confirm CODEOWNERS auto-review requests.
2. Confirm public protocol smoke and local safe-check workflows can still be run manually.
3. Only then consider making any check required.

## Do Not Enable Yet

Do not enable required branch rules for:

- Strict deployment checks.
- Auth enforcement.
- Database migrations.
- Real domain verification.
- Webmention intake.
- ActivityPub inbox writes.
- Execution-intent pipelines.

Those systems are not mature enough to become branch-protection gates.

## Cleanup Rule

Cleanup must stay branch-tested. The cleanup snapshot is an inventory, not deletion approval.
