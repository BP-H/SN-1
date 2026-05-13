# AssistantOrb Decomposition Status

Last updated: 2026-05-13

This checkpoint records the current FE7 `AssistantOrb.jsx` decomposition status. Keep future work incremental: one seam per PR, visual/display shell first, and no state, mutation, API, or custody semantic movement until focused regression tests exist.

## Current Measurement

- Current approximate `AssistantOrb.jsx` line count: 1063 lines.
- Current approximate `AssistantAiActionsList.jsx` line count: 190 lines.
- Files measured:
  - `super-nova-2177/frontend-social-seven/content/AssistantOrb.jsx`
  - `super-nova-2177/frontend-social-seven/content/assistant/AssistantAiActionsList.jsx`
- Measurement source: current workspace after PR #164 was merged into SN-1 `master`.

## Extracted Components

- `super-nova-2177/frontend-social-seven/content/assistant/AssistantOrbShell.jsx`: assistant panel shell/header display.
- `super-nova-2177/frontend-social-seven/content/assistant/AssistantAiActionsList.jsx`: AI Actions list/card display shell.
- `super-nova-2177/frontend-social-seven/content/assistant/AssistantAiActionDetails.jsx`: AI-authored draft detail rows, generation label, compact hashes, and confidence helper.
- `super-nova-2177/frontend-social-seven/content/assistant/AssistantStatusBox.jsx`: shared notice, loading, error, and empty-state display shell.
- `super-nova-2177/frontend-social-seven/content/assistant/AssistantSettingsPanel.jsx`: AI Settings panel explanatory copy, status box, and settings button display shell.
- `super-nova-2177/frontend-social-seven/content/assistant/AssistantCommentPanel.jsx`: direct comment panel textarea, mention autocomplete slot, and submit/cancel button display shell.

## Duplicate Pending Draft UX

Duplicate pending AI comment drafts now reopen in the same AI delegate modal for approve/cancel instead of sending the user to the AI Actions list. The existing draft stays the single approval target; the UI should not create a second pending card, publish automatically, or imply autonomous execution.

Already-published duplicate AI comments now say they were already posted instead of describing the state as pending. Published duplicates should not show approve/cancel draft controls.

Backend `executed` duplicate AI delegate actions are treated as already posted, not pending. Executed duplicate responses should show no approve/cancel draft controls.

## Direct Comment Panel Extraction

The direct comment panel display is extracted, but `AssistantOrb.jsx` still owns comment text state, mention autocomplete state, caret behavior, submit/cancel handlers, backend calls, auth assumptions, and notices.

## Current Responsibilities

`AssistantOrb.jsx` currently owns a broad set of UI and behavior responsibilities:

- orb dock, drag, return-to-dock, ghost, and open/close state
- assistant dial/menu layout and panel placement
- active panel switching
- AI settings, comment, AI Actions, busy, and reply panel state
- AI settings model/API state, notices, backend calls, routing callbacks, and auth/session assumptions
- AI Actions queue loading, empty, error, and notice state selection
- draft approve/cancel controls for queued AI Actions
- direct comment composer state, mention autocomplete state, caret behavior, submit/cancel handlers, and send flow
- notifications/notices such as AI settings notice, connector action notice, and collab request errors
- API calls for local AI replies, connector actions, collab requests, and comments
- refresh events such as `supernova:ai-actions-refresh`
- post update events such as `supernova:post-action`
- auth/session assumptions used before writes or delegate actions

## Safest Display-Only Extraction Order

Future decomposition should start with display shells that receive already-computed props and callbacks from `AssistantOrb`:

1. Collab request summary display shell, leaving load/error state, request accept/decline handlers, routing/navigation behavior, backend calls, notices, and auth assumptions in `AssistantOrb.jsx`.
2. AI action draft button row display shell, leaving approve/cancel handlers in `AssistantOrb.jsx`.
3. Assistant reply/result display shell, leaving AI request state and fallback behavior in `AssistantOrb.jsx`.
4. Assistant dial/menu button display shell, leaving drag/dock pointer behavior and active panel state in `AssistantOrb.jsx`.

Each extraction should preserve existing copy, classes, mobile behavior, and light/dark behavior unless a tiny test-only adjustment is explicitly needed.

## Recommended Next Seam

The next safest seam is the collab request summary display shell, but only if it stays display-only. Keep load/error state, request accept/decline handlers, routing/navigation behavior, backend calls, notices, and auth assumptions in `AssistantOrb.jsx`.

## Do Not Move Yet

The following responsibilities should stay in `AssistantOrb.jsx` until there is a dedicated plan and focused regression coverage:

- approve/cancel handlers
- AI custody/approve/cancel semantics
- API calls
- AI Actions queue refresh behavior
- auth/session assumptions
- notification side effects
- query invalidation side effects
- comment send behavior
- submit/cancel handlers for direct comments
- mention autocomplete state and caret behavior
- drag/dock pointer behavior

## Manual FE Smoke Checklist

Use this checklist after any future AssistantOrb seam extraction:

- Open and close the AssistantOrb.
- Drag and dock the orb, then confirm return-to-dock still works.
- Open and close the AI Settings panel.
- Confirm the Assistant settings panel still renders.
- Confirm the AI Settings status box still renders.
- Confirm the Test AI button still works.
- Confirm Open AI Actions still works.
- Confirm Use AI delegate still opens the delegate flow.
- Confirm Open AI Genesis still navigates correctly.
- Open the direct comment panel.
- Confirm typing still works.
- Confirm `@` mention autocomplete still appears and keyboard behavior still works.
- Confirm Cancel closes the direct comment panel.
- Confirm the Post button disables on empty input.
- Confirm posting still uses the existing send flow.
- Open the AI Actions list.
- Confirm AI Actions empty, loading, error, and notice boxes still render.
- Attempt a duplicate pending AI comment and confirm the existing draft reopens in the same AI delegate modal.
- Attempt an already-published duplicate AI comment and confirm it says already posted, not pending.
- Attempt an executed duplicate AI comment and confirm it says already posted with no approve/cancel draft controls.
- Confirm approve/cancel buttons remain explicit.
- Confirm no copy suggests autonomous publishing.
- Confirm refresh events still update the AI Actions list and related notices.

## Safety Rule

Continue with one seam per PR. Prefer visual/display shells first. Keep state, mutation handlers, API behavior, refresh events, and AI custody semantics in `AssistantOrb.jsx` until focused tests prove the exact flow being moved remains unchanged.

