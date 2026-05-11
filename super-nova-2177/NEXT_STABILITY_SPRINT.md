# Next Stability Sprint

This is a planning note after the AI delegate UX and commons-safe rate-limit merge. It does not implement the router split or new autonomy.

## 1. Split `backend/app.py` Into Routers
- Preserve current route behavior and tests while extracting small routers by surface: auth/profile, proposals/comments/votes, AI delegates/actions, uploads, messages/social, federation/public reads, and system/status.
- Move shared helpers only after route tests pin behavior.
- Keep SuperNova Core mounted read-only and protected from semantic changes.

## 2. Rate-Limit Observability And Redis Later
- Keep the current in-memory limiter as alpha single-instance protection for public write routes only.
- Add lightweight counters/structured logs for 429 events by bucket without exposing private counters to clients.
- Add Redis-backed buckets only when `REDIS_URL` is configured and tests prove local dev still works without Redis.
- Keep limits species-neutral and documented as commons protection, not scarcity or political control.

## 3. Branch Protection Rollout
- Require backend compile, focused backend tests, FE7 lint/build, `git diff --check`, and protected core zero-diff before merge.
- Add `check_safe.py` to the checkout or CI if the project wants it as a required gate.
- Start with warning-only checks for broad suites, then promote stable checks to required.

## 4. Staged Legacy Frontend Cleanup
- Identify active FE7 routes versus legacy frontends before deleting anything.
- Freeze or archive inactive frontends in stages with a rollback tag.
- Keep public docs pointing to the active FE7 app and backend wrapper paths.

## 5. UI Coherence Pass
- Continue small passes around shared modal shells, AI action buttons, comment actions, composer controls, and mobile overflow.
- Prefer icon-first controls with hover/focus highlights and existing `var(--pink)` token family.
- Keep AI-authored delegate actions approval-required and separate from human-assisted helpers.
