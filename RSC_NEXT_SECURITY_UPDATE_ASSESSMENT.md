# RSC / Next Security Update Assessment

Branch: `security/assess-rsc-next-cve-pr1`

Mode: assessment-only. No dependency PRs were merged, closed, rebased, recreated, or modified. No package files, lockfiles, runtime code, auth, database, uploads, migrations, execution, federation writes, domain verification, AI runtime, frontend product logic, route behavior, legacy frontend code, or protected core files were changed.

## Current Master Baseline

| Item | Result |
| --- | --- |
| Current master commit | `f6aa4c1` |
| PR #25 included | Yes, `DEPENDENCY_PR_TRIAGE_ASSESSMENT.md` now records PR #24 Supabase completion. |
| PR #27 included | Yes, active FE7 `package.json` and `package-lock.json` now explicitly use `next@15.5.15`. |
| Working tree before assessment | Clean. |
| Protected `supernovacore.py` diff | Zero. |
| Assessment output | This document only. |

## PR #1 Summary

| Item | Result |
| --- | --- |
| PR | #1, `Fix React Server Components CVE vulnerabilities` |
| Source | `vercel[bot]` |
| State | Open, draft, not merged |
| Mergeability | Not mergeable |
| Base branch | `master` |
| Base SHA | `3b4ae00ab6740555b1bf8f9fdea60e58994b1867` |
| Head branch | `vercel/react-server-components-cve-vu-uksspp` |
| Head SHA | `ecaaaab1d481d744b5c8d868a229601caa12f794` |
| Staleness versus current master | 125 commits behind current `master` |
| Changed files | 5 |
| Vercel preview on bot PR | Ready on Apr 24, 2026, but from the old PR branch/base |

PR #1 is security-motivated and should be taken seriously, but it should not be merged as-is because it is draft, not mergeable, old, broad, and touches legacy surfaces alongside the active FE7 app.

## Official Advisory Context

The Vercel bot PR references the React Server Components remote-code-execution advisory. The official Next.js advisory says affected App Router users should upgrade to a patched Next.js release and lists patched `15.x` and `16.x` lines. The React advisory was later updated with newer required versions, including patched `15.5.x` and `16.0.x` releases.

Primary references:

- Next.js advisory: <https://nextjs.org/blog/CVE-2025-66478>
- React advisory: <https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components>

Assessment note: the active FE7 lockfile already resolved `next` to `15.5.15`, which is newer than the patched `15.5.x` versions listed in the official advisories. PR #27 made the active FE7 manifest match that patched lockfile version instead of blindly applying PR #1's stale package diff.

## Files Changed By PR #1

| Path | Surface | Assessment |
| --- | --- | --- |
| `super-nova-2177/frontend-social-seven/package.json` | Active FE7 frontend | Active production-relevant surface. Assess and handle first in a focused replacement PR. |
| `super-nova-2177/frontend-next/package.json` | Legacy/alternate frontend | Legacy-sensitive. Do not combine with active FE7 security patch. |
| `super-nova-2177/frontend-social-six/package.json` | Legacy/alternate frontend | Legacy-sensitive. Do not combine with active FE7 security patch. |
| `super-nova-2177/backend/supernova_2177_ui_weighted/nova-web/package.json` | Nested/legacy web app | Cleanup/deployment-sensitive. Do not combine with active FE7 security patch. |
| `super-nova-2177/backend/supernova_2177_ui_weighted/nova-web/package-lock.json` | Nested/legacy web app lockfile | Cleanup/deployment-sensitive. Do not combine with active FE7 security patch. |

## PR #1 Package Changes

| Surface | PR #1 package change |
| --- | --- |
| Active FE7 | `next` from `^15.1.0` to `15.1.11` in `frontend-social-seven/package.json` |
| `frontend-next` | `next` from `^16.0.3` to `16.0.10` |
| `frontend-social-six` | `next` from `^16.0.3` to `16.0.10` |
| Nested `nova-web` | `next` from `14.2.31` to `14.2.35` plus `package-lock.json` updates |

PR #1 does not update `react` or `react-dom`; it only updates `next` package declarations and, for nested `nova-web`, the lockfile.

## Current Package Status

| Surface | `package.json` Next | Lockfile Next | React | React DOM | Notes |
| --- | --- | --- | --- | --- | --- |
| Active FE7: `super-nova-2177/frontend-social-seven` | `15.5.15` | `15.5.15` | `^18.3.1` | `^18.3.1` | Active app. PR #27 made the manifest explicitly match the already-resolved patched `15.5.15` lockfile version. |
| `super-nova-2177/frontend-social-six` | `^16.0.3` | `16.0.3` | `^18.3.1` | `^18.3.1` | Legacy/alternate frontend. Needs separate review. |
| `super-nova-2177/frontend-next` | `^16.0.3` | `16.0.3` | `^18.3.1` | `^18.3.1` | Legacy/alternate frontend. Needs separate review. |
| Nested `nova-web` | `14.2.31` | `14.2.31` | `18.2.0` | `18.2.0` | Nested/legacy app. Cleanup assessment already treats this area as sensitive. |

No direct `react-server-dom-*` package reference was found in the active FE7 package files. The risk is still relevant because Next.js App Router can include React Server Components behavior internally.

## Why PR #1 Should Not Be Merged As-Is

- It is draft and not mergeable.
- Its base SHA is 125 commits behind current master.
- It mixes the active FE7 app with legacy frontends and a nested legacy app.
- It does not update active FE7's `package-lock.json`, even though current FE7 lockfile state is important for the actual deployed dependency.
- Its active FE7 package change targets `next@15.1.11`, while current FE7 now explicitly uses `next@15.5.15` in both `package.json` and `package-lock.json`.
- It would make security, legacy cleanup, and deployment-surface decisions in one PR.
- The old Vercel preview being Ready does not prove the current master replacement will be safe.

## Recommended Safe Path

The active FE7 replacement step has been completed by PR #27. FE7 now explicitly pins Next to `15.5.15`, matching the already-resolved lockfile version.

Completed replacement branch:

```txt
security/pin-fe7-next-15-5-15
```

Files changed by PR #27:

```txt
super-nova-2177/frontend-social-seven/package.json
super-nova-2177/frontend-social-seven/package-lock.json
```

PR #27 did not include `yarn.lock`, React, React DOM, Supabase, Tailwind, OpenAI, legacy frontends, or nested `nova-web`.

## Legacy Surface Plan

Handle these separately after the active FE7 pin:

| Surface | Recommendation |
| --- | --- |
| `frontend-social-six` | Assess whether it is still deployed or should be archived before updating. |
| `frontend-next` | Assess whether it is still deployed or should be archived before updating. |
| Nested `nova-web` | Treat as deployment/cleanup-sensitive. Do not update or delete until the nested backend and lockfile cleanup plan is resolved. |

## Checks Used For PR #27

- FE7 `npm run lint`
- FE7 `npm run build`
- `python scripts/check_safe.py --local-only`
- `python scripts/check_safe.py`
- `python scripts/smoke_social_backend.py https://2177.tech`
- `python -m unittest super-nova-2177/backend/tests/test_public_federation_safety.py`
- Protected `supernovacore.py` diff zero
- Vercel preview Ready
- Manual visual sanity on homepage, feed/proposal card, profile/avatar surfaces, and narrow/mobile viewport
- Production smoke after merge

## Rollback Plan

If the FE7 security pin causes build, preview, auth/session, routing, protocol smoke, social smoke, or production regressions:

1. Revert that single replacement PR.
2. Confirm Vercel production returns to Ready.
3. Rerun public protocol smoke and social backend smoke.
4. Reassess the Next security target from current master before trying again.

## Bottom Line

Do not merge PR #1 as-is. Active FE7 is now explicitly pinned to `next@15.5.15` in both `package.json` and `package-lock.json` by PR #27. Legacy frontend and nested `nova-web` Next security handling remains separate future assessment work.
