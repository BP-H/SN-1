# Production Readiness Gap Assessment

Branch: `production/assess-upload-env-ci-backup-readiness`

Mode: docs-only assessment. This pass does not change runtime code, frontend
behavior, workflows, package files, lockfiles, database files, migrations,
uploads, deployment settings, environment files, secrets, or protected core.

Current master commit inspected: `6065045` (post PR #123)

## Summary

PR #46 added the core-change protocol and SuperNova Lab strategy. The next
production-readiness work should stay small and sequenced. The safest order is:

1. upload hardening tests and limits;
2. FE7 API origin fail-fast tests and production guard;
3. non-surprising CI gates;
4. backup/restore runbook;
5. then pagination implementation work already scoped by
   `PAGINATION_AND_INDEXES_ASSESSMENT.md`.

None of these steps should touch `supernovacore.py`. Any future core semantic
change must follow `CORE_CHANGE_PROTOCOL.md`.

## Alpha Readiness Update

Current alpha progress after the recent guardrail PRs:

- Auth-bound write guardrails now have focused coverage for profile mutation,
  messages, profile-image sync, follows, comments, system-vote writes, and
  proposal create/edit/delete.
- Collab request routes, delete-with-collabs behavior, approved-collab profile
  visibility, and public connector read behavior have focused coverage.
- MCP backend-origin documentation now calls out that `SUPERNOVA_API_BASE_URL`
  must point to the backend JSON API origin that serves `/connector/supernova`.
- Upload hardening is now implemented with bounded streaming writes, 20 MB
  image/avatar caps, 250 MB video caps, 50 MB document caps, focused tests,
  and partial-file cleanup assertions.
- FE7 production API-origin fail-fast is implemented in
  `frontend-social-seven/utils/apiBase.js`; local/dev fallback remains
  `http://127.0.0.1:8000`.
- A PR-triggered `local-safe-pr-gates.yml` workflow now covers deterministic
  backend tests, `check_safe.py --local-only`, FE7 lint/build, and protected
  core zero-diff checks.
- `BACKUP_RESTORE_RUNBOOK.md` now exists and is referenced by
  `RELEASE_CHECKLIST.md`.

Remaining production gaps should stay explicit:

- rate limiting and abuse controls;
- CI becoming required branch protection after the PR gates are proven stable;
- backup/restore verification drills against the real production process;
- continued dependency update hardening after the initial cold-start audit;
- router split and `/v1` route versioning;
- staged legacy frontend cleanup with reference checks and no protected-core
  changes.

Audit-only notes for future dedicated PRs:

- Rate limiting and abuse controls should be the next security-focused backend
  PR. Do not add new packages or broad middleware in mixed product polish work.
- The initial backend dependency/cold-start audit moved duplicate optional
  analysis/ML packages out of `backend/requirements.txt`; keep future
  dependency changes in dedicated PRs with startup/import verification.
- Infinite-scroll sentinel polish belongs in a product UX PR, separate from
  backend hardening.
- ActivityPub, constellation, and governance surfacing should remain explicit
  product/innovation follow-ups, not alpha-release hardening work.

## Priority Table

| Priority | Future PR | Risk | Allowed files | Recommendation |
| --- | --- | --- | --- | --- |
| 1 | Upload hardening tests and limits | Medium | `super-nova-2177/backend/app.py`, focused backend tests only | Implement after tests; keep extensions/MIME compatibility and add size caps without changing storage provider. |
| 2 | FE7 API origin fail-fast | Medium | `super-nova-2177/frontend-social-seven/utils/apiBase.js`, focused FE7 tests if available, docs | Add production-only guard so production builds cannot silently use localhost when `NEXT_PUBLIC_API_URL` is missing. |
| 3 | CI/release gates | Low-medium | `.github/workflows/*`, `RELEASE_CHECKLIST.md` if needed | Add required-safe checks gradually and keep manual/live checks separate from PR-blocking checks until stable. |
| 4 | Backup/restore runbook | Low | `BACKUP_RESTORE_RUNBOOK.md`, `RELEASE_CHECKLIST.md`, CODEOWNERS/changelog | Docs-only first. Do not touch live DB, uploads, env vars, Railway, or Vercel settings. |

## 1. Upload Hardening

Files inspected:

- `super-nova-2177/backend/app.py`
- `super-nova-2177/backend/uploads/`
- `super-nova-2177/frontend-social-seven/content/create post/InputFields.jsx`
- `super-nova-2177/frontend-social-seven/content/profile/Profile.jsx`

Current behavior observed:

- Active backend mounts `uploads_dir` at `/uploads`.
- `UPLOADS_DIR` can override the uploads directory; otherwise it defaults to
  `super-nova-2177/backend/uploads`.
- Upload extension allowlists exist:
  - images: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.avif`, `.bmp`,
    `.heic`, `.heif`;
  - videos: `.mp4`, `.webm`, `.mov`, `.m4v`, `.ogg`, `.ogv`;
  - documents: `.csv`, `.doc`, `.docx`, `.json`, `.md`, `.pdf`, `.ppt`,
    `.pptx`, `.rtf`, `.txt`, `.xls`, `.xlsx`.
- MIME/type checks exist through `_upload_matches`.
- Files are saved with UUID names.
- Writes use `shutil.copyfileobj(..., length=1024 * 1024)`, which is a copy
  buffer size, not a maximum upload size.
- No explicit max file-size limit was found.
- No per-type size limit was found.
- No quota or cleanup policy was found.
- Oversized upload error behavior is not currently documented by tests.

Smallest safe future implementation PR:

- Add focused upload tests first or in the same tiny PR:
  - accepted small image remains accepted;
  - unsupported extension remains rejected;
  - oversized image/video/document returns `413` or a clear `400`;
  - partial file is not left behind on rejection.
- Add central constants in `backend/app.py`, for example:
  - image max;
  - video max;
  - document max;
  - avatar max if different.
- Replace raw copy with a bounded streaming helper that counts bytes.
- Preserve current extension/MIME behavior.
- Keep storage path and public `/uploads` behavior unchanged.

Rollback plan:

- Revert the bounded upload helper and tests.
- Because no DB/schema change should be included, rollback should be a single
  commit revert.
- If production rejects legitimate uploads, restore previous copy behavior while
  keeping the tests marked as expected future coverage.

Do not combine with:

- upload storage migration;
- cloud blob storage;
- quota enforcement;
- cleanup deletion;
- auth changes.

## 2. FE7 API Origin Fail-Fast

Files inspected:

- `super-nova-2177/frontend-social-seven/utils/apiBase.js`
- active FE7 imports of `API_BASE_URL` and `absoluteApiUrl`
- `super-nova-2177/frontend-social-seven/README.md`
- `super-nova-2177/frontend-social-seven/SOCIAL_AUTH_SETUP.md`

Current behavior observed:

- `API_BASE_URL` is derived from `process.env.NEXT_PUBLIC_API_URL`.
- Missing env currently falls back to `http://127.0.0.1:8000`.
- Production docs say Vercel should set `NEXT_PUBLIC_API_URL` to the Railway
  backend URL without a trailing slash.
- A missing production env can therefore silently point a production build at
  localhost.

Smallest safe future implementation PR:

- Add a production-only guard in `utils/apiBase.js`.
- Preserve local/dev fallback to `http://127.0.0.1:8000`.
- In production, throw a clear error when `NEXT_PUBLIC_API_URL` is missing or
  empty.
- Consider treating `localhost` and `127.0.0.1` as invalid only when
  `NODE_ENV === "production"`.
- Add a tiny test if the FE7 test harness exists; otherwise document manual
  verification in the PR body.

Rollback plan:

- Revert the guard in `utils/apiBase.js`.
- Since this only affects frontend env validation, no DB or backend rollback is
  required.

Do not combine with:

- API client refactor;
- auth/session changes;
- direct backend strict-smoke changes;
- Vercel env mutation.

## 3. Release And CI Gates

Files inspected:

- `.github/workflows/protocol-smoke.yml`
- `.github/workflows/safe-check.yml`
- `RELEASE_CHECKLIST.md`
- `scripts/check_safe.py`
- `scripts/smoke_protocol.py`
- `scripts/smoke_social_backend.py`

Current workflow coverage:

| Check | Documented in release checklist | Existing workflow coverage | Gap |
| --- | --- | --- | --- |
| `python scripts/check_safe.py --local-only` | Yes | PR-triggered in `local-safe-pr-gates.yml`; manual `workflow_dispatch` in `safe-check.yml` | Branch protection can require it later after stability is proven. |
| `python scripts/check_safe.py` | Yes | Not directly enforced; protocol smoke workflow covers live protocol separately | Full live check remains manual/local. |
| Backend deterministic tests | Yes | Focused backend tests run in `local-safe-pr-gates.yml` | Broader backend suites remain manual per PR scope. |
| Public protocol smoke | Yes | Scheduled and manual workflow | Not PR-triggered and live target should remain non-blocking until stable. |
| Social/backend smoke | Yes | No GitHub Actions workflow found | Manual/local only. |
| FE7 lint | Yes | PR-triggered in `local-safe-pr-gates.yml` | Branch protection can require it later after stability is proven. |
| FE7 build | Yes | PR-triggered in `local-safe-pr-gates.yml`; Vercel preview also builds FE7 | Keep package changes out of unrelated PRs. |
| Protected `supernovacore.py` zero diff | Yes | PR-triggered in `local-safe-pr-gates.yml` and local safe-check | Keep as a required manual line item until branch protection is finalized. |

Smallest safe future CI/branch-protection PR:

- Keep live `python scripts/check_safe.py` and social/backend smoke as manual or
  scheduled until the backend API origin is known and stable.
- After several clean PRs, make the existing local safe PR gates required in
  branch protection.
- Do not combine branch-protection enforcement with dependency updates or
  runtime refactors.

Rollback plan:

- Disable or revert the new workflow file if it is flaky.
- Keep existing manual workflows unchanged.

Do not combine with:

- branch protection enforcement;
- dependency updates;
- runtime fixes;
- Vercel/Railway setting changes.

## 4. Backup And Restore Runbook

Files/docs inspected:

- `RELEASE_CHECKLIST.md`
- `SAFE_CHECK_RESULTS_SNAPSHOT.md`
- `SECRET_KEY_AND_DB_ENGINE_HARDENING_ASSESSMENT.md`
- `super-nova-2177/REPO_STATUS.md`
- repository docs mentioning rollback/backup/restore

Current behavior observed:

- `BACKUP_RESTORE_RUNBOOK.md` exists and is linked from
  `RELEASE_CHECKLIST.md`.
- Existing docs mention rollback plans and note that `DATABASE_URL` should be
  provided by Railway.
- `super-nova-2177/REPO_STATUS.md` treats local DB files, logs, uploads, and
  fallback stores as local state.
- No repo doc currently gives a step-by-step production DB restore, uploads
  backup, or release rollback process.

Smallest safe future runbook PR:

- Run a no-secrets restore drill using the runbook and record the outcome.
- Keep actual DB exports, credentials, and upload archives out of the repo.
- Add or adjust CODEOWNERS coverage for the runbook only if ownership changes.

Rollback plan:

- Docs-only revert if the runbook wording is wrong.
- No production state should be touched by the runbook PR.

Do not combine with:

- DB migrations;
- actual backup export;
- upload deletion;
- Railway/Vercel setting edits.

## Recommended Next PR Sequence

1. `security/add-upload-size-limits`
   - Risk: medium.
   - Allowed files: `super-nova-2177/backend/app.py`, focused backend tests,
     optional changelog.
   - Required checks: upload-focused tests, backend safety tests,
     `check_safe.py --local-only`, full `check_safe.py`, social smoke, FE7
     lint/build, protected core zero diff.

2. `frontend/fail-fast-missing-api-origin`
   - Risk: medium.
   - Allowed files: `super-nova-2177/frontend-social-seven/utils/apiBase.js`,
     focused FE7 tests/docs if available, optional changelog.
   - Required checks: FE7 lint/build, safe checks, social smoke, protected core
     zero diff, Vercel preview.

3. `ci/require-local-safe-pr-gates`
   - Risk: low-medium.
   - Allowed files: branch-protection docs/status only unless workflow tuning is
     proven necessary.
   - Required checks: run the existing workflow or equivalent commands locally;
     enable required branch protection only after stability is proven.

4. `ops/run-backup-restore-drill`
   - Risk: low.
   - Allowed files: `BACKUP_RESTORE_RUNBOOK.md`, `RELEASE_CHECKLIST.md`,
     optional drill notes/changelog.
   - Required checks: safe checks and protected core zero diff.

5. `scalability/add-read-compatible-feed-pagination-params`
   - Risk: medium.
   - Allowed files: active backend route code and focused tests only.
   - Required checks: `test_read_pagination_baseline.py`, new pagination tests,
     full safe checks, FE7 lint/build, protected core zero diff.

## Explicit No-Touch List

Until a future PR explicitly scopes them, do not touch:

- `super-nova-2177/backend/supernova_2177_ui_weighted/supernovacore.py`;
- `super-nova-2177/backend/app.py` outside a focused upload or pagination PR;
- `db_models.py`;
- DB files or migrations;
- tracked uploads;
- auth behavior;
- federation writes;
- execution;
- domain verification runtime;
- AI runtime;
- package files or lockfiles;
- Vercel/Railway settings;
- environment files or secrets.

Protected core remains governed by `CORE_CHANGE_PROTOCOL.md`.
