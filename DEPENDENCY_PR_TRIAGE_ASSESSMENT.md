# Dependency PR Triage Assessment

Branch: `deps/assess-open-dependency-prs`

Mode: assessment-only. No dependency PRs were merged, closed, rebased, recreated, or modified. No package files, lockfiles, runtime code, auth, database, uploads, migrations, execution, federation writes, domain verification, AI runtime, frontend product logic, route behavior, or protected core files were changed.

## Current Status

| Item | Result |
| --- | --- |
| Original dependency triage baseline | `master` included PR #16 at `5794a0f`. |
| Current status update | PR #19 completed FE7 `eslint-config-next`; PR #21 completed FE7 `tailwindcss`; PR #24 completed FE7 `@supabase/supabase-js`; PR #27 pinned active FE7 `next` to `15.5.15` from current master. |
| Open dependency/security PRs remaining | PR #1, PR #4, PR #6, PR #7. |
| PR #4 status | Superseded by PR #24; do not merge as-is. |
| PR #7 status | Superseded by PR #19; do not merge as-is. |
| Auth/social login baseline | Production `https://2177.tech` Supabase login was manually confirmed working after PR #21, and `AUTH_SOCIAL_SMOKE_CHECK.md` was used as the before/after auth gate for PR #24. |
| Open dependency PRs modified by this assessment | No. |
| Protected `supernovacore.py` diff | Zero. |

## Completed Dependency Updates

| Package | Completed By | Result |
| --- | --- | --- |
| FE7 `eslint-config-next` `15.5.2` to `15.5.15` | PR #19 | Completed from current master with FE7 lint/build, safe-check, public protocol smoke, social backend smoke, backend safety tests, and protected core zero diff. |
| FE7 `tailwindcss` `4.1.17` to `4.2.4` | PR #21 | Completed from current master with FE7 lint/build, safe-check, public protocol smoke, social backend smoke, backend safety tests, protected core zero diff, Vercel preview, and manual visual sanity review before merge. |
| FE7 `@supabase/supabase-js` `2.58.0` to `2.104.1` | PR #24 | Completed from current master with FE7 lint/build, safe-check, public protocol smoke, social backend smoke, backend safety tests, protected core zero diff, Vercel preview, and before/after auth/social smoke review. |
| FE7 `next` manifest pin to `15.5.15` | PR #27 | Completed from current master after RSC/Next security assessment. FE7 `package.json` and `package-lock.json` now both explicitly use `next@15.5.15`; legacy frontend and nested `nova-web` handling remains separate. |

PR #4 remains open as the original Dependabot PR, but it is superseded by PR #24. Do not merge PR #4 as-is.
PR #7 remains open as the original Dependabot PR, but it is superseded by PR #19. Do not merge PR #7 as-is.
PR #6 remains open as the original Dependabot PR, but it is superseded by PR #21. Do not merge PR #6 as-is.

## Open PR Summary

| PR | Source | Package(s) | Semver / Scope | Files Changed | Base Staleness | Vercel Preview | Risk | Recommendation |
| --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| #1 | Vercel bot | `next` across multiple apps | Patch versions, but broad multi-frontend security PR | 5 | 107 commits behind current master | Success / Ready | High | Do not merge as-is. Recreate from current master and split active FE7 from legacy frontends if possible. |
| #4 | Dependabot | `@supabase/supabase-js` | Same-major minor jump `2.58.0` to `2.104.1` | 3 | 27 commits behind current master | Success / Ready | Superseded | Superseded by current-master PR #24 after auth/social smoke review. Do not merge as-is. |
| #6 | Dependabot | `tailwindcss` | Minor jump `4.1.17` to `4.2.4` | 3 | 27 commits behind current master | Success / Ready | Superseded | Superseded by current-master PR #21. Do not merge as-is. |
| #7 | Dependabot | `eslint-config-next` | Patch/security jump `15.5.2` to `15.5.15` | 3 | 24 commits behind current master | Success / Ready | Superseded | Superseded by current-master PR #19. Do not merge as-is. |

Base staleness was measured as commits from each PR base SHA to current `HEAD` on `master`.

## Detailed Findings

### PR #1: Vercel RSC CVE / Next.js Security Update

Changed files:

- `super-nova-2177/backend/supernova_2177_ui_weighted/nova-web/package-lock.json`
- `super-nova-2177/backend/supernova_2177_ui_weighted/nova-web/package.json`
- `super-nova-2177/frontend-next/package.json`
- `super-nova-2177/frontend-social-seven/package.json`
- `super-nova-2177/frontend-social-six/package.json`

Observations:

- The PR is important because it is security-motivated.
- It is broad: active FE7 plus multiple legacy or experimental frontends and the legacy `nova-web` app.
- It is a draft PR and its base is 107 commits behind current master.
- Vercel preview status is `success`, but that does not prove all affected legacy apps are still safe or intended deployment targets.
- The diff includes Next updates in legacy surfaces that are not currently the active FE7 production path.

Recommendation:

- Do not merge PR #1 as-is.
- Recreate from current master.
- Prefer a fresh, focused active-FE7 security update first, with legacy frontend updates handled separately or deferred after repo hygiene.
- Required checks before any future merge: FE7 lint/build, public protocol smoke, social backend smoke, safe-check, Vercel preview, and a rollback plan.

### PR #4: Supabase Client Update

Changed files:

- `super-nova-2177/frontend-social-seven/package-lock.json`
- `super-nova-2177/frontend-social-seven/package.json`
- `super-nova-2177/frontend-social-seven/yarn.lock`

Observations:

- Updates `@supabase/supabase-js` from `2.58.0` to `2.104.1`.
- This is same-major semver, but it is a large minor-version jump.
- It affects auth/session/social-login-adjacent client behavior.
- The dependency tree introduces newer Supabase subpackages with `node >=20.0.0` engine declarations.
- Its base is 27 commits behind current master.
- Vercel preview status is `success`.

Recommendation:

- Completed by PR #24 from current master.
- PR #24 intentionally changed only FE7 `package.json` and `package-lock.json`; it did not include `yarn.lock`.
- `AUTH_SOCIAL_SMOKE_CHECK.md` was used as the before/after auth gate before merge.
- Required checks passed before merge: FE7 lint/build, safe-check, public protocol smoke, social backend smoke, backend safety tests, Vercel preview, auth/social smoke review, and protected core diff zero.
- The original Dependabot PR #4 remains open but is superseded. Do not merge PR #4 as-is.

### PR #6: Tailwind Update

Changed files:

- `super-nova-2177/frontend-social-seven/package-lock.json`
- `super-nova-2177/frontend-social-seven/package.json`
- `super-nova-2177/frontend-social-seven/yarn.lock`

Observations:

- Updates `tailwindcss` from `4.1.17` to `4.2.4`.
- Same-major minor update, but styling and generated CSS can change.
- Its base is 27 commits behind current master.
- Vercel preview status is `success`.

Recommendation:

- Completed by PR #21 from current master.
- PR #21 intentionally changed only FE7 `package.json` and `package-lock.json`; it did not include `yarn.lock`.
- Required checks passed before merge: FE7 lint/build, safe-check, public protocol smoke, social backend smoke, backend safety tests, Vercel preview, visual sanity review, and protected core diff zero.
- The original Dependabot PR #6 remains open but is superseded. Do not merge PR #6 as-is.

### PR #7: eslint-config-next Update

Changed files:

- `super-nova-2177/frontend-social-seven/package-lock.json`
- `super-nova-2177/frontend-social-seven/package.json`
- `super-nova-2177/frontend-social-seven/yarn.lock`

Observations:

- Updates `eslint-config-next` from `15.5.2` to `15.5.15`.
- Patch-level dev-tooling/security update for the active FE7 app.
- Its base is 24 commits behind current master.
- Vercel preview status is `success`.

Recommendation:

- Completed by PR #19 from current master.
- PR #19 intentionally changed only FE7 `package.json` and `package-lock.json`; it did not include `yarn.lock`.
- Required checks passed before merge: FE7 lint/build, safe-check, public protocol smoke, social backend smoke, backend safety tests, Vercel preview, and protected core diff zero.
- The original Dependabot PR #7 remains open but is superseded. Do not merge PR #7 as-is.

## Dependabot Label Warning

Dependabot comments on PR #4, PR #6, and PR #7 report missing labels:

- `dependencies`
- `frontend-social-seven`

This does not block the dependency diffs themselves, but it means Dependabot cannot apply the configured labels. Handle in a separate docs/tooling/admin pass by either creating the labels in GitHub or adjusting `.github/dependabot.yml`. Do not mix this with dependency merges.

## Recommended Merge Sequence

1. Completed: PR #19 updated FE7 `eslint-config-next` from current master.
2. Completed: PR #21 updated FE7 `tailwindcss` from current master after visual sanity review.
3. Completed: PR #24 updated FE7 `@supabase/supabase-js` from current master after auth/social smoke review.
4. Completed: PR #27 pinned active FE7 `next` to `15.5.15` from current master after RSC/Next security assessment.
5. Assess legacy frontend and nested `nova-web` Next security handling separately.

## Required Checks Before Any Dependency Merge

Every dependency PR should be tested alone:

- `python scripts/check_safe.py --local-only`
- `python scripts/check_safe.py`
- `python scripts/smoke_social_backend.py https://2177.tech`
- `python -m unittest super-nova-2177/backend/tests/test_public_federation_safety.py`
- FE7 `npm run lint`
- FE7 `npm run build`
- Vercel preview must be Ready
- Protected `supernovacore.py` diff must be zero

Additional PR-specific checks:

- Supabase: `AUTH_SOCIAL_SMOKE_CHECK.md` before and after the update.
- Tailwind: visual sanity check across key FE7 screens.
- Vercel RSC/Next security: active FE7 pin completed by PR #27; legacy surface plan remains separate.

## Rollback Plan

For any future dependency merge:

1. Merge only one dependency PR at a time.
2. Confirm Vercel production deployment reaches Ready.
3. Run public protocol smoke after deployment.
4. Run social backend smoke against `https://2177.tech`.
5. If production breaks, revert that single dependency merge commit.
6. Do not merge the next dependency PR until production is stable again.

## PRs To Defer

- PR #1: defer as-is because it is broad, old, not mergeable, and touches legacy frontends; active FE7 is handled by PR #27.
- PR #4: superseded by PR #24. Do not merge as-is.
- PR #6: superseded by PR #21. Do not merge as-is.
- PR #7: superseded by PR #19. Do not merge as-is.

## Bottom Line

Do not merge dependency PRs in bulk. The first dependency action, a fresh current-master PR for FE7 `eslint-config-next`, was completed by PR #19. The second dependency action, a fresh current-master PR for FE7 `tailwindcss`, was completed by PR #21 after visual sanity review. The third dependency action, a fresh current-master PR for FE7 `@supabase/supabase-js`, was completed by PR #24 after before/after auth and session verification. The active-FE7 RSC/Next security clarification was completed by PR #27 by explicitly pinning FE7 to `next@15.5.15`. The remaining dependency/security work is legacy frontend and nested `nova-web` assessment, not merging stale PR #1 as-is.
