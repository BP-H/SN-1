# Auth-Bound Write Routes Assessment

Assessment date: 2026-04-28

Current master commit assessed: `e8736ca`

Status: assessment-only. No runtime behavior, route behavior, auth behavior, database files, migrations, frontend behavior, package files, secrets, or environment files were changed.

## Scope

This assessment reviews active backend identity-bound write routes before any behavior change. It separates active `super-nova-2177/backend/app.py` routes from mounted routers and legacy or off-path surfaces.

The current public protocol posture remains:

- Public federation and protocol reads stay open.
- Guest/public reads stay intentional where already documented.
- v1 governance remains manual-preview-only.
- No automatic execution, federation writes, domain verification fetching, or AI runtime behavior is introduced by this assessment.

## Files Inspected

- `super-nova-2177/backend/app.py`
- `super-nova-2177/backend/votes_router.py`
- `super-nova-2177/backend/supernova_2177_ui_weighted/auth_utils.py`
- `super-nova-2177/backend/supernova_2177_ui_weighted/db_models.py`
- `super-nova-2177/frontend-social-seven/utils/authSession.js`
- Active FE7 write callers under `super-nova-2177/frontend-social-seven/app/` and `super-nova-2177/frontend-social-seven/content/`
- Legacy/off-path references in `frontend-vite-3d`, `frontend-social-six`, nested backend, `nova-web`, and `transcendental_resonance_frontend`

## Key Finding

`backend/app.py` has a strict `get_current_harmonizer()` helper that rejects missing or invalid bearer tokens. However, most active write routes call `_enforce_token_identity_match()`, which uses `_optional_current_harmonizer()`.

Current helper behavior:

- Missing bearer token returns `None`.
- Invalid bearer token is caught and returns `None`.
- Only a valid bearer token for a different username triggers `403`.

That means many current routes are protected against authenticated cross-account mismatch, but they are not protected against unauthenticated username-claim writes. This is compatibility-first behavior and may preserve old guest flows, but it should not remain implicit for account-bound writes.

## Active Route Inventory

| Route | Method | Identity field trusted | Current auth behavior | Desired auth behavior | Guest/open intentional? | Risk | Smallest future fix |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/proposals` | `POST` | Form `author` | Calls `_enforce_token_identity_match`; missing/invalid bearer does not block. | Require bearer token matching `author`, or define explicit guest-post identity policy. | Unclear; FE7 sends auth headers when password session exists. | High | Tests for unauthenticated post creation, then require a resolved current harmonizer unless guest policy is explicitly added. |
| `/profile/{username}` | `PATCH` | Path `username`; optional payload rename | Calls `_enforce_token_identity_match`; missing/invalid bearer does not block profile edits. | Require bearer token matching current path owner before any update or rename. | No. Profile mutation is account-bound. | Critical | Tests for unauthenticated profile patch and cross-user token mismatch; then use strict helper. |
| `/upload-image` | `POST` | Form `username` and/or `user_id` | If `username` is present, optional identity match runs. If only `user_id` is present, no ownership check was found before profile image sync. | Require bearer auth for any profile sync; token identity must match `username` or resolved `user_id`. Open raw image upload, if kept, must not mutate profiles. | Raw upload may be public, but profile sync should not be. | Critical | Tests for `user_id` profile image IDOR and unauthenticated username image sync; then split raw upload from authenticated profile sync. |
| `/follows` | `POST` | Body `follower` | Calls optional identity match; missing/invalid bearer does not block. | Require bearer token matching `follower`. | No for account graph mutation. | High | Tests for unauthenticated follow spoofing, then strict identity helper. |
| `/follows` | `DELETE` | Query `follower` | Calls optional identity match; missing/invalid bearer does not block. | Require bearer token matching `follower`. | No for account graph mutation. | High | Tests for unauthenticated unfollow spoofing, then strict identity helper. |
| `/messages` | `POST` | Body `sender` | Calls optional identity match; missing/invalid bearer does not block. | Require bearer token matching `sender`. | No. Direct messages are account-bound writes. | Critical | Tests for unauthenticated sender spoofing, then strict identity helper. |
| `/messages` | `GET` | Query `user` | Identity-bound read also calls optional identity match; missing/invalid bearer does not block. | Require bearer token matching `user` for message reads. | No. Direct messages are private-ish account-bound reads. | Critical | Include read test with write hardening because it protects the same direct-message trust boundary. |
| `/comments` | `POST` | Body `user` | Calls optional identity match; missing/invalid bearer does not block; may auto-create a Harmonizer with `hashed_password="fallback"`. | Either require bearer token matching `user`, or define explicit guest comment policy that does not create account-like users. | Possibly intended for guest discussion, but not safely defined. | High | Tests for unauthenticated comment as existing user; then decide strict auth versus safe guest identity. |
| `/comments/{comment_id}` | `PATCH` | Body `user` | Optional identity match; route checks payload user against stored author, but missing bearer can spoof the stored author name. | Require bearer token matching `user`; preserve stored-author check. | No for editing account-authored comments. | High | Tests for unauthenticated edit by author-name spoof. |
| `/comments/{comment_id}` | `DELETE` | Query `user` | Optional identity match; route checks requested user against comment author or proposal owner, but missing bearer can spoof either name. | Require bearer token matching `user`; preserve author/post-owner authorization. | No for deleting account-authored comments. | High | Tests for unauthenticated delete by author-name spoof. |
| `/system-vote` | `POST` | Body `username`, `voter_type` fallback | No bearer auth found; trusts username. Deadline is returned in config but not enforced in cast path. | Require bearer token matching username, or explicitly document anonymous system vote semantics; enforce or refresh deadline. | Unclear. UI asks the user to sign in before voting. | High | Tests for unauthenticated system vote and stale deadline, then strict auth or explicit guest policy. |
| `/system-vote` | `DELETE` | Query `username` | No bearer auth found; trusts username. | Require bearer token matching username. | No for removing another account's vote. | High | Tests for unauthenticated system vote removal. |
| `/votes` in `votes_router.py` | `POST` | Body `username`, `voter_type` | Mounted in active app; no bearer auth; auto-creates Harmonizer with `hashed_password="dummy"`. FE7 sends auth headers when available, but backend does not require them. | Require bearer token matching username, or move to a safe guest vote policy that does not create account-like users. | Unclear for public voting; current account auto-create is not safe. | Critical | Tests for unauthenticated vote as existing user and auto-create behavior; then strict auth or guest vote redesign. |
| `/votes` in `votes_router.py` | `DELETE` | Query `username` | Mounted in active app; no bearer auth. | Require bearer token matching username. | No for removing account votes. | High | Tests for unauthenticated vote removal. |
| `/debug-supernova` | `GET` | Environment marker only | Blocks only when `SUPERNOVA_ENV == "production"`; exposes `sys.path`, current directory, directory listing, and runtime paths otherwise. | Disable by default, or block for all explicit production markers already used by secret-key hardening. | No for public production. | High | Tests for `SUPERNOVA_ENV`, `APP_ENV`, `ENV`, and `RAILWAY_ENVIRONMENT` production markers. |

## Additional Active Mutating Routes To Review

These were outside the explicit QA list but are active write routes in `backend/app.py`:

| Route | Method | Current concern | Recommendation |
| --- | --- | --- | --- |
| `/proposals/{pid}` | `PATCH` | Uses optional identity match plus author ownership check; missing bearer may spoof the author query/body value. | Include with account-bound write tests after the first proposal create tests. |
| `/proposals/{pid}` | `DELETE` | Uses optional identity match plus author ownership check; missing bearer may spoof the author query value. | Include with account-bound write tests after the first proposal create tests. |
| `/proposals` | `DELETE` | Bulk delete is gated by `ENABLE_BULK_PROPOSAL_DELETE=true` and `x-confirm-delete: yes`, but has no bearer/admin auth if enabled. | Keep disabled; any future enablement must require admin auth and tests. |
| `/upload-file` | `POST` | Size/type bounded after upload-hardening work, but still public. | Decide whether public document upload is intentional; avoid profile/account mutation without auth. |
| `/decide/{pid}` | `POST` | Mutates decision state and has no auth. | Keep manual-preview-only; require admin/operator auth or disable in production before treating as production governance. |
| `/runs` | `POST` | Creates run records and has no auth. | Review before any execution-intent work; do not connect to real execution. |

## Specific QA Findings

| Finding | Status | Evidence / note | Future action |
| --- | --- | --- | --- |
| Missing bearer token may allow username-spoofing writes. | Confirmed for multiple routes. | `_optional_current_harmonizer()` returns `None` for missing or invalid bearer tokens, and `_enforce_token_identity_match()` returns without rejecting when current user is `None`. | Add tests first, then introduce strict auth for account-bound writes. |
| `upload-image` may allow `user_id`-based profile image changes without verified ownership. | Confirmed by code inspection. | The route resolves `user_id` directly if provided; identity enforcement only runs for non-empty `username`. | Add IDOR regression tests before behavior change. |
| `votes_router.py` may accept raw username and auto-create Harmonizer with dummy password. | Confirmed and active. | `backend/app.py` includes `votes_router`; `votes_router.py` creates a `Harmonizer` with `hashed_password="dummy"` when username is unknown. | Add tests, then either require auth or remove auto-create behavior behind a compatibility plan. |
| `debug-supernova` may expose sys.path/current directory/listings unless all production env markers block it. | Confirmed. | It blocks only `SUPERNOVA_ENV=production`. Secret-key hardening already recognizes `SUPERNOVA_ENV`, `APP_ENV`, `ENV`, and `RAILWAY_ENVIRONMENT`. | Add production-marker tests and then harden/disable debug routes. |
| System vote deadline may be stale or not enforced. | Confirmed for default date and cast path. | Default `SYSTEM_VOTE_DEADLINE` is `2026-04-27T18:00:00-07:00`; assessment date is 2026-04-28. `cast_system_vote()` does not check deadline before writing. | Decide whether system vote is ongoing, update deadline policy, and add enforcement tests. |
| Legacy/core SHA password paths exist in `auth_utils.py` and `db_models.py`. | Confirmed. | Active wrapper login upgrades legacy SHA-256 hashes, while `auth_utils.verify_password()` and `db_models.Harmonizer` still contain SHA-256 fallback/helpers for compatibility. | Do not remove in this pass; later inventory which paths are active versus legacy tests. |

## Active vs Legacy / Off-Path Surfaces

| Surface | Status | Notes |
| --- | --- | --- |
| `super-nova-2177/backend/app.py` | Active backend wrapper. | Primary production-relevant route surface for this assessment. |
| `super-nova-2177/backend/votes_router.py` | Mounted/active. | Included by `backend/app.py`, so `/votes` is active and should not be treated as legacy. |
| `super-nova-2177/backend/supernova_2177_ui_weighted/auth_utils.py` | Active helper path through wrapper import. | Used for password/JWT fallback settings and password verification compatibility. |
| `super-nova-2177/backend/supernova_2177_ui_weighted/db_models.py` | Active model source through runtime loading. | Contains legacy SHA password helpers; do not edit without separate model/auth review. |
| `frontend-social-seven` | Active frontend. | Sends `authHeaders()` on many write paths when password session token exists, but social/guest sessions may not always provide a bearer token. Backend must enforce ownership server-side. |
| `frontend-vite-3d` | Legacy/off-path frontend. | Contains API service and AI route code; not part of this backend hardening implementation pass. |
| `frontend-social-six` | Legacy/off-path frontend. | Contains older proposal/comment/vote/upload callers; do not change until separate legacy surface assessment. |
| Nested backend under `supernova_2177_ui_weighted/backend/` | Legacy/nested backend experiment. | Has similar write routes; keep under nested backend cleanup/security assessment. |
| `transcendental_resonance_frontend` / NiceGUI paths | Legacy Python UI package. | Contains many API callers; do not mix with active FE7/backend auth hardening. |

## Compatibility Plan

Future implementation should preserve:

- Intentional public reads, including protocol/federation discovery, proposal feeds, public profiles, actors, outbox, and portable public exports.
- Manual-preview-only governance and no automatic real-world execution.
- FE7 login/session behavior and existing successful authenticated writes.
- Existing local/dev workflows where safe.

Future implementation should avoid:

- Trusting arbitrary submitted usernames for account-bound mutations.
- Creating account-like users from unauthenticated vote/comment writes.
- Breaking intentional guest discussion if guest posting is product policy.

If unauthenticated proposal or comment posting is intentionally allowed, define a safe guest identity policy first:

- Guest identities must be clearly marked as guest/non-account.
- Guest writes must not mutate existing account profiles, follows, direct messages, votes, or ownership state.
- Guest display names must not impersonate registered usernames.
- Guest comments/posts should not create `Harmonizer` rows with fallback or dummy passwords.

## Recommended Future PR Order

### A. Tests first for unauthenticated account-bound writes

Risk: low.

Allowed files:

- New backend tests only, for example `super-nova-2177/backend/tests/test_auth_bound_write_routes.py`.

Coverage:

- Missing bearer cannot edit profile.
- Missing bearer cannot send message as another user.
- Missing bearer cannot follow/unfollow as another user.
- Missing bearer cannot edit/delete a comment by spoofing author name.
- Missing bearer cannot create/delete votes as an existing user.
- Current behavior may be pinned as failing/expected-risk if implementation is not changed in the same PR.

Rollback:

- Revert tests if they are incorrectly coupled; no runtime behavior changes.

### B. Harden identity enforcement helper

Risk: medium.

Allowed files:

- `super-nova-2177/backend/app.py`
- Focused backend tests.

Plan:

- Add a strict helper such as `require_current_harmonizer()` or `require_token_identity_match()`.
- Do not replace every optional helper at once.
- Start with one or two highest-risk routes after tests exist.

Rollback:

- Revert helper use on affected routes; keep tests adjusted to the agreed policy.

### C. Fix `upload-image` `user_id` IDOR if confirmed

Risk: medium.

Allowed files:

- `super-nova-2177/backend/app.py`
- Focused upload/auth tests.

Plan:

- Require bearer auth before profile sync.
- If only `user_id` is provided, resolve the user and require token subject to match that user's username.
- Keep raw image upload response shape if product still needs unauthenticated temporary uploads.

Rollback:

- Revert route-level guard while keeping size-limit protections from PR #48.

### D. Fix or retire `votes_router.py` auto-create/dummy-password behavior

Risk: medium-high.

Allowed files:

- `super-nova-2177/backend/votes_router.py`
- Focused vote tests.
- Possibly `backend/app.py` only if mount behavior changes are explicitly approved.

Plan:

- First test current mounted behavior.
- Require bearer identity for registered-account votes, or redesign unauthenticated votes as guest votes that do not create `Harmonizer` rows.

Rollback:

- Revert router behavior; keep old vote path available while product policy is decided.

### E. Harden `debug-supernova` gating

Risk: low-medium.

Allowed files:

- `super-nova-2177/backend/app.py`
- Focused debug endpoint tests.

Plan:

- Reuse the explicit production markers from secret-key hardening: `SUPERNOVA_ENV`, `APP_ENV`, `ENV`, `RAILWAY_ENVIRONMENT`.
- Prefer disabled-by-default debug behavior for public deployments.

Rollback:

- Revert debug route guard; no data migrations involved.

### F. Add system vote deadline enforcement or document ongoing vote policy

Risk: medium.

Allowed files:

- `super-nova-2177/backend/app.py`
- Focused system vote tests.
- Possibly docs if policy-only.

Plan:

- Decide whether the current system vote is still open.
- If deadline remains meaningful, block writes after deadline.
- If system vote is intentionally ongoing, update config policy and docs so the date does not silently go stale.
- Add auth or guest policy before treating votes as account-owned.

Rollback:

- Revert deadline enforcement or policy doc; no schema change expected.

### G. Homepage clarity/onboarding assessment

Risk: low.

Allowed files:

- Docs/assessment first; frontend only later.

Plan:

- Use the deep research feedback after active backend identity/security issues are assessed.
- Focus on replacing raw/internal homepage status language with public-facing product clarity.
- Do not mix homepage polish with auth route hardening.

Rollback:

- Revert docs or frontend copy-only changes.

## Do Not Touch Yet

- `supernovacore.py`
- `backend/app.py` runtime behavior in this assessment PR
- `votes_router.py` runtime behavior in this assessment PR
- `db_models.py`
- `auth_utils.py`
- FE7 behavior
- Package files or lockfiles
- DB files or migrations
- Upload directory contents
- Federation writes
- Execution endpoints
- Domain verification runtime fetching
- AI runtime
- Environment files or secrets
- Legacy frontends and nested backend experiments

## Required Checks Before Any Future Runtime Change

- Focused unauthenticated/cross-user regression tests for the target route.
- Existing backend federation safety tests.
- Existing secret-key hardening tests.
- Existing DB engine consistency and fallback tests.
- Existing read pagination baseline tests.
- Existing upload size limit tests.
- `python scripts/check_safe.py --local-only`
- Full safe check and live smoke for release confidence.
- FE7 lint/build for any frontend-touching compatibility work.
- Protected `supernovacore.py` diff zero unless `CORE_CHANGE_PROTOCOL.md` is followed.

## Bottom Line

The active backend has made progress toward token-aware writes, but the current helper is optional by design. The next safest move is tests first for unauthenticated account-bound writes. After that, harden the narrowest route set with a strict identity helper while preserving public reads, open federation, and any explicitly designed guest policy.
