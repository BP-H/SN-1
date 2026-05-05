# Legacy Frontend Cleanup Closeout

Date: 2026-05-05

## Decision

The legacy frontend cleanup sprint is closed. Broad source deletion is paused so
the repo can move back to alpha smoke, branch protection, product polish, and
durable media storage work.

This document is a consistency checkpoint only. It does not change runtime
behavior, launchers, deployment settings, schema, active FE7 source, backend
routes, or protected core files.

## Deleted Frontend Source Folders

These folders are deleted from tracked source and should appear only in
historical cleanup, audit, rollback, or static-test notes:

- `super-nova-2177/frontend-nova`
- `super-nova-2177/frontend-professional`
- `super-nova-2177/frontend-vite-3d`
- `super-nova-2177/frontend-next`
- `super-nova-2177/frontend-social-six`

Local launchers must not present these as active runnable frontends.
`run_local.py --list-frontends` should list only retained local choices, with
`frontend-social-seven` as active/default FE7.

## Active And Retained Surfaces

Keep these surfaces intact:

- Active FE7: `super-nova-2177/frontend-social-seven`
- Active backend: `super-nova-2177/backend/app.py`
- Protected duplicate core surface: `super-nova-2177/frontend-vite-basic`
- Protected duplicate core file:
  `super-nova-2177/frontend-vite-basic/supernovacore.py`
- Backend protected core file:
  `super-nova-2177/backend/supernova_2177_ui_weighted/supernovacore.py`
- Nested audited legacy surfaces:
  - `super-nova-2177/backend/supernova_2177_ui_weighted/nova-web`
  - `super-nova-2177/backend/supernova_2177_ui_weighted/nova-api`
  - `super-nova-2177/backend/supernova_2177_ui_weighted/transcendental_resonance_frontend`

`frontend-vite-basic` remains retained because it contains a protected duplicate
`supernovacore.py` and is part of the safe-check contract. Any future change to
that folder requires a dedicated protected-core-safe plan and protected-core
zero-diff verification.

## Accepted External Risks

The owner accepted these external uncertainties before the related deletion
PRs:

- `frontend-vite-3d`: possible external Vercel project root, `/api/*`
  deployment, DNS/domain, or env-var dependency.
- `frontend-next`: possible external Vercel/Railway/Docker project root,
  Supabase auth dependency, or `app/api/ai` exposure.
- `frontend-social-six`: possible Supabase provider redirect, Vercel/Railway
  project root, Docker deployment, social-auth/debug flow, or `app/api/ai`
  exposure.

Those risks are historical cleanup context, not active deployment claims.

## Cleanup Paused Or Deferred

- Do not delete more frontend source folders in the next sprint.
- Do not touch `frontend-vite-basic` without a protected-core-safe plan.
- Do not move, rename, or delete nested audited surfaces until their audit gates
  are satisfied.
- Do not change Docker Compose behavior without a dedicated Docker smoke/update
  or retirement PR.
- Do not touch uploads, databases, env files, secrets, Railway/Vercel settings,
  active FE7 source, backend runtime routes, schema, AI/auth/proposal/comment/
  vote behavior, or protected core during cleanup closeout.

## Next Priorities

1. Complete manual alpha browser smoke and signoff.
2. Enable branch protection manually with:
   - `Backend local deterministic checks`
   - `FE7 local deterministic checks`
3. Fix only confirmed alpha smoke blockers.
4. Polish the first-user product/UI experience.
5. Add durable object storage or equivalent for media.
6. Broaden E2E only after smoke stabilizes.

## Required Guards

Cleanup and alpha-readiness PRs should continue to verify protected core zero
diff:

```powershell
git diff --exit-code HEAD -- super-nova-2177/backend/supernova_2177_ui_weighted/supernovacore.py super-nova-2177/frontend-vite-basic/supernovacore.py
```

## Rollback

Rollback for this closeout doc is a single revert of the documentation and
static-test changes. Rollback for any deleted frontend remains a single revert
of that frontend's deletion PR.
