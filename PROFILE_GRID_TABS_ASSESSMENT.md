# Profile Grid Tabs Assessment

Branch: `product/assess-profile-grid-tabs`

Title: `[codex] Assess profile visual grid and content tabs`

Current master commit inspected: `46576f9`

Mode: docs-only product assessment. This PR does not change runtime behavior,
FE7 UI, backend routes, schemas, migrations, package metadata, uploads,
authentication/session logic, pagination behavior, DB indexes, proposal/comment
write behavior, mentions, grants, connectors, agent mandates, environment
files, secrets, or protected core files.

## Context

PR #71 fixed the first comment-reply UI issue by rendering the reply composer
inline under the target comment. Issue #70 captures the next product direction:
turn public profile pages into a richer social profile surface with a strong
identity header, content tabs, and a visual media grid while keeping the work
incremental and FE7-only at first.

This assessment records the intended direction before implementation so profile
polish does not get mixed with backend auth hardening, schema changes,
pagination/index work, mentions, grants, or protocol/core changes.

## Files Inspected

- `super-nova-2177/frontend-social-seven/app/profile/page.jsx`
- `super-nova-2177/frontend-social-seven/content/profile/Profile.jsx`
- `super-nova-2177/frontend-social-seven/content/profile/UserContext.jsx`
- `super-nova-2177/frontend-social-seven/app/users/[username]/page.jsx`
- `super-nova-2177/frontend-social-seven/content/proposal/content/ProposalCard.jsx`
- `super-nova-2177/frontend-social-seven/content/proposal/content/MediaGallery.jsx`
- `super-nova-2177/frontend-social-seven/content/home/HomeFeed.jsx`
- `super-nova-2177/backend/app.py`
- `PRODUCT_GRANTS_MENTIONS_REPLY_UI_ASSESSMENT.md`
- GitHub Issue #70, `Roadmap: profile visual grid and content tabs`

## Current Profile Page Structure

| Surface | Current File | Current Role |
| --- | --- | --- |
| Own profile settings page | `app/profile/page.jsx` | Small shell around `Profile` for editing the signed-in user's SuperNova identity. |
| Own profile/settings form | `content/profile/Profile.jsx` | Handles display name, species, avatar upload, domain/profile metadata, and sign-out/profile actions. |
| Auth/profile state | `content/profile/UserContext.jsx` | Merges Supabase/social session, backend bearer session, stored custom profile, password profile, and social sync profile data. |
| Public user profile page | `app/users/[username]/page.jsx` | Active public profile surface with identity header, edit/follow/message controls, stats, and the user's proposal/post feed. |
| Post/proposal cards | `content/proposal/content/ProposalCard.jsx` | Renders proposal/post cards, media, comments, votes, and author/profile links. |
| Image gallery | `content/proposal/content/MediaGallery.jsx` | Renders image carousel/grid display inside an existing proposal card. |

### Data Sources

| Data | Current Source | Current Use |
| --- | --- | --- |
| Public profile header | `GET /profile/{username}` | `app/users/[username]/page.jsx` loads username, avatar, bio, domain metadata, followers/following, status, harmony/karma, species. |
| User posts/proposals | `GET /proposals?filter=latest&author={username}&limit=30&offset={pageParam}` | Infinite query builds the public user's feed, then FE7 filters by `post.userName` defensively. |
| Social-user fallback | `GET /social-users?username={username}&limit=80` | Used as fallback for species/avatar/domain when direct profile data or posts are sparse. |
| Follow status | `GET /follows/status?follower={currentUsername}&target={username}` | Authenticated non-owner profile pages show follow/unfollow state. |
| Profile edits | `PATCH /profile/{currentUsername}` | Own profile details update bio/domain metadata through bearer-authenticated backend route. |
| Avatar/profile sync | `POST /upload-image`, then `saveUserProfile` | Uploads avatar with backend auth, then updates profile metadata and dispatches `supernova:profile-avatar-updated`. |

### Current Header And Counts

The active public profile page already has a compact identity header:

- Avatar, with optional domain-as-profile click behavior.
- Displayed username.
- Species label.
- Optional domain chip.
- Owner edit button, or message/follow buttons for other profiles.
- Bio/about block and editable owner details.
- Three stat tiles: `Posts`, `Species`, and `Harmony`.

Current count limitations:

- `Posts` is derived from `posts.length`, which reflects currently loaded FE7
  pages rather than a guaranteed total count.
- `GET /profile/{username}` can return `followers` and `following`, but the
  active FE7 header currently does not surface those values in the stat tiles.
- Proposal/decision counts are not separately derived yet.
- Visual/media counts are not derived yet.

### Current User Post Fetching

`app/users/[username]/page.jsx` uses `useInfiniteQuery` with:

```txt
/proposals?filter=latest&author={username}&limit=30&offset={pageParam}
```

The backend query filters `LOWER(userName) = LOWER(:author)` and returns proposal
payloads that `ProposalCard` can already render. The profile page then maps each
post into `ProposalCard`, preserving the existing feed-card behavior.

### Rename, Avatar Sync, And Old Posts

Current behavior is intentionally compatibility-oriented:

- Backend `PATCH /profile/{username}` can rename a `Harmonizer` and calls
  profile sync helpers for username, avatar, and species references.
- FE7 dispatches `supernova:profile-avatar-updated` and invalidates profile,
  proposal, home-feed, social-user, and graph queries after avatar/name/species
  changes.
- `ProposalCard` listens for profile-avatar update events and updates matching
  local author/comment display data.
- The public profile page still relies heavily on `username` in the route and
  `Proposal.userName` filtering. Renamed-user behavior should be manually
  verified before any visual-grid implementation.

Important limitation:

- Do not change old post identity propagation in the first profile-grid PR.
  Treat rename/backfill behavior as existing backend compatibility behavior,
  not as part of the profile visual redesign.

## Desired Profile Layout

The future public profile should feel more native to a social platform while
staying true to SuperNova's species/governance identity:

### Top Identity Header

Use the existing profile data first:

- Avatar/profile picture.
- Display name / username.
- Species.
- Bio/about and domain/profile link when present.
- Counts:
  - posts, using existing loaded posts first;
  - proposals/decisions, derived client-side from existing proposal payloads first;
  - visual/media count, derived client-side from existing media payloads first;
  - followers/following if already present in the public profile payload.
- Follow/message buttons if already present for non-owner profiles.
- Edit profile button for own profile.

Implementation note:

- First FE7-only pass should avoid new backend count endpoints. If a count is
  not reliable from current data, show conservative labels or omit until a later
  profile API optimization.

### Content Tabs

Recommended first tab set:

| Tab | Purpose | First Data Source |
| --- | --- | --- |
| Visuals | Square media thumbnails for image/video posts | Existing `posts` array and `post.media` fields |
| Proposals / Decisions | Governance/proposal-oriented cards or list | Existing proposal payload and `media.governance`/proposal text fields |
| Text / Posts | Text-first posts without media | Existing proposal cards filtered to posts with no display media |

Tabs should live near the top of the profile content, below the identity header
and above tab content. Preserve mobile-first ergonomics and avoid nesting heavy
cards inside decorative cards.

## Visuals Tab

Desired behavior:

- Render a grid of square media thumbnails.
- Use the first image as the cover when `post.media.images` exists.
- Use `post.media.image` when a single-image field exists.
- For YouTube/video posts, use an existing safe thumbnail if available:
  - YouTube posts can derive a thumbnail from the current `ProposalCard` logic.
  - Uploaded videos should use a safe fallback unless a poster/thumbnail already exists.
- Show subtle carousel indicators when a post has multiple images/media.
- Show subtle video indicators when the cover represents video.
- Clicking an item should navigate to the existing `/proposals/{id}` route or
  existing detail view.
- No new storage, media processing, thumbnail generation, upload mutation, or
  backend media endpoint should be introduced in the first implementation.

Current media fields to reuse:

| Field | Current Meaning |
| --- | --- |
| `post.media.images` | Array of image URLs used by `MediaGallery`. |
| `post.media.image` | Single image URL fallback. |
| `post.media.video` | Video URL used by `ProposalCard`. |
| `post.media.link` | Link that can become embedded video if it is a YouTube URL. |
| `post.media.file` | File/PDF URL, not a first-pass visual grid thumbnail unless safe fallback art is used. |
| `post.media.layout` | Current card media layout hint, not required for the profile grid. |

First implementation boundary:

- FE7-only.
- Use existing media URLs and existing proposal routes.
- Do not add image proxying, thumbnails, poster generation, or backend media processing.
- Provide clean empty state for users with no media posts.

## Proposals / Decisions Tab

Desired behavior:

- Show proposal/governance posts in a list or compact card layout.
- Preserve existing `/proposals/{id}` route/navigation.
- Preserve existing proposal card behavior where possible.
- Future labels may include:
  - grant;
  - nonprofit;
  - board decision;
  - manual ratification status;
  - why this decision matters.

First implementation boundary:

- Use existing proposal payloads only.
- If governance metadata is already present under `post.media.governance`, it may
  drive a decision/proposal label.
- Do not add grant execution, payments, custody, legal automation, automatic
  execution, or board ratification runtime.
- Do not add schema changes or backend labels in the first UI-only pass.

## Text / Posts Tab

Desired behavior:

- Show text-first posts without visual media.
- Preserve current feed-card behavior where possible.
- Keep existing proposal/comment/vote controls untouched.
- Use the same `ProposalCard` surface until a smaller text-card component is
  justified by real duplication or performance constraints.

Text-first classification can be conservative:

- No `media.images`.
- No `media.image`.
- No `media.video`.
- No YouTube-like `media.link` that the current card treats as video.
- Files/PDFs may be excluded from first-pass text-only classification unless
  product direction says document posts belong there.

## Safety And Compatibility

- No backend route changes in the assessment or first implementation pass.
- No schema or migration changes.
- No media processing changes.
- No upload behavior changes.
- No auth/session changes.
- No pagination/index behavior changes.
- No proposal/comment/vote write behavior changes.
- No mentions/grants implementation.
- No protected core changes.
- Preserve public profile reads.
- Preserve existing FE7 profile edit/follow/message behavior.
- Preserve mobile-first behavior.
- Do not change old post identity propagation in the first profile-grid PR.
- Keep the first implementation FE7-only and incremental.

## Recommended Implementation Split

| Step | Future PR | Scope | Risk | Notes |
| --- | --- | --- | --- | --- |
| A | FE7-only profile tabs shell with existing data | `app/users/[username]/page.jsx` only if possible | Low-medium | Add local tab state and tab chrome; default to existing all-post behavior or Visuals only if clearly safe. |
| B | Visual grid using existing media URLs | FE7 public profile page and optional tiny helper | Medium | Use first image/video fallback; no backend/media processing. |
| C | Proposal/decision tab using existing proposal data | FE7 only | Medium | Preserve existing proposal navigation and card behavior. |
| D | Text/posts tab | FE7 only | Low-medium | Filter no-media posts and preserve card behavior. |
| E | Polish counts and empty states | FE7 only first | Low | Use loaded data conservatively; avoid promising total counts until backend support exists. |
| F | Later profile API optimization | Backend assessment/tests first | Medium | Only if FE7-only approach becomes payload-heavy or count accuracy matters. |

Recommended first implementation PR:

```txt
ui/profile-tabs-shell-existing-data
```

Allowed first implementation files should be limited to:

- `super-nova-2177/frontend-social-seven/app/users/[username]/page.jsx`
- optional tiny helper in the same route file if possible
- optional FE7 style file only if the existing Tailwind classes cannot express the shell cleanly
- `CHANGELOG.md`

Do not include backend route changes, schema changes, uploads, auth/session,
pagination/index changes, or media processing in the first implementation.

## Manual Verification Checklist For Future Implementation

- Own profile loads.
- Another user profile loads.
- Renamed user profile still resolves correctly.
- Visual grid handles no-media users.
- Visual grid handles a carousel and uses the first image as cover.
- Visual grid handles video fallback without broken thumbnails.
- Visual grid items navigate to the existing post/proposal detail route.
- Proposal/decision tab preserves existing proposal route/navigation.
- Text/posts tab preserves existing feed-card behavior.
- Tabs work on mobile and desktop.
- Follow/message/edit profile controls still work.
- No backend/protected core changes.
- FE7 lint and build pass.
- Public profile reads remain unauthenticated.

## Rollback Plan

Revert the future FE7-only implementation PR. Because the first implementation
should not change backend routes, schemas, uploads, authentication, pagination,
indexes, protected core, or stored data, rollback should be a single frontend
revert that restores the current one-list profile feed.

## Open Questions For Implementation

- Should the first tab default be `Visuals`, or should the current all-post list
  remain the default until users have enough media?
- Should follower/following counts be shown immediately from `GET /profile`, or
  should they wait for a small copy/layout pass?
- Should proposal/decision classification use only `media.governance`, or should
  title/text/category heuristics be avoided until backend labels exist?
- Should PDF/document posts appear in `Visuals`, `Text / Posts`, or a later
  `Docs` surface?

