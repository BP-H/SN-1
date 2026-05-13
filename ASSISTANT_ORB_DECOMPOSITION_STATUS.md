# AssistantOrb Decomposition Status

Last updated: 2026-05-13

This checkpoint records the current FE7 `AssistantOrb.jsx` decomposition status. Keep future work incremental: one seam per PR, visual/display shell first, and no state, mutation, API, or custody semantic movement until focused regression tests exist.

## Current Measurement

- Current approximate `AssistantOrb.jsx` line count: 877 lines.
- Current approximate `AssistantActionsPanel.jsx` line count: 42 lines.
- Current approximate `AssistantAiActionsList.jsx` line count: 163 lines.
- Current approximate `AssistantDockMenu.jsx` line count: 123 lines.
- Files measured:
  - `super-nova-2177/frontend-social-seven/content/AssistantOrb.jsx`
  - `super-nova-2177/frontend-social-seven/content/assistant/AssistantActionsPanel.jsx`
  - `super-nova-2177/frontend-social-seven/content/assistant/AssistantAiActionsList.jsx`
  - `super-nova-2177/frontend-social-seven/content/assistant/AssistantDockMenu.jsx`
- Measurement source: current workspace after PR #171 was merged into SN-1 `master`.

## Extracted Components

- `super-nova-2177/frontend-social-seven/content/assistant/AssistantOrbShell.jsx`: assistant panel shell/header display.
- `super-nova-2177/frontend-social-seven/content/assistant/AssistantAiActionsList.jsx`: AI Actions list/card display shell.
- `super-nova-2177/frontend-social-seven/content/assistant/AssistantAiActionDetails.jsx`: AI-authored draft detail rows, generation label, compact hashes, and confidence helper.
- `super-nova-2177/frontend-social-seven/content/assistant/AssistantStatusBox.jsx`: shared notice, loading, error, and empty-state display shell.
- `super-nova-2177/frontend-social-seven/content/assistant/AssistantSettingsPanel.jsx`: AI Settings panel explanatory copy, status box, and settings button display shell.
- `super-nova-2177/frontend-social-seven/content/assistant/AssistantCommentPanel.jsx`: direct comment panel textarea, mention autocomplete slot, and submit/cancel button display shell.
- `super-nova-2177/frontend-social-seven/content/assistant/AssistantCollabRequestsPanel.jsx`: collab request summary/count display shell.
- `super-nova-2177/frontend-social-seven/content/assistant/AssistantAiActionButtons.jsx`: AI action approve/cancel button row display shell.
- `super-nova-2177/frontend-social-seven/content/assistant/AssistantReplyBox.jsx`: assistant reply/result and busy display shell.
- `super-nova-2177/frontend-social-seven/content/assistant/AssistantActionsPanel.jsx`: AI Actions panel wrapper for the actions list and collab request summary.
- `super-nova-2177/frontend-social-seven/content/assistant/AssistantDockMenu.jsx`: dock button, ghost cursor, targeting tooltip, and radial dial/menu display shell.

## Duplicate Pending Draft UX

Duplicate pending AI comment drafts now reopen in the same AI delegate modal for approve/cancel instead of sending the user to the AI Actions list. The existing draft stays the single approval target; the UI should not create a second pending card, publish automatically, or imply autonomous execution.

Already-published duplicate AI comments now say they were already posted instead of describing the state as pending. Published duplicates should not show approve/cancel draft controls.

Backend `executed` duplicate AI delegate actions are treated as already posted, not pending. Executed duplicate responses should show no approve/cancel draft controls.

## Direct Comment Panel Extraction

The direct comment panel display is extracted, but `AssistantOrb.jsx` still owns comment text state, mention autocomplete state, caret behavior, submit/cancel handlers, backend calls, auth assumptions, and notices.

## Current Responsibilities

`AssistantOrb.jsx` currently owns a broad set of UI and behavior responsibilities:

- orb dock, drag, return-to-dock, ghost, and open/close state
- drag/dock pointer behavior
- position state
- open/close state
- active panel switching
- panel placement
- AI settings, comment, AI Actions, busy, and reply panel state
- AI settings model/API state, notices, backend calls, routing callbacks, and auth/session assumptions
- AI request/fallback state
- AI Actions queue loading, empty, error, and notice state selection
- draft approve/cancel controls for queued AI Actions
- duplicate guard handling for AI delegate drafts
- direct comment composer state, mention autocomplete state, caret behavior, submit/cancel handlers, and send flow
- notifications/notices such as AI settings notice, connector action notice, and collab request errors
- API calls for local AI replies, connector actions, collab requests, and comments
- refresh events such as `supernova:ai-actions-refresh`
- post update events such as `supernova:post-action`
- auth/session assumptions used before writes or delegate actions

## Next Architecture Phase

Frontend AssistantOrb display decomposition is now mostly complete. The next recommended phase is backend cleanup or dependency maintenance rather than moving more AssistantOrb state.

Do not move AssistantOrb state, mutations, API calls, queue refresh, or custody semantics unless focused regression tests are added first. Future frontend work should be driven by a specific bug or a narrowly tested state-management seam.

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

Use this checklist before the next architecture phase:

- Open and close the AssistantOrb.
- Confirm the orb appears in the mobile topbar.
- Confirm drag starts.
- Confirm the ghost cursor follows.
- Confirm dock return works.
- Confirm the dial/menu opens.
- Confirm each dial button opens the expected panel.
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

