# First Legacy Frontend Removal Assessment

Branch: `cleanup/assess-first-legacy-frontend-removal`

Mode: assessment only. This pass does not delete, rename, move, refactor, or
change runtime behavior.

Current master commit inspected: `349414d`

## Summary

The single smallest and least deployment-sensitive top-level legacy frontend is:

`super-nova-2177/frontend-nova`

It has 26 tracked files, no `Dockerfile`, and no `vercel.json`. It is not the
active frontend, and production documentation identifies
`super-nova-2177/frontend-social-seven` as the active web surface.

However, `frontend-nova` is still referenced by local launcher tooling:

- `super-nova-2177/run_local.py`
- `super-nova-2177/start_supernova.ps1`
- `super-nova-2177/start_frontend_nova.ps1`

Because those references are not docs-only, this assessment does not recommend a
deletion PR yet. The safest future path is a tiny launcher/deprecation assessment
or a deletion PR that deliberately updates local launcher choices in the same
branch after review.

## Candidate Table

| Candidate | Tracked files | Package/deploy markers | Reference findings | Classification |
| --- | ---: | --- | --- | --- |
| `super-nova-2177/frontend-nova` | 26 | `package.json`; no `Dockerfile`; no `vercel.json` | Listed in cleanup docs, repo status, `run_local.py`, `start_supernova.ps1`, and `start_frontend_nova.ps1`; package self-references only otherwise. | Least risky future deletion candidate, but not safe to delete until launcher references are handled. |
| `super-nova-2177/frontend-professional` | 31 | `package.json`; no `Dockerfile`; no `vercel.json` | Listed in cleanup docs, repo status, `run_local.py`, `start_supernova.ps1`, and `start_frontend_professional.ps1`; package self-references only otherwise. | Possible later candidate after `frontend-nova`; launcher-sensitive. |
| `super-nova-2177/frontend-vite-basic` | 31 | `package.json`; no `Dockerfile`; no `vercel.json`; contains `supernovacore.py` | Listed in cleanup docs and local launchers; protected `supernovacore.py` diff is watched by safe checks. | Do not touch yet; protected-core-sensitive. |
| `super-nova-2177/frontend-next` | 61 | `package.json`, `Dockerfile`, `yarn.lock`; no `vercel.json` | Listed in cleanup docs, repo status, local launchers, and RSC/Next security assessment. | Deployment/security-sensitive; do not touch until separate legacy Next assessment. |
| `super-nova-2177/frontend-social-six` | 62 | `package.json`, `Dockerfile`, `SOCIAL_AUTH_SETUP.md`, `yarn.lock`; no `vercel.json` | Listed in cleanup docs, repo status, local launchers, and RSC/Next security assessment. | Auth/history-sensitive; do not touch until separate social-six assessment. |
| `super-nova-2177/frontend-vite-3d` | 108 | `package.json`, `vercel.json`, Vercel-style `api/` routes | Listed in cleanup docs, repo status, local launchers, and has its own Vercel config. | Deployment-sensitive; do not touch yet. |
| `super-nova-2177/backend/supernova_2177_ui_weighted/nova-web` | 35 | `package.json`, `package-lock.json`, Next config | Listed in nested cleanup/security docs; mentioned by legacy docs and universe docs. | Nested legacy app; deployment/cleanup-sensitive. Do not delete in first frontend cleanup. |
| `super-nova-2177/backend/supernova_2177_ui_weighted/transcendental_resonance_frontend` | 101 | Python package with requirements and many tests | Imported by core-side utilities, tests, docs, install scripts, and compatibility wrappers. | Do not touch; active legacy Python UI package. |
| `super-nova-2177/backend/supernova_2177_ui_weighted/frontend` | 5 | Python package; no package/deploy files | Imported by many core-side modules and tests via `frontend.theme`, `frontend.ui_layout`, and related helpers. | Do not touch; active internal Python UI helper package. |
| `super-nova-2177/backend/supernova_2177_ui_weighted/web_ui` | 2 | Python compatibility wrapper | Redirects/imports `transcendental_resonance_frontend`; documented as historical name. | Do not touch without compatibility audit. |

## Reference Search Findings

Searches excluded `node_modules`, `.next`, `.venv`, and `__pycache__`.

### Package Files

- Top-level legacy frontends with `package.json`:
  - `frontend-next`
  - `frontend-nova`
  - `frontend-professional`
  - `frontend-social-six`
  - `frontend-vite-3d`
  - `frontend-vite-basic`
- Nested legacy web app with `package.json`:
  - `backend/supernova_2177_ui_weighted/nova-web`
- No root package script was found pointing production deployment at a legacy
  frontend. `universe.fork.json` identifies `frontend-social-seven` as active.

### Vercel, Railway, Docker, And CI

- `frontend-vite-3d` contains its own `vercel.json`, so it is
  deployment-sensitive.
- `frontend-next` and `frontend-social-six` contain `Dockerfile`s and are also
  called out in the RSC/Next security assessment.
- No `.github/workflows` references were found that directly select the legacy
  frontend candidates.
- `REPO_STATUS.md` identifies `frontend-social-seven` as active and lists the
  other frontend folders as legacy or experimental.

### Local Launcher References

The following local launcher surfaces still enumerate top-level legacy
frontends:

- `super-nova-2177/run_local.py`
- `super-nova-2177/start_supernova.ps1`
- individual `start_frontend_*.ps1` launchers, including:
  - `start_frontend_nova.ps1`
  - `start_frontend_professional.ps1`
  - `start_frontend_vite_basic.ps1`
  - `start_frontend_vite_3d.ps1`
  - `start_frontend_next.ps1`
  - `start_frontend_social_six.ps1`

These references mean deletion is not purely docs-only.

### Imports

- `backend/supernova_2177_ui_weighted/frontend` is imported by core-side modules
  and tests; it is not a safe deletion candidate.
- `transcendental_resonance_frontend` is imported by tests, utilities, docs, and
  compatibility wrappers; it is not a safe deletion candidate.
- Top-level JavaScript frontend folders do not appear to be imported by active
  backend Python code, but they are still exposed through local launchers.

## Deployment And Config Risk

| Area | Risk |
| --- | --- |
| Active FE7 | Do not touch. It is the production-facing frontend. |
| `frontend-vite-3d` | High cleanup risk because it has `vercel.json` and `api/` route files. |
| `frontend-next` and `frontend-social-six` | Medium-to-high cleanup risk because they are legacy Next apps with Dockerfiles and prior RSC/Next security findings. |
| `frontend-vite-basic` | Medium-to-high cleanup risk because it contains a protected `supernovacore.py` copy tracked by safe-check zero-diff rules. |
| `frontend-nova` | Lowest deployment risk among top-level legacy apps, but launcher-sensitive. |
| `nova-web` | Nested/deployment-sensitive; should remain under the nested backend/lockfile cleanup plan. |
| Python UI packages | Import-sensitive; should not be treated as disposable frontend folders. |

## Recommended First Deletion Candidate

No deletion PR should be opened yet because even the safest candidate has
non-doc local launcher references.

Safest later candidate:

`super-nova-2177/frontend-nova`

Suggested next branch before deletion:

`cleanup/prepare-frontend-nova-removal`

That future branch should either:

- update local launcher choices and docs to remove or deprecate `frontend-nova`,
  then delete `frontend-nova` in the same reviewed PR; or
- document why launcher support should be retained and defer deletion again.

Do not delete `frontend-nova` in isolation while `run_local.py`,
`start_supernova.ps1`, and `start_frontend_nova.ps1` still reference it.

## Exact Files And Folders Not To Touch Yet

- `super-nova-2177/frontend-social-seven`
- `super-nova-2177/frontend-vite-basic/supernovacore.py`
- `super-nova-2177/backend/supernova_2177_ui_weighted/supernovacore.py`
- `super-nova-2177/backend/app.py`
- `super-nova-2177/backend/supernova_2177_ui_weighted/db_models.py`
- DB files
- migrations
- uploads
- dependencies and lockfiles
- routes
- auth behavior
- federation writes
- execution
- domain verification
- AI runtime
- environment files
- secrets
- Railway or Vercel project settings
- `backend/supernova_2177_ui_weighted/transcendental_resonance_frontend`
- `backend/supernova_2177_ui_weighted/frontend`
- `backend/supernova_2177_ui_weighted/web_ui`
- `backend/supernova_2177_ui_weighted/nova-web`

## Required Checks Before Any Future Deletion

- Confirm the deletion branch starts from current `master`.
- Search references again with `rg`, excluding generated dependency/build
  folders.
- Confirm active FE7 remains untouched.
- If deleting `frontend-nova`, update or remove:
  - `super-nova-2177/run_local.py` entries for `nova`
  - `super-nova-2177/start_supernova.ps1` option for `frontend-nova`
  - `super-nova-2177/start_frontend_nova.ps1`
  - cleanup/status docs that mention the folder
- Run:
  - `python -m unittest super-nova-2177/backend/tests/test_db_utils_fallback.py`
  - `python -m unittest super-nova-2177/backend/tests/test_db_engine_consistency.py`
  - `python -m unittest super-nova-2177/backend/tests/test_secret_key_hardening.py`
  - `python -m unittest super-nova-2177/backend/tests/test_public_federation_safety.py`
  - `python scripts/check_safe.py --local-only`
  - `python scripts/check_safe.py`
  - `python scripts/smoke_social_backend.py https://2177.tech`
  - FE7 `npm run lint`
  - FE7 `npm run build`
  - protected `supernovacore.py` diff zero

## Rollback Plan

For this assessment PR:

- Revert the assessment commit. No runtime behavior changes are present.

For a future deletion PR:

- Revert the deletion commit.
- Restore any launcher entries removed in the same PR.
- Re-run the required checks above.
- Confirm `frontend-social-seven` still builds and protected `supernovacore.py`
  diff remains zero.

## Bottom Line

`frontend-nova` is the smallest and least deployment-sensitive top-level legacy
frontend. It is the likely first future removal candidate, but not yet safe for
deletion because local launcher tooling still references it. The next safe step
is a focused `frontend-nova` removal preparation PR, not deletion in this
assessment.
