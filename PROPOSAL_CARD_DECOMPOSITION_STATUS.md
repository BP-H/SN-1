# ProposalCard Decomposition Status

Last updated: 2026-05-12

This checkpoint records the safe FE7 `ProposalCard.jsx` decomposition work completed so far and the recommended order for future seams. Keep this work incremental: one seam per PR, visual/display shell first, state and mutations later only with focused tests.

## Extracted Components

The following display-oriented components have already been extracted from `super-nova-2177/frontend-social-seven/content/proposal/content/ProposalCard.jsx`:

- `ProposalAuthorHeader`
  - author name and username display
  - avatar and approved collaborator header display
  - profile link behavior
  - adjacent timestamp/meta text
- `ProposalVoteSummary`
  - support summary pill display
  - existing support percentage text passed from `ProposalCard`
- `ProposalTextContent`
  - non-editing proposal text/body display
  - existing `LinkifiedText` mention rendering
  - existing `Read More` / `Show Less` display behavior
- `ProposalMediaBlock`
  - image gallery display orchestration
  - video, link, PDF, and document display
  - existing media child components and layout
- `ProposalActionBar`
  - action bar container layout
  - existing `LikesDeslikes` child placement
  - comment toggle display
  - share button/menu display

## Still Inside ProposalCard

`ProposalCard.jsx` intentionally remains the owner for:

- edit/save/cancel state
- vote state and mutation ownership
- AI action modal triggers/state
- comments state/rendering
- collaborator invite/review state
- bookmarks
- option menu
- mutation/API handlers

## Safest Next Extraction Order

Future decomposition should continue in this order:

1. Proposal options menu shell.
2. Collaborator invite/review display shell.
3. Comment section shell, leaving comment state/API handlers in `ProposalCard`.
4. AI action trigger shell, leaving modal and approval semantics in `ProposalCard`.

## Do Not Move Yet

The following areas should stay in `ProposalCard` until there are focused tests and a dedicated plan:

- vote mutation logic
- AI custody/approve/cancel semantics
- proposal edit/save/cancel mutation logic
- backend/API behavior

## Safety Rule

Continue with one seam per PR. Prefer visual/display shells first. State ownership, mutation handlers, API behavior, and custody semantics should move only later, only with focused regression coverage, and only when the boundary is clear.
