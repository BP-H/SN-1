# SECRET_KEY and DB Engine Hardening Assessment

Assessment branch: `security/assess-secret-key-and-db-engine`

Baseline commit inspected: `6b3e64e`

Scope: investigation only. This assessment did not inspect, print, or commit live
environment values. It records environment variable names and source-code
defaults only.

## Executive Summary

The active backend normally loads SuperNova through `backend/supernova_runtime.py`,
which configures `DATABASE_URL`/`DB_MODE` before importing the core and exposes a
shared `SessionLocal` back to `backend/app.py` and `backend/db_utils.py`.

The main production-relevant secret behavior is split between:

- the active core settings in `supernova_2177_ui_weighted/supernovacore.py`,
  which generate a random `SECRET_KEY` when one is absent;
- compatibility fallbacks in `backend/app.py` and `auth_utils.py`, which can fall
  back to the static placeholder `changeme` if the core runtime/settings are not
  available;
- legacy or experimental UI surfaces that still use development placeholders
  such as `dev`.

No code was changed in this pass. The safest next implementation is a tiny
production-only secret guard that fails startup only when an explicit production
environment is set and the backend would otherwise use a missing or weak
placeholder secret. DB engine cleanup should come after that, with tests, because
the current wrapper/core/database import order is compatibility-sensitive.

## Files Inspected

| Area | Files |
| --- | --- |
| Active backend wrapper | `super-nova-2177/backend/app.py`, `super-nova-2177/backend/supernova_runtime.py`, `super-nova-2177/backend/db_utils.py` |
| Active core and models | `super-nova-2177/backend/supernova_2177_ui_weighted/supernovacore.py`, `super-nova-2177/backend/supernova_2177_ui_weighted/db_models.py`, `super-nova-2177/backend/supernova_2177_ui_weighted/auth_utils.py` |
| Legacy/experimental surfaces | `super-nova-2177/frontend-vite-basic/supernovacore.py`, `super-nova-2177/backend/supernova_2177_ui_weighted/backend/app.py`, `super-nova-2177/backend/supernova_2177_ui_weighted/transcendental_resonance_frontend/tr_pages/animate_gaussion.py` |
| Supporting utilities/tests/docs | `super-nova-2177/backend/supernova_2177_ui_weighted/validate_hypothesis.py`, backend tests using `DB_MODE`/`DATABASE_URL`, Dockerfiles, README guidance |

## Environment Names Observed

No values were recorded.

| Name | Observed role |
| --- | --- |
| `SECRET_KEY` | JWT signing secret for backend/core auth paths. |
| `ALGORITHM` | JWT algorithm, defaulting to `HS256` in observed paths. |
| `DATABASE_URL` | Production/Railway database URL when provided; local SQLite fallback when absent. |
| `DB_MODE` | Core database mode. `central` requires `DATABASE_URL` in `db_models.py`. |
| `SUPERNOVA_ENV` | Backend wrapper production/development gate for debug routes and some sync behavior. |
| `APP_ENV` | Streamlit profile card environment badge and related tests. |
| `ENV` | Legacy transcendental UI environment label/default. |
| `NODE_ENV` | FE7 Docker production runtime flag. |
| `NEXT_PUBLIC_API_URL` | Frontend/backend API origin, documented by smoke checks. |
| `ALLOWED_ORIGINS`, `BACKEND_ALLOWED_ORIGINS` | Backend CORS allowlist/open federation settings. |
| `UPLOADS_DIR` | Backend upload directory. |
| `ENABLE_BULK_PROPOSAL_DELETE` | Explicit destructive admin route gate. |

## Secret Handling Findings

| File | Current behavior | Production risk | Classification |
| --- | --- | --- | --- |
| `backend/app.py` | Uses runtime `get_settings()` when SuperNova is available. If runtime import fails, fallback settings read `SECRET_KEY` or use `changeme`. JWT creation/decoding use those settings. | A production runtime fallback could silently sign/verify JWTs with a placeholder secret. | Needs tiny production-only hardening. |
| `backend/supernova_2177_ui_weighted/auth_utils.py` | Tries core `get_settings()`. If that fails, fallback settings read `SECRET_KEY` or use `changeme`. | Same placeholder fallback risk in standalone helper paths. | Needs tiny production-only hardening. |
| `backend/supernova_2177_ui_weighted/supernovacore.py` | Core settings generate a random secret when `SECRET_KEY` is absent. Comments warn not to hard-code production secrets. | Safer than a static default, but generated-at-start secrets can invalidate tokens across restarts if production omits `SECRET_KEY`. | Needs docs warning or production explicit-secret guard. |
| `frontend-vite-basic/supernovacore.py` | Legacy duplicate core-like file with generated `SECRET_KEY` fallback and DB engine logic. | Legacy surface should not be assumed active without a separate deployment assessment. | Do not touch in first hardening PR. |
| `transcendental_resonance_frontend/tr_pages/animate_gaussion.py` | Legacy Streamlit page defaults missing secrets to development values and can display DB/env details in UI. | Risky if deployed as a real production UI, but not the active FE7 surface. | Needs separate legacy UI assessment, not first backend hardening PR. |
| README/example files | Include local/dev examples such as `dev` secrets. | Fine for examples if clearly labeled local-only. | Docs-only warning can improve clarity. |

## DB Engine Findings

| File | Current behavior | Production relevance | Classification |
| --- | --- | --- | --- |
| `backend/supernova_runtime.py` | Preferred wrapper path. Preserves provided `DATABASE_URL`; otherwise sets `DB_MODE=central` and points `DATABASE_URL` at a local SQLite file. | Active production-relevant wrapper. | Keep. Add tests before changing. |
| `backend/app.py` | Uses runtime `SessionLocal` when available. Fallback creates its own SQLAlchemy engine from `DATABASE_URL` or local SQLite. | Active wrapper with standalone fallback. | Do not remove fallback until runtime import behavior is covered by tests. |
| `backend/db_utils.py` | Uses runtime `session_local` when available. Fallback creates its own engine from `DATABASE_URL` or local SQLite. | Active utility. | Candidate for later duplicate-engine cleanup after tests. |
| `backend/supernova_2177_ui_weighted/db_models.py` | Active core model module. Creates module-level `engine`/`SessionLocal`; `central` mode requires `DATABASE_URL`; `init_db()` can rebind the engine. | Active production-relevant. | Do not edit in first hardening PR. |
| `backend/supernova_2177_ui_weighted/supernovacore.py` | Protected core. Fallback imports `SessionLocal`; can create fallback engine; `create_app()` rebinds `db_models.engine` to settings engine URL. | Active/protected core. | Do not touch for first pass. |
| `backend/supernova_2177_ui_weighted/backend/app.py` | Nested backend experiment with separate FastAPI app and Postgres default. | Deployment-sensitive legacy/nested candidate. | Do not touch without separate cleanup/deployment proof. |
| `validate_hypothesis.py` | Utility creates an engine from an explicit CLI `--db-url`. | Tooling path, not production API. | Keep. |
| `frontend-vite-basic/supernovacore.py` | Legacy duplicate core-like file with fallback engine and rebind logic. | Legacy/experimental unless separately deployed. | Do not touch until legacy surface assessment. |

## Current Behavior Summary

1. In the expected active backend path, `backend/app.py` loads
   `backend/supernova_runtime.py`, which imports the core and returns shared
   settings, models, and `SessionLocal`.
2. `supernova_runtime.py` keeps a provided `DATABASE_URL` and sets `DB_MODE` to
   `central` by default. In local development, it points `DATABASE_URL` to a
   local SQLite file so existing local data remains visible.
3. `db_models.py` creates the core module-level engine. In `central` mode, it
   raises if `DATABASE_URL` is absent. Outside `central`, it can fall back to a
   local SQLite URL.
4. JWT creation and verification in the wrapper use `get_settings().SECRET_KEY`.
   If the runtime is available, this comes from the core settings. If runtime
   loading fails, `backend/app.py` and `auth_utils.py` have compatibility
   fallbacks that can use `changeme`.
5. The protected core does not use a static `changeme` default for its main
   settings; it generates a random secret if `SECRET_KEY` is absent. This avoids
   a hard-coded secret, but production should still provide a stable explicit
   secret so sessions survive restarts.

## Risks Found

| Risk | Severity | Notes |
| --- | --- | --- |
| Production fallback to `changeme` in wrapper/auth utilities | High if fallback path ever runs in production | The fallback is compatibility-first but should not be acceptable under an explicit production environment. |
| Production missing `SECRET_KEY` with generated random core secret | Medium | Safer than static default, but causes token invalidation across restarts and hides misconfiguration. |
| Multiple fallback SQLAlchemy engine creation paths | Medium | Current runtime path centralizes most active usage, but fallbacks can diverge under import errors or tools. |
| Legacy/nested backend DB defaults | Medium | Not clearly active, but deployment-sensitive and should remain untouched until separate assessment/cleanup. |
| Legacy UI development secrets/debug display | Medium if deployed, low for inactive code | Needs separate legacy UI/deployment review. |

## Fix Classification

| Future fix type | Recommended? | Scope |
| --- | --- | --- |
| Docs-only warning | Yes, safe anytime | Clarify that production must set stable `SECRET_KEY` and `DATABASE_URL`; local examples are local-only. |
| Local-dev warning | Yes, after tests | Warn when local/dev uses placeholder defaults, but do not break local workflows. |
| Production-only hard error | Yes, first runtime hardening candidate | If an explicit production env is set and the fallback secret is missing/weak, fail startup or settings creation. |
| Duplicate DB engine cleanup | Later | Requires tests proving the wrapper, `db_utils`, core `SessionLocal`, and app routes share the intended bind. |

## Recommended Future PR Order

### PR 1: Tiny Production Secret Guard

Goal: prevent production from silently using missing or placeholder JWT secrets.

Suggested future branch:

`security/harden-production-secret-key`

Suggested scope:

- Add a small helper that detects explicit production-like environments by name,
  without reading or printing values.
- Reject missing/weak placeholder `SECRET_KEY` only when explicit production is
  set.
- Preserve local/dev/test compatibility.
- Prefer touching wrapper/fallback auth surfaces first. Avoid
  `supernovacore.py` and `db_models.py` in the first implementation unless the
  tests prove there is no safer wrapper-level path.

Tests needed:

- Production env plus missing/placeholder secret fails.
- Production env plus strong explicit secret passes.
- Development/local env with missing secret still starts for local tests.
- Runtime/core happy path remains unchanged.
- Existing backend federation safety tests still pass.

Rollback plan:

- Revert the tiny guard commit.
- Keep docs warning intact.
- Production can restore previous behavior by unsetting the explicit production
  marker while the fix is investigated, but only as an emergency rollback.

### PR 2: DB Engine Consistency Tests

Goal: prove the active app/runtime/database path before deleting or merging
fallback engine logic.

Suggested future branch:

`test/assert-shared-db-engine-runtime`

Suggested scope:

- Add tests that load the active backend wrapper and verify the runtime
  `SessionLocal`, `db_utils.SessionLocal`, and app-visible `SessionLocal` bind to
  the same intended engine under normal runtime loading.
- Add fallback-path tests only if they can be isolated without touching live DB
  files or migrations.

Rollback plan:

- Revert tests only. No production behavior changes.

### PR 3: Duplicate DB Engine Cleanup

Goal: remove or reduce duplicate fallback engine creation only after tests prove
the intended path.

Suggested future branch:

`security/centralize-backend-db-engine-fallback`

Suggested scope:

- Keep `db_models.py` and `supernovacore.py` untouched unless a focused test
  proves a safe change.
- Prefer consolidating wrapper fallback behavior around `supernova_runtime.py`
  and `db_utils.py`.
- Do not touch DB files, migrations, uploads, or legacy/nested backend folders.

Rollback plan:

- Revert the cleanup commit.
- Restore previous fallback engine creation.
- Confirm local and live smoke pass before any reattempt.

## What Not To Touch Yet

- `super-nova-2177/backend/supernova_2177_ui_weighted/supernovacore.py`
- `super-nova-2177/backend/app.py` route behavior or route structure
- `super-nova-2177/backend/supernova_2177_ui_weighted/db_models.py`
- DB files, migrations, uploads, or environment files
- Legacy frontend folders and nested backend experiments
- Auth flow behavior beyond a narrowly tested production-only secret guard
- Federation writes, execution, domain verification, AI runtime, or frontend
  product logic

## Required Checks Before Any Runtime Change

- `python scripts/check_safe.py --local-only`
- `python scripts/check_safe.py`
- `python scripts/smoke_social_backend.py https://2177.tech`
- `python -m unittest super-nova-2177/backend/tests/test_public_federation_safety.py`
- FE7 `npm run lint`
- FE7 `npm run build`
- protected `supernovacore.py` diff zero
- new focused tests for production secret handling or DB engine behavior,
  depending on the PR
- manual confirmation that no secret, token, cookie, database URL, callback code,
  or environment value is printed in logs, docs, PR bodies, or CI output

## Bottom Line

The safest high-impact next runtime hardening is not DB cleanup yet. It is a
small production-only secret guard that makes insecure fallback secrets
impossible when an explicit production environment is configured, while leaving
local development alone.

DB engine cleanup is valuable, but it should come after shared-engine tests. The
current active path is close to centralized, yet the compatibility fallbacks and
protected core rebind behavior make a direct cleanup riskier than a test-first
approach.
