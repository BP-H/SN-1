# AssistantOrb Decomposition Status

Last updated: 2026-05-12

This checkpoint records the current FE7 `AssistantOrb.jsx` decomposition status. Keep future work incremental: one seam per PR, visual/display shell first, and no state, mutation, API, or custody semantic movement until focused regression tests exist.

## Current Measurement

- Current approximate `AssistantOrb.jsx` line count: 1116 lines.
- File measured: `super-nova-2177/frontend-social-seven/content/AssistantOrb.jsx`.
- Measurement source: current workspace after PR #156 was merged into SN-1 `master`.

## Extracted Components

- `super-nova-2177/frontend-social-seven/content/assistant/AssistantOrbShell.jsx`: assistant panel shell/header display.
- `super-nova-2177/frontend-social-seven/content/assistant/AssistantAiActionsList.jsx`: AI Actions list/card display shell.
- `super-nova-2177/frontend-social-seven/content/assistant/AssistantAiActionDetails.jsx`: AI-authored draft detail rows, generation label, compact hashes, and confidence helper.

## Current Responsibilities

`AssistantOrb.jsx` currently owns a broad set of UI and behavior responsibilities:

- orb dock, drag, return-to-dock, ghost, and open/close state
- assistant dial/menu layout and panel placement
- active panel switching
- AI settings, comment, AI Actions, busy, and reply panel state
- AI Actions queue loading, empty, error, and notice display
- draft approve/cancel controls for queued AI Actions
- direct comment composer state and send flow
- notifications/notices such as AI settings notice, connector action notice, and collab request errors
- API calls for local AI replies, connector actions, collab requests, and comments
- refresh events such as `supernova:ai-actions-refresh`
- post update events such as `supernova:post-action`
- auth/session assumptions used before writes or delegate actions

## Safest Display-Only Extraction Order

Future decomposition should start with display shells that receive already-computed props and callbacks from `AssistantOrb`:

1. Empty/loading/error display shell.
2. AI action draft button row display shell, leaving approve/cancel handlers in `AssistantOrb.jsx`.
3. Assistant settings panel display shell, leaving model/API state and notice behavior in `AssistantOrb.jsx`.
4. Direct comment panel display shell, leaving comment send state and API behavior in `AssistantOrb.jsx`.

Each extraction should preserve existing copy, classes, mobile behavior, and light/dark behavior unless a tiny test-only adjustment is explicitly needed.

## Recommended Next Seam

The next safest seam is the empty/loading/error display shell for assistant panels. It is visual-only and should receive already-computed `loading`, `error`, `notice`, and empty-state props. Keep approval buttons, cancel buttons, API calls, query invalidation, and refresh events in `AssistantOrb.jsx`.

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

