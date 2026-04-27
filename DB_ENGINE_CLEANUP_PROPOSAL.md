# DB Engine Cleanup Proposal

Branch: `security/propose-db-engine-cleanup`

Mode: proposal only. This pass does not change runtime code, DB behavior, DB
files, migrations, environment files, secrets, routes, frontend logic,
federation writes, execution, domain verification, or AI runtime.

## Recommendation

Defer runtime DB engine cleanup for now.

PR #32 proved the normal active runtime wiring, but it did not prove every
fallback, standalone import, legacy deployment, or partial-dependency edge case.
The next safest work should remain test-first. If a later cleanup PR is opened,
it should be tiny, wrapper-only, and should not touch `supernovacore.py` or
`db_models.py`.

## What PR #32 Proved

PR #32 added `super-nova-2177/backend/tests/test_db_engine_consistency.py`.

In a child process with a controlled temporary SQLite `DATABASE_URL`, it proved:

- `backend.supernova_runtime` imports successfully.
- `backend.app` imports successfully.
- `backend.db_utils` imports successfully.
- `backend.supernova_runtime.load_supernova_runtime()` reports an available
  runtime.
- `backend.app.SessionLocal` is the same runtime session factory.
- `backend.db_utils.SessionLocal` is the same runtime session factory.
- runtime, app, and `db_utils` session binds match the controlled temporary
  SQLite URL.

The test did not use, print, or commit live production DB values.

## DB Engine Paths Still Present

| Path | Role | Current status | Cleanup posture |
| --- | --- | --- | --- |
| `super-nova-2177/backend/supernova_runtime.py` | Active runtime loader. Preserves provided `DATABASE_URL`; otherwise sets `DB_MODE=central` and points to a local SQLite file. | Active production-relevant wrapper path. | Keep. This is the central path PR #32 verified. |
| `super-nova-2177/backend/app.py` | Active backend wrapper. Uses runtime `SessionLocal` when available; otherwise creates a standalone fallback engine. | Active wrapper plus compatibility fallback. | Do not change yet; fallback import behavior needs separate coverage. |
| `super-nova-2177/backend/db_utils.py` | Active utility. Uses runtime `session_local` when available; otherwise creates a standalone fallback engine. | Active utility plus compatibility fallback. | Potential smallest future cleanup target, but only after fallback-specific tests. |
| `super-nova-2177/backend/supernova_2177_ui_weighted/db_models.py` | Core model module. Creates module-level `engine`/`SessionLocal`; `central` mode requires `DATABASE_URL`; `init_db()` can rebind. | Active production-relevant core model path. | Do not touch in the next cleanup. |
| `super-nova-2177/backend/supernova_2177_ui_weighted/supernovacore.py` | Protected core. Can import or create `SessionLocal`; `create_app()` rebinds `db_models.engine` to settings engine URL. | Active/protected core path. | Do not touch. |
| `super-nova-2177/backend/supernova_2177_ui_weighted/backend/app.py` | Nested backend experiment with separate FastAPI/Postgres handling. | Legacy/nested/deployment-sensitive candidate. | Do not touch in DB engine cleanup. Assess separately. |
| `super-nova-2177/frontend-vite-basic/supernovacore.py` | Legacy duplicate core-like file with DB logic. | Legacy/experimental unless separately deployed. | Do not touch in backend cleanup. |
| `validate_hypothesis.py` | CLI/tooling path using explicit `--db-url`. | Tooling, not production API. | Keep. |

## Active Runtime Versus Fallback/Standalone

Active runtime path:

1. `backend.app` imports `load_supernova_runtime()`.
2. `supernova_runtime` configures the environment for the core import.
3. The core exposes `SessionLocal`.
4. `backend.app.SessionLocal` and `backend.db_utils.SessionLocal` share that
   runtime `SessionLocal`.

Fallback/standalone paths:

- `backend.app` has a standalone SQLAlchemy engine fallback if SuperNova runtime
  loading is unavailable.
- `backend.db_utils` has a standalone SQLAlchemy engine fallback if the runtime
  session is unavailable.

Those fallbacks are duplicated, but they preserve partial-environment and
standalone compatibility. They should not be removed or merged without focused
tests proving the desired fallback behavior.

## Smallest Possible Future Cleanup PR

Recommended future branch:

`test/assert-db-utils-fallback-engine-behavior`

Recommended scope:

- Add tests for `backend.db_utils` fallback behavior in an isolated child
  process.
- Force `load_supernova_runtime()` to be unavailable without touching live
  environment values.
- Use a controlled temporary SQLite URL.
- Assert `db_utils.SessionLocal` can still create and close a session.
- Do not change runtime code in that PR.

Only after that test exists should a code cleanup be considered. If still safe,
the smallest runtime cleanup candidate would be a narrow `backend/db_utils.py`
fallback refactor that removes duplication while preserving the same fallback
contract. It should not touch `backend/app.py`, `db_models.py`, or
`supernovacore.py`.

## Why `supernovacore.py` and `db_models.py` Remain Untouched

- They are active/protected core surfaces.
- `db_models.py` owns module-level model bindings and `init_db()` rebinding.
- `supernovacore.py` owns core app initialization and core DB rebinding.
- Changing either file would increase blast radius beyond the wrapper-level
  cleanup target.
- PR #32 proves wrapper/runtime sharing, not every core rebind edge case.

## Tests Required Before Any DB Cleanup

- `python -m unittest super-nova-2177/backend/tests/test_db_engine_consistency.py`
- New fallback-specific DB test if fallback code changes.
- `python scripts/check_safe.py --local-only`
- `python scripts/check_safe.py`
- `python scripts/smoke_social_backend.py https://2177.tech`
- `python -m unittest super-nova-2177/backend/tests/test_public_federation_safety.py`
- `python -m unittest super-nova-2177/backend/tests/test_secret_key_hardening.py`
- FE7 `npm run lint`
- FE7 `npm run build`
- protected `supernovacore.py` diff zero

## Rollback Plan

For test-only PRs:

- Revert the test commit.
- No production behavior changes should need rollback.

For a later runtime cleanup PR:

- Revert the cleanup commit.
- Re-run DB consistency tests, safe checks, live read-only smokes, backend
  federation safety tests, secret hardening tests, and FE7 lint/build.
- Confirm protected `supernovacore.py` diff remains zero.

## Do Not Touch Yet

- `super-nova-2177/backend/supernova_2177_ui_weighted/supernovacore.py`
- `super-nova-2177/backend/supernova_2177_ui_weighted/db_models.py`
- DB files
- migrations
- uploads
- dependencies
- frontend logic
- auth behavior
- routes
- federation writes
- execution
- domain verification
- AI runtime
- environment files
- secrets
- nested backend experiments
- legacy frontend folders

## Bottom Line

This pass should remain docs-only.

PR #32 gives useful confidence in the active runtime path. It does not make DB
engine cleanup automatically safe. The safest next step is fallback-specific
test coverage, then a separate tiny `db_utils.py` cleanup only if those tests
prove compatibility is preserved.
