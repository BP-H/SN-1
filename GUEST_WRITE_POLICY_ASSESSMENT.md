# Guest Write Policy Assessment

Assessment branch: `security/assess-guest-write-policy`

Baseline master commit: `ab85b5b`

This is a docs-only assessment. It does not change runtime behavior, backend routes, FE7 behavior, database schema, migrations, federation writes, execution, domain verification runtime, AI runtime, pagination, mentions, grants, or reply UI.

## Context

Recent backend hardening added strict bearer-token ownership checks for profile updates, direct messages, upload-image profile sync, follows, comment edit/delete, the active votes router, system-vote writes, and debug-supernova production gating. The remaining ambiguous write surfaces are:

- `POST /proposals`
- `POST /comments`

Both routes currently serve active product flows and may appear like public participation surfaces, but the backend should not implicitly trust arbitrary submitted usernames when those usernames match registered accounts.

## Files Inspected

- `super-nova-2177/backend/app.py`
- `super-nova-2177/frontend-social-seven/content/create post/InputFields.jsx`
- `super-nova-2177/frontend-social-seven/content/proposal/content/InsertComment.jsx`
- `super-nova-2177/frontend-social-seven/utils/authSession.js`
- `super-nova-2177/frontend-social-seven/content/profile/UserContext.jsx`

## POST /proposals Current Behavior

Route:

- `POST /proposals`
- Active backend wrapper route in `super-nova-2177/backend/app.py`
- Accepts multipart form data.

Identity fields trusted:

- `author`
- `author_type`
- `author_img`
- compatibility form fields such as `userName` and `userInitials` may be sent by FE7, but the backend route primarily uses `author`.

Current auth behavior:

- The route accepts an optional `Authorization` header.
- It calls `_enforce_token_identity_match(authorization, db, author)`.
- If a valid bearer token is present and belongs to a different user, the route returns `403`.
- If the bearer token is missing or invalid, `_enforce_token_identity_match` returns compatibility-first `None` and the write may continue.

FE7 behavior:

- `InputFields.jsx` currently requires `isAuthenticated` before publish.
- FE7 sends `authHeaders()` when posting to `/proposals`.
- Password-session users therefore send a bearer token.
- The API route still remains callable directly without a bearer token.

Unauthenticated posting intent:

- The active FE7 UI does not intentionally support anonymous proposal creation.
- Public protocol reads remain open, but active FE7 proposal creation is currently login-gated in the UI.
- If future public/guest proposal creation is desired, it should be explicit and labeled as guest participation rather than reusing registered usernames.

Spoofing risk:

- A direct API caller can submit `author=alice` without a bearer token.
- If `alice` is a registered username, the proposal may render as if Alice authored it.
- The route resolves a saved account species if the submitted author matches a `Harmonizer`, which can make spoofed writes look more account-like.
- This is a trust-boundary issue even though the FE7 UI already sends auth for normal signed-in posting.

Safest future policy:

- Prefer strict auth for registered-account identities.
- If the submitted `author` matches an existing `Harmonizer`, require a valid bearer token for that account.
- If no token is present and guest writes are kept, do not allow guest display names to collide with registered usernames.
- Guest proposals should be clearly marked with a guest/non-account identity and should not inherit registered account species, avatar, profile URL, or account metadata.

## POST /comments Current Behavior

Route:

- `POST /comments`
- Active backend wrapper route in `super-nova-2177/backend/app.py`
- Accepts JSON body through `CommentIn`.

Identity fields trusted:

- `user`
- `user_img`
- `species`
- `parent_comment_id`

Parent/reply behavior:

- `parent_comment_id` is accepted as an optional reply pointer.
- The route ensures the comment table has reply/thread columns.
- FE7 sends `parent_comment_id` when replying.
- This assessment does not change reply/thread behavior.

Current auth behavior:

- The route accepts an optional `Authorization` header.
- It calls `_enforce_token_identity_match(authorization, db, c.user)`.
- If a valid bearer token is present and belongs to a different user, the route returns `403`.
- Missing or invalid bearer tokens are compatibility-accepted.

Current auto-create/fallback behavior:

- In the CRUD/ORM path, if `Harmonizer` is available and no author exists for `c.user`, the route creates a `Harmonizer` with:
  - `username=c.user`
  - `email=f"{c.user}@example.com"`
  - `hashed_password="fallback"`
  - species/profile defaults
- This can convert a comment display name into an account-like row.
- In the raw SQL fallback path, the comment is inserted directly with the submitted `user`, `user_img`, `species`, and `parent_comment_id`.

FE7 behavior:

- `InsertComment.jsx` currently requires `isAuthenticated` before posting a comment.
- FE7 sends `authHeaders({ "Content-Type": "application/json" })`.
- Password-session users therefore send a bearer token.
- The API route still remains callable directly without a bearer token.

Guest comment intent:

- The active FE7 UI does not intentionally support anonymous commenting.
- If guest comments are a future product goal, they need a dedicated guest identity policy.
- Guest comments should not create account-like `Harmonizer` rows and should not impersonate registered usernames.

Spoofing risk:

- A direct API caller can submit `user=alice` without a bearer token.
- If `alice` exists, the comment may serialize as Alice.
- If `alice` does not exist, the ORM path may create a fallback account-like row with predictable email and fallback password marker.
- This is the highest remaining ambiguity in the write surface.

Safest future policy:

- Prefer strict auth for registered-account comment identities.
- If the submitted `user` matches an existing `Harmonizer`, require a valid bearer token for that account.
- If guest comments are kept, guest display names must be sanitized, clearly labeled, and prevented from colliding with registered usernames.
- Do not create `Harmonizer` rows from unauthenticated comment writes.

## Recommended Policy Options

| Option | Policy | Benefits | Risks |
| --- | --- | --- | --- |
| A | Require auth for all proposal/comment writes | Simplest security model; aligns with current FE7 login-gated UI | Removes any direct API guest-write compatibility |
| B | Allow guest writes only as clearly marked guest identities | Preserves public participation option | Requires careful anti-impersonation, spam posture, and UI labeling |
| C | Hybrid: authenticated usernames require token, guest display names cannot impersonate registered usernames | Best balance if open guest participation is desired | More implementation complexity and more tests |

Recommended direction:

Use Option C only if guest participation is a real product goal. Otherwise use Option A because FE7 already requires authentication for proposal and comment creation.

If Option C is chosen, guest writes must be visibly guest-labeled and must not create account-like `Harmonizer` rows.

## Required Future Tests

Before changing runtime behavior, add focused tests for:

- unauthenticated proposal as an existing registered username
- unauthenticated comment as an existing registered username
- authenticated matching user proposal creation still succeeds
- authenticated matching user comment creation still succeeds
- wrong-user token fails if a registered account identity is claimed
- guest display names do not create account-like users
- guest display names cannot impersonate registered usernames if guest policy is kept
- proposal/comment public reads remain unchanged
- reply `parent_comment_id` behavior remains unchanged
- FE7-authenticated write response shapes remain compatible

## Compatibility Requirements

Any future implementation must:

- Preserve public proposal/comment reads.
- Preserve open federation reads.
- Preserve manual-preview-only governance.
- Preserve FE7 login/session behavior.
- Preserve existing authenticated proposal/comment success response shapes.
- Preserve reply/thread behavior.
- Avoid mentions, grants, reply UI changes, pagination, DB schema changes, and migrations in the same PR.
- Avoid automatic execution, federation writes, domain verification runtime, AI runtime action, payments, custody, or legal/financial automation.

## Recommended Next PR

Next implementation should be one of:

1. `security/harden-proposal-comment-create-auth`
   - Require bearer auth for all `POST /proposals` and `POST /comments`.
   - Best if public guest writes are not currently intended.
   - Likely smallest and safest because FE7 already gates both flows.

2. `security/guest-safe-proposal-comment-policy`
   - Implement hybrid registered-account protection plus explicit guest identity handling.
   - Best only if guest posting/commenting is an explicit product requirement.
   - Must block registered username impersonation and stop unauthenticated comment-created `Harmonizer` rows.

Recommended first choice:

Start with strict auth tests for proposal/comment creation. If those tests confirm FE7-compatible authenticated writes and direct unauthenticated registered-name writes are the only compatibility gap, implement strict auth for both create routes in one small backend-only PR.

After the guest/write policy is settled, continue with comments pagination on a separate branch.

## Rollback Plan For Future Runtime PR

- Revert the single auth-policy PR if authenticated posting/commenting breaks.
- Keep public reads and protocol smoke checks as the immediate rollback validation.
- Do not pair the runtime change with frontend UI changes, pagination, schema changes, or mention notification work.

## What Not To Touch Yet

- `supernovacore.py`
- `votes_router.py`
- `db_models.py`
- `auth_utils.py`
- FE7 behavior
- package files or lockfiles
- DB files or migrations
- uploads
- federation writes
- execution
- domain verification runtime
- AI runtime
- mentions
- grants
- reply UI
- pagination
