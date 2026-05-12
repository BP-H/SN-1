# ProposalCard Decomposition Status

Last updated: 2026-05-12

This checkpoint records the safe FE7 `ProposalCard.jsx` decomposition work completed so far and the recommended order for future seams. Keep this work incremental: one seam per PR, visual/display shell first, state and mutations later only with focused tests.

## Extracted Components

The following display-oriented components have already been extracted from `super-nova-2177/frontend-social-seven/content/proposal/content/ProposalCard.jsx`:

- `ProposalAuthorHeader.jsx`
  - author name and username display
  - avatar and approved collaborator header display
  - profile link behavior
  - adjacent timestamp/meta text
- `ProposalVoteSummary.jsx`
  - support summary pill display
  - existing support percentage text passed from `ProposalCard`
- `ProposalTextContent.jsx`
  - non-editing proposal text/body display
  - existing `LinkifiedText` mention rendering
  - existing `Read More` / `Show Less` display behavior
- `ProposalMediaBlock.jsx`
  - image gallery display orchestration
  - video, link, PDF, and document display
  - existing media child components and layout
- `ProposalActionBar.jsx`
  - action bar container layout
  - existing `LikesDeslikes` child placement
  - comment toggle display
  - share button/menu display
- `ProposalOptionsMenu.jsx`
  - options button and dropdown layout
  - existing profile, save, edit, invite collab, delete, message, follow/unfollow item rendering
  - handlers and menu state still owned by `ProposalCard`
- `ProposalCollabPanel.jsx`
  - collaborator invite panel layout
  - existing search suggestions, status, and error display
  - collab state and request handler still owned by `ProposalCard`
- `ProposalCommentsSection.jsx`
  - comments section wrapper and header
  - existing `InsertComment` and `DisplayComments` rendering
  - empty comments state, reply composer placement, and AI comment trigger display
  - comment state, threading data, and mutation handlers still owned by `ProposalCard`

## Current Measurement

- Current approximate `ProposalCard.jsx` line count: 978 lines, measured after PR #151 using the current workspace file.
- Extracted display component files:
  - `super-nova-2177/frontend-social-seven/content/proposal/content/ProposalAuthorHeader.jsx`
  - `super-nova-2177/frontend-social-seven/content/proposal/content/ProposalVoteSummary.jsx`
  - `super-nova-2177/frontend-social-seven/content/proposal/content/ProposalTextContent.jsx`
  - `super-nova-2177/frontend-social-seven/content/proposal/content/ProposalMediaBlock.jsx`
  - `super-nova-2177/frontend-social-seven/content/proposal/content/ProposalActionBar.jsx`
  - `super-nova-2177/frontend-social-seven/content/proposal/content/ProposalOptionsMenu.jsx`
  - `super-nova-2177/frontend-social-seven/content/proposal/content/ProposalCollabPanel.jsx`
  - `super-nova-2177/frontend-social-seven/content/proposal/content/ProposalCommentsSection.jsx`

## Still Inside ProposalCard

`ProposalCard.jsx` intentionally remains the owner for:

- edit/save/cancel state
- vote state and mutation ownership
- AI action modal triggers/state and approval/cancel integration
- comments state, reply state, threading computation, and comment mutation handlers
- collaborator invite/review state, search state, and API handler
- bookmarks
- option menu open/close state
- follow/message/share handlers
- mutation/API handlers

## Remaining Highest-Risk Responsibilities

The highest-risk responsibilities still inside `ProposalCard.jsx` are stateful or mutation-heavy. They are intentionally retained for now:

- proposal edit/save/cancel mutation flow
- vote mutation ownership and local vote synchronization
- comment add/edit/delete/reply mutation flow
- AI action modal custody, approve/cancel semantics, and post-approval local updates
- collaborator invite/review API behavior
- bookmark, follow, message, and share side effects

`ProposalCard.jsx` is smaller, but it is still the state and mutation coordinator. Future state extraction should happen only with focused regression tests for the exact flow being moved.

## Recommended Next Step

Pause `ProposalCard` extraction and start an `AssistantOrb` decomposition checkpoint before moving more behavior. The safest possible additional `ProposalCard` seam would be an AI action trigger shell only, but that should wait until there is focused coverage proving AI custody, approve/cancel, and publication semantics remain unchanged.

## Do Not Move Yet

The following areas should stay in `ProposalCard` until there are focused tests and a dedicated plan:

- vote mutation logic
- comment mutation logic
- AI custody/approve/cancel semantics
- proposal edit/save/cancel mutation logic
- backend/API behavior

## Safety Rule

Continue with one seam per PR. Prefer visual/display shells first. State ownership, mutation handlers, API behavior, and custody semantics should move only later, only with focused regression coverage, and only when the boundary is clear.
