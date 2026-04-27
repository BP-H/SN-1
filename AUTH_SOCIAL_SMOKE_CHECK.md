# Auth And Social Login Smoke Check

This checklist records the safe manual baseline for Supabase/social login before any Supabase client dependency update.

## Current Baseline

- Production `https://2177.tech` Supabase login was manually confirmed working after PR #21.
- Do not record usernames, emails, passwords, tokens, cookies, session IDs, callback URLs with codes, or environment variable values in this repository.
- This is a manual smoke baseline only. It does not add automated auth writes or account creation.

## Manual Smoke Checklist

Run this checklist before and after any Supabase dependency update, especially before merging PR #4 or a recreated Supabase update branch.

- [ ] Login page opens.
- [ ] Supabase/social login starts correctly.
- [ ] OAuth callback returns to the app.
- [ ] Session is visible or restored in the UI.
- [ ] Profile/account state loads.
- [ ] Logout works.
- [ ] Reload preserves or clears the session as expected.
- [ ] Browser console shows no auth errors.
- [ ] No infinite redirect loop occurs.

## Safety Rules

- Do not run production account creation in automated smoke checks.
- Do not log passwords, tokens, cookies, callback codes, session values, or environment values.
- Do not commit `.env` values or screenshots that expose account/session details.
- Do not mutate the database except for normal login/logout session behavior.
- Use a dedicated test account only if future automation is explicitly designed, reviewed, and documented.
- Keep Supabase dependency PRs separate from unrelated dependency, cleanup, auth, database, or frontend behavior changes.

## Supabase Update Gate

Before merging PR #4 or any recreated Supabase update branch:

- [ ] Run this checklist before the update and confirm the current baseline still works.
- [ ] Recreate or rebase the Supabase update from current `master`.
- [ ] Run FE7 lint/build, safe-check, public protocol smoke, social backend smoke, backend federation safety tests, and protected core diff.
- [ ] Verify Vercel preview reaches Ready.
- [ ] Run this checklist again on the preview or staging surface.
- [ ] Merge only if both before/after auth smoke checks are boring.
- [ ] Keep a rollback plan to revert the single Supabase dependency merge if login/session behavior regresses.
