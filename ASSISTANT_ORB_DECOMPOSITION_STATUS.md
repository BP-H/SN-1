# AssistantOrb Decomposition Status

Last updated: 2026-05-12

This checkpoint records the current FE7 `AssistantOrb.jsx` responsibilities before any extraction work begins. Keep future work incremental: one seam per PR, visual/display shell first, and no state, mutation, API, or custody semantic movement until focused regression tests exist.

## Current Measurement

- Current approximate `AssistantOrb.jsx` line count: 1263 lines.
- File measured: `super-nova-2177/frontend-social-seven/content/AssistantOrb.jsx`.
- Measurement source: current workspace after PR #152 was merged into SN-1 `master`.

## Current Responsibilities

`AssistantOrb.jsx` currently owns a broad set of UI and behavior responsibilities:

- orb dock, drag, return-to-dock, ghost, and open/close state
- assistant dial/menu layout and panel placement
- assistant panel header and active panel switching
- AI settings, comment, AI Actions, busy, and reply panel state
- AI Actions queue loading, empty, error, and notice display
- AI Actions list/card display
- AI action draft detail rows for review/comment/post drafts
- draft approve/cancel controls for queued AI Actions
- AI review, AI comment, and AI post draft display copy
- direct comment composer state and send flow
- notifications/notices such as AI settings notice, connector action notice, and collab request errors
- API calls for local AI replies, connector actions, collab requests, and comments
- refresh events such as `supernova:ai-actions-refresh`
- post update events such as `supernova:post-action`
- auth/session assumptions used before writes or delegate actions

## Safest Display-Only Extraction Order

Future decomposition should start with display shells that receive already-computed props and callbacks from `AssistantOrb`:

1. AssistantOrb shell/header layout.
2. AI Actions list/card display shell.
3. AI action draft detail rows.
4. Empty/loading/error display shell.

Each extraction should preserve existing copy, classes, mobile behavior, and light/dark behavior unless a tiny test-only adjustment is explicitly needed.

## Do Not Move Yet

The following responsibilities should stay in `AssistantOrb.jsx` until there is a dedicated plan and focused regression coverage:

- approve/cancel handlers
- AI custody/approve/cancel semantics
- API calls
- refresh event behavior
- auth/session assumptions
- notification and query invalidation side effects
- comment send behavior
- drag/dock pointer behavior

## Safety Rule

Continue with one seam per PR. Prefer visual/display shells first. Keep state, mutation handlers, API behavior, refresh events, and AI custody semantics in `AssistantOrb.jsx` until focused tests prove the exact flow being moved remains unchanged.

