# Profile Collab Tags And Mentions Assessment

Branch: `product/assess-profile-collab-tags-mentions`

Title: `[codex] Assess profile collab tags and mentions`

Current master commit inspected: `75c05d4`

Mode: docs-only product and safety assessment. This PR does not change runtime
code, FE7 behavior, backend routes, database schemas, migrations, notification
runtime, profile-grid behavior, packages, lockfiles, upload/media handling,
auth/session logic, environment files, secrets, protected core files, grants,
connectors, or agent mandates.

## Context

PR #75 polished the public profile Visuals tab, icon tabs, uploaded-video
preview fallback, and read-only vote meter. The next profile idea is richer
social identity: plain mentions, profile tags, and approved collaboration tags
that can make a post visible on more than one user's profile.

This assessment keeps that product direction separate from runtime work. It
records definitions, safety boundaries, data model options, and a tests-first
rollout before any parser, notification, profile feed, or approval behavior is
implemented.

## Files Inspected

- `PROFILE_GRID_TABS_ASSESSMENT.md`
- `PRODUCT_GRANTS_MENTIONS_REPLY_UI_ASSESSMENT.md`
- `super-nova-2177/frontend-social-seven/app/users/[username]/page.jsx`
- `super-nova-2177/frontend-social-seven/content/header/content/NotificationsPanel.jsx`
- `super-nova-2177/backend/app.py`
- `super-nova-2177/backend/supernova_2177_ui_weighted/db_models.py`

## Definitions

| Term | Meaning | Ownership Effect | Notification Effect |
| --- | --- | --- | --- |
| Plain `@mention` | A text reference such as `@alice` inside a post, comment, or reply. | None. The source remains owned only by its author. | Mentioned user may receive a notification after server-side parsing and validation. |
| Profile tag | A user is tagged on a post as relevant or visible context. | None by default. A profile tag does not make the tagged user a co-author and should not put the post on the tagged user's profile grid. | Tagged user may receive a notification if product policy enables profile-tag notifications. |
| Collab tag | The author requests another user as a collaborator on a post. | Pending collab does not change ownership. Approved collab can show the post on both profiles. | Requested collaborator receives an approval/decline notification. |

Important product distinction:

- Mentions and profile tags are references.
- Collab tags are relationship requests.
- Only an approved collab should make the post appear as shared work on a
  second profile.

## Product Behavior

### Author Requests Collaborators

Future behavior:

- The author may request collaborators while creating or editing a post.
- The request must be tied to the authenticated author; clients must not be
  able to submit hidden collaborator IDs that the server blindly trusts.
- The server validates each requested username against existing active users.
- The requested collaborator receives a notification.
- The post remains authored only by the original author until approval.

First implementation should not include autocomplete. Autocomplete is a later
UX convenience after backend parsing, validation, notification, and spam posture
are pinned.

### Approval Required Before Second Profile Display

Pending collab requests must not pretend the requested user co-authored the
post. Until approval:

- The post appears on the author's profile normally.
- The requested collaborator may see a notification or pending request.
- The requested collaborator's public profile should not show the post as a
  collab item.
- The UI must avoid language like "with Alice" unless Alice has approved.

After approval:

- The post can appear in both users' profile surfaces.
- The post can show a subtle collab indicator.
- The canonical post route remains the existing proposal/detail route.
- The original author remains visible.
- The approved collaborator is visible as a collaborator, not as a rewritten
  author.

### Decline And Remove

Future behavior should support:

- Requested user can decline a pending collab request.
- Approved collaborator can remove their association from the post later.
- Original author can remove a pending request before approval.
- Original author can request a collaborator again only under a clear policy
  that prevents notification spam.

Declined or removed collabs should stop profile-grid inclusion for the
collaborator. Historical notifications may remain as activity records if the
notification system already keeps immutable activity.

## Profile Grid Behavior

The current profile grid/tabs use loaded post data only. Future collab display
should preserve that incremental approach until backend query support exists.

| Profile Surface | Current/Future Behavior |
| --- | --- |
| Own posts | Continue to appear normally in Visuals, Proposals, and Text tabs based on current media/text classification. |
| Pending collab posts | Do not appear on the requested collaborator profile. They may appear only in a private notification/request surface later. |
| Approved collab posts | May appear in Visuals, Proposals, and Text tabs on both the author profile and approved collaborator profile. |
| Declined/removed collab posts | Do not appear on the collaborator profile. |
| Visual indicators | Later FE7 can show a subtle collab marker on visual tiles and full cards. |

Future profile query implications:

- FE7 currently loads `/proposals?filter=latest&author={username}&limit=30&offset=...`.
- Approved collabs may require a backend-compatible query mode that returns
  authored posts plus approved collaborator posts.
- The first implementation should not overload plain `author` semantics unless
  tests prove compatibility.
- A safer future shape may be an explicit query parameter such as
  `include_collabs=true`, or a dedicated profile-feed endpoint after assessment.

No profile-grid behavior changes happen in this PR.

## Backend Safety

Future mention/collab runtime must follow the auth-bound write hardening already
completed for proposal/comment creation and account-bound mutations.

Safety requirements:

- Server parses and validates usernames for mentions and collab requests.
- Server normalizes usernames consistently, likely case-insensitive for lookup
  while preserving display casing from profile data.
- Do not trust client-submitted hidden mention/collab lists without validating
  against the source text, authenticated author, and active user records.
- Require bearer-token ownership for any write that creates or changes mention,
  profile-tag, or collab state.
- Prevent spoofing by never letting a caller claim another username as author or
  collaborator without the required token and approval state.
- Prevent clients from silently converting plain `@mentions` into approved
  collabs.
- Rate-limit or otherwise constrain mention/collab request bursts before broad
  rollout.
- Deduplicate repeated mentions of the same user in a single source item.
- Skip self-notification unless product policy explicitly allows it.
- Avoid notifying for private or inaccessible sources until privacy rules are
  explicit.
- Keep public reads public, but do not leak pending collab requests through a
  public profile response.

Current code facts to preserve:

- `backend/app.py` already exposes `GET /notifications` for recent activity and
  comment-reply notifications.
- `db_models.py` already includes a `comment_mentions` association table and a
  `Notification` model, but mention/collab runtime is not an active public
  contract yet.
- FE7 `NotificationsPanel.jsx` reads `/notifications?user=...&limit=3` for the
  header notification surface.

## Data Model Options

### Mention Records

Possible fields:

| Field | Purpose |
| --- | --- |
| `id` | Stable mention record id. |
| `source_type` | `proposal`, `comment`, or `reply`. |
| `source_id` | Source object id. |
| `mentioned_user_id` | Validated target user. |
| `mentioned_by_user_id` | Authenticated author who created the source text. |
| `created_at` | Server timestamp. |

Notes:

- Mention records should be created from server-side parsed source text.
- Repeated mentions in one source item should collapse to one record per target.
- Deleting or editing source text should have a documented policy:
  update mention records, tombstone them, or keep immutable historical activity.

### Profile Tag Records

Possible fields:

| Field | Purpose |
| --- | --- |
| `id` | Stable profile-tag record id. |
| `source_type` | `proposal`, `comment`, or future post type. |
| `source_id` | Source object id. |
| `tagged_user_id` | Validated target user. |
| `tagged_by_user_id` | Authenticated author. |
| `created_at` | Server timestamp. |

Notes:

- Profile tags are references, not collaboration ownership.
- First rollout can defer profile tags if mentions and collabs cover the
  immediate product need.

### Collab Request Records

Possible fields:

| Field | Purpose |
| --- | --- |
| `id` | Stable collab request id. |
| `proposal_id` | Existing post/proposal id. |
| `author_user_id` | Original authenticated author. |
| `collaborator_user_id` | Requested/approved collaborator. |
| `status` | `pending`, `approved`, `declined`, or `removed`. |
| `requested_at` | Initial request timestamp. |
| `responded_at` | Approval/decline/removal timestamp. |
| `requested_by_user_id` | Usually the author, explicit for auditability. |

Status policy:

- `pending`: request is visible only to involved users and notification surfaces.
- `approved`: post may appear on both profiles.
- `declined`: do not show on collaborator profile; prevent repeated spam.
- `removed`: previous approval no longer contributes to collaborator profile.

### Notification Records

Future notification payloads should support:

| Field | Purpose |
| --- | --- |
| `type` | `mention`, `profile_tag`, `collab_request`, `collab_approved`, `collab_declined`, or `collab_removed`. |
| `actor` | User who caused the notification. |
| `recipient` | User who should see it. |
| `source_type` | `proposal`, `comment`, `reply`, or `collab_request`. |
| `source_id` | Source record id. |
| `proposal_id` | Proposal id for navigation when relevant. |
| `created_at` | Server timestamp. |
| `is_read` | Existing read/unread concept if supported. |

Notification safety:

- Do not include private message content.
- Do not include secret tokens, provider data, cookies, or environment details.
- Do not send duplicate notifications for repeated mentions in the same text.
- Skip self-notification unless explicitly chosen.

### Profile Feed Query Implications

Approved collab posts introduce a second inclusion path for profile feeds:

- Authored posts by `Proposal.userName` or author id.
- Approved collab posts via a collab relationship table.

Future implementation should avoid ambiguous client-side merging until backend
tests define ordering and pagination. A profile-feed endpoint or explicit
`include_collabs` parameter would make ordering, dedupe, and pagination easier
to test.

## Recommended Rollout

| Step | Future PR | Scope | Risk | Notes |
| --- | --- | --- | --- | --- |
| A | Docs assessment only | This PR | Low | No runtime behavior changes. |
| B | Backend parser tests for `@mentions` | Tests only | Low | Pin syntax, normalization, dedupe, and self-mention policy before runtime. |
| C | Backend mention parser runtime plus notifications | Backend only, tests required | Medium | Parse server-side after authenticated writes; no autocomplete yet. |
| D | FE7 mention rendering | FE7 display only | Low-medium | Render known mention tokens/links after backend shape is stable. |
| E | Collab request model/tests | Backend tests and schema plan first | Medium | Requires explicit status model and migration planning. |
| F | Collab approval/decline notifications | Backend runtime plus FE7 surface | Medium | Pending requests and decisions must stay auth-bound. |
| G | Profile grid/feed includes approved collab posts | Backend query plus FE7 profile tabs | Medium-high | Requires pagination/order/dedupe tests. |
| H | Autocomplete last | FE7 UX plus rate-limited user search if needed | Medium | Only after server contract and spam posture are proven. |

Recommended next implementation after this assessment:

```txt
test/assert-mention-parser-contract
```

That PR should be tests-only and define mention syntax, username normalization,
deduplication, self-mention behavior, and invalid-token/no-auth boundaries
before notification writes exist.

## Manual-Preview-Only Safety

This assessment does not change SuperNova governance semantics.

Future mention/collab/profile work must not add:

- Automatic execution.
- Grants/payments/custody.
- UBI distribution or value distribution.
- Legal, financial, or board automation.
- Domain verification runtime fetching.
- Federation writes.
- Protocol/core guarantee changes.
- Any company, AI, or agent authority change.

If a future collab feature affects governance semantics, species rights,
AI/company authority, execution, value sharing, domain verification, public or
private export boundaries, important-decision behavior, or `/core` route
exposure, it must follow `CORE_CHANGE_PROTOCOL.md`.

## Required Checks For This Docs-Only PR

- `python scripts/check_safe.py --local-only`
- `python scripts/check_safe.py`
- `python scripts/smoke_social_backend.py https://2177.tech`
- FE7 `npm run lint`
- FE7 `npm run build`
- protected `supernovacore.py` diff zero

## Future Implementation Checks

Future parser/runtime/profile-feed PRs should add focused tests before behavior
changes. At minimum:

- Mention parser accepts intended username syntax.
- Mention parser rejects malformed or overly long usernames.
- Mention parser deduplicates repeated mentions in one source.
- Mention parser skips or handles self-mentions according to policy.
- Authenticated proposal/comment author can create mention records.
- Wrong-user token cannot create mention/collab records for another author.
- Pending collab does not appear on collaborator public profile.
- Approved collab appears on both profiles.
- Declined/removed collab does not appear on collaborator profile.
- Public profile reads remain available.
- Protected `supernovacore.py` diff remains zero unless a separately approved
  core PR follows `CORE_CHANGE_PROTOCOL.md`.

## Rollback Plan

Revert this docs-only PR. Because this PR changes only assessment/ownership
documentation and a changelog line, rollback does not affect runtime behavior,
FE7 UI, backend routes, database schema, migrations, notification runtime,
uploads, packages, auth/session state, environment configuration, secrets, or
protected core files.

