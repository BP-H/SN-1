# Release Checklist

Use this checklist before tagging a release or promoting a deployment. It is intentionally conservative and assumes v1 remains manual-preview-only.

## Required Checks

- [ ] PRs pass the local safe PR gates workflow for deterministic backend tests, `check_safe.py --local-only`, FE7 `npm ci`/lint/build, and protected core zero diff.
- [ ] Backup/restore readiness is confirmed using `BACKUP_RESTORE_RUNBOOK.md` (inventory, backup path, restore drill plan, and rollback path).
- [ ] `python scripts/check_safe.py --local-only`
- [ ] `python scripts/check_safe.py`
- [ ] Backend federation/safety tests pass.
- [ ] FE7 lint passes.
- [ ] FE7 production build passes.
- [ ] Protected core diff is zero unless the release explicitly includes reviewed core work.
- [ ] Public protocol smoke reports zero failures.
- [ ] Read-only social/backend smoke passes or records auth-gated social reads as skipped.
- [ ] Optional until the API origin is known and stable: direct backend API smoke passes with `python scripts/smoke_social_backend.py "$env:NEXT_PUBLIC_API_URL" --strict-backend` in PowerShell.
- [ ] Live smoke checks remain manual/scheduled and are not required PR gates yet.

## Governance And Protocol Review

- [ ] No automatic execution route was added.
- [ ] No company webhook route was added.
- [ ] No ActivityPub inbox write was added.
- [ ] No Webmention fetching or feed mutation was added.
- [ ] No real domain verification fetching was added without SSRF-safe design and review.
- [ ] Portable exports remain public-only and exclude private fields.
- [ ] Domain preview remains preview-only.
- [ ] v1 schemas remain manual-preview-only.

## Dependency Review

- [ ] No unreviewed major dependency updates are included.
- [ ] Dependabot PRs passed FE7 lint/build or were deferred when frontend dependencies changed.
- [ ] Dependabot PRs passed backend federation/safety tests or were deferred when backend dependencies changed.
- [ ] GitHub Actions updates passed the relevant workflow before release.
- [ ] Framework/runtime major updates have a rollback plan.

## Auth And Social Login Review

- [ ] Before Supabase client dependency updates, `AUTH_SOCIAL_SMOKE_CHECK.md` was run against the current baseline.
- [ ] After Supabase client dependency updates, `AUTH_SOCIAL_SMOKE_CHECK.md` was run again against the preview or staging surface.
- [ ] No usernames, emails, tokens, cookies, session values, callback codes, or environment values were logged or committed.
- [ ] Login, OAuth callback, session restore, profile/account state, logout, reload behavior, and redirect behavior were checked.

## Documentation Review

- [ ] `CHANGELOG.md` is updated.
- [ ] `PROTOCOL_GUARANTEE_MATRIX.md` is accurate.
- [ ] `README.md` still points to active surfaces and safety docs.
- [ ] Any new protocol surface has matching docs, tests, and smoke coverage.

## Release Boundary

Do not tag a release if it introduces silent autonomy, value custody/distribution, private-data export expansion, unreviewed auth enforcement changes, or unreviewed database migrations.
