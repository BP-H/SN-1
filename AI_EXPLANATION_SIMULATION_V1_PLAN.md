# AI Explanation And Simulation V1 Plan

This plan defines a future AI assistance layer for proposals and governance decisions. It is a design note only. It does not add a route, model call, database table, vote, webhook, or execution path.

## Current State

- No AI explanation or simulation runtime is added by this plan.
- Existing proposal and governance behavior remains unchanged.
- AI output must not change votes, proposal status, execution status, species identity, or domain verification.
- Execution remains manual-preview/manual-only.

## Intended V1 Role

AI may later help humans, companies, and AI agents understand a proposal by producing:

- A plain-language explanation.
- A risk summary.
- A possible-impact simulation note.
- A list of assumptions and uncertainty.
- A human-review reminder.

This layer is advisory. It is not an authority.

## Inputs

Future V1 clients may pass:

- Proposal title and text.
- Public governance payload.
- Public vote summary.
- Public organization/domain metadata when available.

Future V1 clients must not pass:

- Access tokens.
- Passwords or password hashes.
- Private messages.
- Private profile metadata.
- Admin or debug state.
- Secrets or environment variables.

## Outputs

Future V1 output should be a preview object with:

- `mode: "preview_only"`
- `changes_votes: false`
- `triggers_execution: false`
- `calls_webhooks: false`
- `requires_human_review: true`
- `summary`
- `risks`
- `simulation_notes`
- `assumptions`

The output should be labeled as AI-generated assistance and should remain auditable by humans.

## Non-Goals

V1 must not:

- Vote on behalf of a human, AI agent, or company.
- Trigger execution.
- Call company webhooks.
- Fetch remote Webmentions.
- Accept ActivityPub inbox writes.
- Verify domains.
- Change proposal status by itself.
- Hide prompts, assumptions, or uncertainty from reviewers.
- Create financial, payout, or value-distribution claims.

## Key And Provider Safety

Future implementation should support a clear key strategy before runtime use:

- Bring-your-own-key or server-side key handling must be explicit.
- API keys must never be exposed through public exports, protocol manifests, logs, or browser-visible config.
- Provider failures should degrade to "AI explanation unavailable" without blocking normal proposal use.

## Before Implementation

Before adding runtime behavior, create tests proving:

- AI explanation output cannot change votes.
- AI explanation output cannot trigger execution or webhooks.
- AI explanation output cannot mark domains verified.
- Private fields are never included in prompts or outputs.
- Human review remains required.

## Relationship To Governance Contracts

This plan preserves the current v1 promises:

- Votes do not execute.
- Domain verification does not execute.
- Signed exports do not execute.
- AI participation is visible and auditable.
- Company/human ratification is required before any future real-world action.
