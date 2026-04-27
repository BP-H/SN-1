# Nested Backend And Lockfile Cleanup Assessment

Branch: `cleanup/assess-nested-backend-and-lockfiles`

Base commit: `c02f581` (`master` after PR #14)

Mode: investigation-only. No files were deleted, renamed, moved, or modified beyond this assessment document.

## Safety Boundary

This assessment did not touch runtime code, `supernovacore.py`, `backend/app.py`, auth, database files, uploads, migrations, dependencies, execution, webhooks, federation writes, domain verification fetching, AI runtime, frontend product logic, route behavior, or open dependency PRs.

## Baseline Checks

| Check | Result | Notes |
| --- | --- | --- |
| Current branch before investigation | Passed | Started from `master` at `c02f581`; PR #12, PR #13, and PR #14 are included. |
| Working tree before investigation | Passed | Clean before branch creation. |
| Protected `supernovacore.py` diff | Passed | Zero diff for backend and frontend protected core files. |
| `python scripts/check_safe.py --local-only` | Passed | Backend federation safety tests passed and protected core diff was zero. |
| `python scripts/check_safe.py` | Passed | Public protocol smoke passed: 72 passed, 0 failed. |
| `python scripts/smoke_social_backend.py https://2177.tech` | Passed with expected skips | 2 passed, 3 skipped, 0 failed. Frontend origin does not expose direct backend routes. |
| Backend federation safety tests | Passed | 11 tests OK. |
| FE7 `npm run lint` | Passed | Direct run in `super-nova-2177/frontend-social-seven`. |
| FE7 `npm run build` | Passed | Direct run in `super-nova-2177/frontend-social-seven`. |
| Strict backend smoke | Not proven locally | The available API origin resolved to local development and refused connection. No environment value was printed. |

## Cleanup Inventory Summary

`python scripts/list_cleanup_candidates.py` still reports these candidate classes:

| Candidate Class | Count | Current Disposition |
| --- | ---: | --- |
| Legacy or experimental frontend trees | 6 | Legacy-sensitive; do not delete yet. |
| Nested backend experiments | 5 files | Needs deeper audit before deletion. |
| Node lockfiles inside backend/module trees | 2 | Dependency-sensitive; do not delete yet. |
| Tracked uploads | 3 tracked files | Runtime/data-sensitive; do not delete yet. |
| Typo-named tracked files | 6 | Mixed risk; do not rename yet. |

This matches `CLEANUP_CANDIDATES_SNAPSHOT.md` after PR #9 and PR #10 cleanup.

## Candidate Table

| Candidate | Evidence Found | Risk Classification | Recommendation |
| --- | --- | --- | --- |
| `super-nova-2177/backend/supernova_2177_ui_weighted/backend/` | Search found references only in `CLEANUP_CANDIDATES_SNAPSHOT.md` and `scripts/list_cleanup_candidates.py` for the exact nested path. The folder contains its own `app.py`, `Dockerfile`, `docker-compose.yml`, `requirements.txt`, and `__init__.py`. | Needs deeper audit; deployment-sensitive because it contains Docker and FastAPI entrypoint files. | Do not delete yet. First compare against deploy docs/config and confirm no historical Railway/Docker workflow depends on it. |
| `super-nova-2177/backend/supernova_2177_ui_weighted/package-lock.json` | Lockfile exists without a sibling `package.json`. Top-level repo has separate package manifests. | Dependency/lockfile-sensitive, but likely orphaned. | Potential future deletion candidate only after confirming no tooling expects this lockfile from that directory. |
| `super-nova-2177/backend/supernova_2177_ui_weighted/nova-web/package-lock.json` | Has a sibling `nova-web/package.json`; `REPO_STATUS.md` and legacy docs mention `nova-web`. | Dependency/legacy-frontend-sensitive. | Do not delete separately from the `nova-web` legacy app assessment. |
| `super-nova-2177/backend/supernova_2177_ui_weighted/transcendental_resonance_frontend/tr_pages/animate_gaussion.py` | Search found the typo path in cleanup docs/tooling and internal dynamic imports inside the file. `tr_pages/__init__.py` does not list `animate_gaussion`. `src/main.py` does not import it. A separate lightweight wrapper exists at `pages/animate_gaussian.py`. | Low-to-medium rename risk; legacy frontend-sensitive. | Do not rename in this PR. A future `git mv` may be safe only after running the Transcendental Resonance page import tests. |
| `LikesDeslikes` files | Active FE7 has `content/proposal/content/LikesDeslikes.jsx`, imported by active `ProposalCard.jsx`. Legacy frontends also contain matching files. | Runtime-sensitive for FE7; legacy-sensitive elsewhere. | Do not rename yet. Any rename must update imports and pass FE7 lint/build. |
| Tracked upload files under `super-nova-2177/backend/uploads/` | Three files are tracked. Backend and FE7 contain active `/uploads/` URL handling. Additional local ignored uploads exist. | Runtime/data-sensitive. | Do not delete. Need database/post/avatar reference audit and storage policy first. |
| Legacy frontend trees | Listed by cleanup tooling. Some contain package locks, app code, Vercel-oriented docs, and component imports. | Legacy-sensitive. | Do not delete until FE7-only active status is proven across docs, deploy configs, and previews. |

## Reference Search Findings

### Nested Backend

Exact nested backend path references were limited to:

- `CLEANUP_CANDIDATES_SNAPSHOT.md`
- `scripts/list_cleanup_candidates.py`

General deploy searches found active deployment guidance for:

- root/Railway compatibility entrypoint: `super-nova-2177/app.py`
- active backend entrypoint: `super-nova-2177/backend/app.py`
- FE7 Vercel frontend: `super-nova-2177/frontend-social-seven`

The nested backend folder still contains deploy-looking files (`Dockerfile`, `docker-compose.yml`, `requirements.txt`, `app.py`), so deletion should be branch-tested and reviewed even if current references look inventory-only.

### Lockfiles

- `super-nova-2177/backend/supernova_2177_ui_weighted/package-lock.json` is a small lockfile with no sibling `package.json` found.
- `super-nova-2177/backend/supernova_2177_ui_weighted/nova-web/package-lock.json` has a sibling `nova-web/package.json` and appears tied to a legacy Next app.
- Root and active FE7 lockfiles are outside this cleanup scope and must not be touched here.

### Typo-Named Files

- `animate_gaussion.py` is not listed in `tr_pages/__init__.py` and is not imported by `transcendental_resonance_frontend/src/main.py`.
- The file itself dynamically imports other `tr_pages` modules.
- `LikesDeslikes` is actively imported by FE7 and legacy frontends. It is not a safe no-reference rename.

### Tracked Uploads

Tracked upload candidates:

- `super-nova-2177/backend/uploads/1bb86e27e1c741b08274c4753f393777`
- `super-nova-2177/backend/uploads/380fa79e48e847f7a83acf32f7b424cb`
- `super-nova-2177/backend/uploads/4f7003858bbd41a89a17743a562543f0`

Search found active `/uploads/` handling in:

- `super-nova-2177/backend/app.py`
- `super-nova-2177/frontend-social-seven/utils/avatar.js`
- protected legacy core files

The specific tracked filenames were only found in cleanup inventory docs, but upload deletion still needs a data-retention and live-reference audit before any change.

## CODEOWNERS Coverage

Covered:

- `scripts/smoke_social_backend.py`
- `SOCIAL_BACKEND_SMOKE_CHECK.md`
- `scripts/check_safe.py`
- `scripts/smoke_protocol.py`
- `RELEASE_CHECKLIST.md`
- `PROTOCOL_GUARANTEE_MATRIX.md`
- `scripts/list_cleanup_candidates.py`
- `MAINTENANCE_AUDIT.md`

Coverage gaps to consider in a separate docs/tooling PR:

- `CLEANUP_CANDIDATES_SNAPSHOT.md`
- `NESTED_BACKEND_AND_LOCKFILE_CLEANUP_ASSESSMENT.md`
- `CHANGELOG.md`

This PR does not edit CODEOWNERS.

## Recommended Future Cleanup Order

1. `docs/protect-cleanup-assessment-docs`: add CODEOWNERS coverage for cleanup snapshot and assessment docs. Docs/tooling only.
2. `cleanup/assess-tracked-uploads-retention`: investigation-only upload reference and retention assessment. No deletion.
3. `cleanup/assess-orphan-root-lockfile`: investigate whether `supernova_2177_ui_weighted/package-lock.json` is truly orphaned. No deletion until confirmed.
4. `cleanup/assess-animate-gaussion-rename`: reference search plus legacy Transcendental Resonance tests before any `git mv`.
5. `cleanup/assess-nested-backend-deploy-history`: deeper deploy/config audit for the nested backend folder before any deletion PR.

## Exact Next Tiny Cleanup PR

No deletion PR is recommended immediately after this assessment.

The safest next tiny PR is docs/tooling-only:

`docs/protect-cleanup-assessment-docs`

Scope:

- Add CODEOWNERS coverage for `CLEANUP_CANDIDATES_SNAPSHOT.md`.
- Add CODEOWNERS coverage for `NESTED_BACKEND_AND_LOCKFILE_CLEANUP_ASSESSMENT.md`.
- Do not touch runtime code or cleanup candidates.

## Do Not Touch Yet

- `super-nova-2177/backend/uploads/`
- legacy frontend folders
- `LikesDeslikes` files
- `animate_gaussion.py`
- nested backend deletion
- lockfile deletion
- database files
- auth code
- `supernovacore.py`
- `backend/app.py`
- dependency PRs
- VisionClient or AI runtime
- domain verification fetching
- Webmention, ActivityPub inbox, execution, or company webhook behavior

## Dependency PRs

Open dependency/security PRs should remain untouched during cleanup assessment:

- PR #1: Vercel RSC CVE/security update
- PR #4: Supabase client update
- PR #6: Tailwind update
- PR #7: eslint-config-next update

These should be handled one at a time only after smoke coverage and baseline checks remain stable.
