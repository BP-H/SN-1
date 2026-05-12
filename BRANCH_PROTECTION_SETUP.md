# SN-1 Branch Protection Setup

Use this owner-side checklist to protect `BP-H/SN-1` `master` after the two
deterministic local gates are stable. This document is instructions only; it
does not mean the GitHub setting has been enabled.

## Required Status Checks

Require exactly these checks at first:

- `Backend local deterministic checks`
- `FE7 local deterministic checks`

These are the checks exposed by `.github/workflows/local-safe-pr-gates.yml`.
The backend gate already includes protected core zero-diff coverage, so do not
add a separate protected-core branch rule for the first rollout.

## GitHub Setup

In GitHub, open `BP-H/SN-1` and use either branch protection rules or rulesets:

1. Go to `Settings` -> `Branches` or `Rules` / `Rulesets`.
2. Create a rule targeting `master`.
3. Enable `Require a pull request before merging`.
4. Enable `Require status checks to pass before merging`.
5. Select only:
   - `Backend local deterministic checks`
   - `FE7 local deterministic checks`
6. Enable `Require branches to be up to date before merging` if available.
7. Enable force-push prevention.
8. Enable branch deletion prevention.
9. Enable conversation resolution if available.
10. Keep required reviews optional for solo-owner velocity. Add review
    requirements later when the repo has a stable reviewer flow.

## Keep Live Smoke Advisory

Do not make live/public smoke checks blocking yet. Keep production/public smoke
as manual or scheduled release evidence until the deployment environment is
stable enough for those checks to be a required merge gate.

Good advisory checks include:

- public frontend page smoke
- backend `/health`, `/supernova-status`, `/status`, and `/proposals` smoke
- public AI reader smoke
- media URL inventory checks
- public data snapshot comparison before and after deploys

## Emergency Hotfix Path

If production is broken and a required gate blocks an urgent fix:

1. Prefer a normal hotfix PR that keeps both required checks green.
2. If that is impossible, temporarily relax only the failing protection setting.
3. Document the production issue, the relaxed setting, who changed it, and when.
4. Merge only the minimal hotfix needed to restore production.
5. Re-enable protection immediately after the hotfix is deployed and verified.

Do not use the emergency path for routine feature work, cleanup, or broad
refactors.

## Owner Verification

After enabling protection:

- Open a tiny PR and confirm both required checks appear before merge.
- Confirm a direct push to `master` is blocked or unavailable.
- Keep production data, upload storage, and environment configuration managed
  outside git.
- Leave live/public smoke as release evidence, not a blocking branch rule.
