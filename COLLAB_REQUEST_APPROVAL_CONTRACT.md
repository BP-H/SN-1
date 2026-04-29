# Collab Request Approval Contract

Branch: `product/plan-collab-request-approval-contract`

Title: `[codex] Plan collab request approval contract`

Current master commit inspected: `f2910ec`

Mode: docs-only contract and tests-first boundary. This PR does not change FE7
behavior, backend route behavior, database schemas, migrations, auth/session
logic, notification runtime, profile-grid behavior, packages, lockfiles,
uploads/media behavior, environment files, secrets, or protected core files.

## Purpose

SuperNova now has server-side mention parsing and notifications for comments
and proposals, plus FE7 rendering and autocomplete for plain `@mentions`.
The next social layer is approved collaboration tags: Instagram-style collab
posts where the original author can invite another user, and the post appears
on both profiles only after the invited user approves.

This contract defines the model and route behavior before runtime work starts.
It intentionally keeps plain mentions, profile tags, and collab requests
separate:

- A plain `@mention` is text reference plus optional notification.
- A profile tag is a non-owner reference and does not make the tagged user a
  collaborator.
- A collab request is an explicit approval workflow that can affect profile
  feed inclusion only after approval.

## Files Inspected

- `PROFILE_COLLAB_TAGS_MENTIONS_ASSESSMENT.md`
- `super-nova-2177/backend/mention_parser.py`
- `super-nova-2177/backend/tests/test_mention_parser_contract.py`
- `super-nova-2177/backend/tests/test_comment_mention_notifications.py`
- `super-nova-2177/backend/tests/test_proposal_mention_notifications.py`
- `super-nova-2177/backend/tests/test_auth_bound_write_routes.py`
- `super-nova-2177/backend/app.py`
- `super-nova-2177/backend/supernova_2177_ui_weighted/db_models.py`
- `super-nova-2177/frontend-social-seven/app/users/[username]/page.jsx`
- `.github/CODEOWNERS`

## Current Runtime Facts

- Proposal/comment creation is already auth-bound to the submitted user.
- `mention_parser.py` is pure and does not write notifications directly.
- Comment mention runtime creates `comment_mentions` links and persisted
  `Notification` rows.
- Proposal mention runtime creates persisted `Notification` rows.
- The `Notification` model currently stores `harmonizer_id`, `message`,
  `is_read`, and `created_at`; structured notification payloads are encoded in
  `message`.
- Public profile pages currently load authored posts with
  `/proposals?filter=latest&author={username}&limit=...&offset=...`.
- There is no active collab model, collab approval route, or profile-feed
  inclusion logic today.
- Backend tests do not currently use skipped or expected-failure contract
  tests, so this PR keeps the future contract in docs instead of adding inert
  tests.

## Status Contract

Future collab request records must use these statuses:

| Status | Meaning | Public Profile Effect |
| --- | --- | --- |
| `pending` | Original author requested a collaborator and awaits response. | Does not appear on requested user's public profile. |
| `approved` | Requested user accepted the collaboration. | May appear on both author and collaborator public profiles. |
| `declined` | Requested user rejected the collaboration. | Does not appear on requested user's public profile. |
| `removed` | Previously pending or approved association was canceled or removed. | Does not appear on collaborator public profile. |

Status invariants:

- Only `approved` collabs may affect public collaborator profile feeds.
- Pending, declined, and removed collabs must not be exposed as co-authored
  public posts.
- Original author remains the canonical author in proposal records and response
  shapes.
- Collaborator display is additive metadata, not an author rewrite.
- The same proposal/user pair should not accumulate unbounded active requests.

## Ownership And Identity Rules

Future runtime must enforce:

- Only the original authenticated proposal author can request a collab.
- A non-author cannot request a collab on someone else's proposal.
- The requested user must approve before profile inclusion changes.
- Only the requested collaborator can approve or decline their pending request.
- Removal should be allowed for the original author before approval, and for the
  approved collaborator after approval.
- If author-side removal of an approved collab is supported, it must be
  explicit, auth-bound, and tested as moderation behavior.
- Client-submitted usernames are hints only; the server resolves users
  case-insensitively and stores stable user ids.
- Clients must not be able to silently convert plain mentions or profile tags
  into approved collabs.

## Future Route Contract

Route names should stay close to active backend style. Proposed first contract:

### `POST /proposal-collabs/request`

Purpose: original author requests a collaborator for an existing proposal.

Auth:

- Requires bearer token for the canonical proposal author.
- Returns `401` for missing/invalid token.
- Returns `403` if the token belongs to a non-author.

Input:

```json
{
  "proposal_id": 123,
  "collaborator_username": "alice",
  "message": "optional short invite text"
}
```

Behavior:

- Resolve proposal.
- Resolve collaborator username to an existing active Harmonizer.
- Reject self-collab requests.
- Create or reuse one active `pending` request per proposal/collaborator pair.
- Do not show the proposal on the collaborator profile while pending.
- Create a `collab_request` notification if notification storage supports it.

Recommended responses:

- `200` or `201` with `{ id, proposal_id, status, collaborator_username }`.
- `400` for invalid or self-collab input.
- `404` for unknown proposal or unknown collaborator.
- `409` for an already pending or approved request unless idempotent reuse is
  chosen and documented.

### `POST /proposal-collabs/{id}/approve`

Purpose: requested collaborator approves a pending collab.

Auth:

- Requires bearer token for the requested collaborator.
- Returns `401` for missing/invalid token.
- Returns `403` for unrelated users or the original author acting as the
  collaborator.

Behavior:

- Transition `pending` to `approved`.
- Record response timestamp.
- Do not rewrite proposal author fields.
- Allow future profile-feed logic to include the proposal for the collaborator.
- Create `collab_approved` notification for the original author if supported.

### `POST /proposal-collabs/{id}/decline`

Purpose: requested collaborator declines a pending collab.

Auth:

- Requires bearer token for the requested collaborator.

Behavior:

- Transition `pending` to `declined`.
- Record response timestamp.
- Do not include the proposal on the collaborator profile.
- Create `collab_declined` notification only if product policy wants author
  feedback; otherwise keep it silent to reduce pressure.

### `DELETE /proposal-collabs/{id}` Or `POST /proposal-collabs/{id}/remove`

Purpose: cancel a pending request or remove an approved association.

Recommended route:

- Prefer `POST /proposal-collabs/{id}/remove` if the app's browser/client
  ergonomics make JSON body semantics easier.
- Prefer `DELETE /proposal-collabs/{id}` if the endpoint only needs the id and
  authenticated actor.

Auth:

- Original author may cancel their own pending request.
- Approved collaborator may remove their own approved association.
- Any broader author moderation over approved collabs must be separately
  assessed and tested.

Behavior:

- Transition active request to `removed`.
- Do not hard-delete rows in the first implementation.
- Do not include the proposal on the collaborator profile after removal.

## Future Model Contract

Recommended first model/table: `proposal_collabs`.

| Field | Purpose |
| --- | --- |
| `id` | Stable collab request id. |
| `proposal_id` | Existing proposal/post id. |
| `author_user_id` | Original canonical author at request time. |
| `collaborator_user_id` | Requested collaborator. |
| `requested_by_user_id` | Authenticated actor who created the request; normally same as author. |
| `status` | `pending`, `approved`, `declined`, or `removed`. |
| `requested_at` | Server timestamp when requested. |
| `responded_at` | Server timestamp for approval/decline. |
| `removed_at` | Server timestamp for removal, if applicable. |

Recommended constraints and indexes:

- Foreign key to proposals.
- Foreign keys to harmonizers for author, collaborator, and requester.
- Index `(proposal_id, collaborator_user_id, status)`.
- Index `(collaborator_user_id, status, requested_at)`.
- Enforce at most one active pending/approved row per proposal/collaborator
  pair if supported by the current database. If database support differs
  between SQLite and production, enforce duplicate prevention in route logic and
  document production validation.

No schema or migration changes are included in this PR.

## Notification Contract

Notification rows may continue to use JSON-encoded `message` until a broader
notification schema exists.

Recommended payloads:

```json
{
  "type": "collab_request",
  "source_type": "proposal_collab",
  "collab_id": 1,
  "proposal_id": 123,
  "actor": "author",
  "recipient": "collaborator",
  "title": "Collab request",
  "body": "author invited you to collaborate on a post"
}
```

Other future types:

- `collab_approved`
- `collab_declined`
- `collab_removed`

Notification safety:

- Do not include secrets, tokens, provider data, cookies, or environment
  values.
- Do not notify unrelated users.
- Do not send collab request notifications for self-collab attempts.
- Consider rate limits or cooldowns before broad rollout.

## Profile Feed Contract

Approved collabs should become a second inclusion path for public profiles:

- Authored posts where the canonical author is the profile user.
- Approved collab posts where the profile user is the approved collaborator.

Pending, declined, and removed collabs must not appear in the collaborator's
public profile Visuals, Proposals, or Text tabs.

Recommended future API direction:

- Avoid changing `author={username}` semantics silently.
- Prefer a dedicated profile feed query or explicit parameter, such as:
  - `GET /profile-feed?username={username}&include_collabs=true`
  - or `GET /proposals?profile={username}&include_collabs=true`
- Preserve existing `/proposals?author={username}` behavior until tests prove a
  compatible migration path.
- Define ordering and pagination before FE7 merges authored and collab posts.

## Future Tests

The next runtime-capable PR should start with focused backend tests. Minimum
test matrix:

### Request

- Author can request collab for an existing proposal.
- Non-author cannot request collab on someone else's proposal.
- Missing/invalid token returns `401`.
- Wrong-user token returns `403`.
- Unknown proposal returns `404`.
- Unknown collaborator returns `404`.
- Self-collab request returns `400`.
- Duplicate pending request is idempotent or returns `409`, according to the
  chosen implementation.

### Approve

- Requested user can approve.
- Unrelated user cannot approve.
- Original author cannot approve on behalf of the requested user.
- Approved status is persisted.
- Approved collab can be included in collaborator profile feed when the future
  profile query opts into collabs.

### Decline And Remove

- Requested user can decline.
- Declined collab does not show on collaborator public profile.
- Author can cancel pending request if that policy is chosen.
- Approved collaborator can remove their association.
- Removed collab does not show on collaborator public profile.

### Regression

- Pending collab does not show on collaborator public profile.
- Public proposal reads remain unchanged.
- Existing proposal/comment mention notifications remain unchanged.
- Existing FE7 profile grid behavior remains unchanged until the profile-feed
  PR explicitly opts in.
- Protected `supernovacore.py` diff remains zero.

## Recommended Future PR Sequence

1. `test/assert-collab-request-contract`
   - Backend tests only if the model/helper boundary can be expressed without
     skipped tests.
   - If a model is required first, this should become a schema-plan PR instead.

2. `backend/add-proposal-collab-model`
   - Add the smallest model/table support and idempotent local SQLite tests.
   - No FE7 behavior.
   - No profile-feed inclusion yet.

3. `backend/add-proposal-collab-request-routes`
   - Add request/approve/decline/remove routes with strict bearer ownership.
   - Add notification creation only if it fits the existing `Notification`
     pattern without broad refactors.

4. `backend/add-approved-collabs-profile-feed`
   - Add explicit profile feed inclusion for approved collabs.
   - Preserve existing authored-post reads.
   - Test pending/declined/removed exclusions.

5. `ui/show-approved-collabs-on-profiles`
   - FE7-only profile grid/card indicators using the explicit backend shape.
   - No backend route changes in the UI PR.

6. `ui/collab-request-composer-flow`
   - Add author-side request UI after backend approval and profile-feed
     contracts are stable.

## Tests In This PR

No skipped or expected-failure tests are added in this PR. The active backend
test suite does not currently use skipped contract tests for future runtime
behavior, so this PR records the contract in documentation and keeps executable
tests for the future implementation PR where the model/route boundary exists.

## Required Checks For This PR

- `python scripts/check_safe.py --local-only`
- `python scripts/check_safe.py`
- `python scripts/smoke_social_backend.py https://2177.tech`
- FE7 `npm run lint`
- FE7 `npm run build`
- `python -m unittest super-nova-2177/backend/tests/test_mention_parser_contract.py`
- `python -m unittest super-nova-2177/backend/tests/test_comment_mention_notifications.py`
- `python -m unittest super-nova-2177/backend/tests/test_proposal_mention_notifications.py`
- protected `supernovacore.py` diff zero

## What Not To Touch

Future implementation must keep these boundaries unless a separate PR explicitly
changes scope:

- `supernovacore.py`
- FE7 profile-grid behavior
- FE7 auth/session logic
- proposal/comment mention parser behavior
- notification runtime outside collab-specific additions
- DB migrations outside a dedicated schema PR
- uploads/media behavior
- package or lock files
- environment files or secrets
- grants, payments, custody, legal automation, execution, or domain
  verification runtime

## Rollback Plan

Revert this docs-only PR. Because this PR changes only contract documentation,
CODEOWNERS, and the changelog, rollback does not affect runtime routes, FE7 UI,
database state, notification delivery, auth/session behavior, migrations,
uploads, packages, environment configuration, secrets, or protected core files.
