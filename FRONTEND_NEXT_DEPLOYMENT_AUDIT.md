# frontend-next Deployment/Auth Audit

Date: 2026-05-05

## Decision

Deletion was performed in a later single-target cleanup PR. The owner explicitly
accepted the external deployment/auth/API-route risk documented below, and fresh
repo-local reference checks still found no active workflow, package, launcher,
script, or deployment config outside the folder pointing to
`super-nova-2177/frontend-next/`.

The deletion PR did not change runtime behavior, frontend UI, backend routes,
deployment settings, uploads, DB files, Docker Compose behavior, or protected
core.

## 2026-05-05 Owner-Accepted Deletion

The owner explicitly accepted the remaining external uncertainty:

- unknown Vercel/Railway/Docker project-root state
- unknown Supabase auth/provider dependency
- unknown active `app/api/ai` exposure
- unknown external smoke/manual QA dependency on the legacy Next app

With that risk accepted, the tracked `super-nova-2177/frontend-next/` source was
deleted as a single cleanup target. Active production remains
`frontend-social-seven` only. Rollback is a single revert of the deletion PR if
the retired Next source, Dockerfile, Supabase auth surface, or `app/api/ai`
handler are needed again.

## Reference Checks Performed

- `git grep -n "frontend-next" -- .`
- `git grep -n "start_frontend_next" -- .`
- Searched `.github/workflows`.
- Searched package files, Dockerfiles, compose files, Vercel/Railway files,
  scripts, launchers, JSON, and docs.
- Inspected `super-nova-2177/frontend-next/package.json`.
- Inspected `super-nova-2177/frontend-next/Dockerfile`.
- Inspected `super-nova-2177/frontend-next/next.config.mjs`.
- Inspected `super-nova-2177/frontend-next/app/api/ai/route.js`.
- Confirmed `run_local.py` no longer exposes `next`.
- Confirmed `start_supernova.ps1` option 1 is a retired handoff to Social Seven.

## Audit Result

Local repo checks found these references before launcher retirement:

- Cleanup/status/security docs.
- `scripts/list_cleanup_candidates.py`, which keeps the source listed as a
  cleanup candidate.
- `super-nova-2177/run_local.py`.
- `super-nova-2177/start_supernova.ps1`.
- `super-nova-2177/start_frontend_next.ps1`.
- `super-nova-2177/frontend-social-six/SOCIAL_AUTH_SETUP.md`, which documents
  social-six as derived from the original Next app.

Fresh deletion checks found no active GitHub workflow or repo-level deploy
config outside `frontend-next/` pointing at this folder. Manual
Vercel/Railway/Docker/Supabase settings were not verified; that risk was
explicitly accepted by the owner for deletion.

## Deployment/Auth/Security Notes

`frontend-next` was deployment/auth/security-sensitive because it contained:

- A standalone Next package and lockfiles.
- A `Dockerfile`.
- Supabase auth dependencies and `supabaseClient.js`.
- An `app/api/ai/route.js` handler that uses server-side `OPENAI_API_KEY`.
- Legacy content and proposal routes that may be useful for future archaeology.

Deletion proceeded after the owner accepted the unresolved external
deployment/auth/API-route uncertainty.

## Current State

- Active/default frontend remains `super-nova-2177/frontend-social-seven`.
- Tracked `frontend-next` source was deleted.
- `frontend-next` no longer appears in `run_local.py --list-frontends`.
- `start_supernova.ps1` option 1 is a retired handoff to Social Seven.
- `start_frontend_next.ps1` was removed.

## Historical Deletion Checklist

This was the preferred external verification checklist before the owner accepted
the risk and deletion proceeded:

- No Vercel project root points to `super-nova-2177/frontend-next`.
- No Railway/Docker deploy path uses `frontend-next/Dockerfile`.
- No production/staging auth settings depend on this app's Supabase client.
- No active route depends on `frontend-next/app/api/ai/route.js`.
- No CI/workflow/package script invokes this folder.
- FE7 lint/build, backend checks, cleanup guards, and protected-core zero-diff
  pass after deletion.

## Rollback

Rollback is a single revert restoring `super-nova-2177/frontend-next/`, its
Dockerfile, Supabase auth surface, `app/api/ai` handler, and cleanup candidate
docs.
