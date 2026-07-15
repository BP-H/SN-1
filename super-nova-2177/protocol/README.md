# SuperNova Protocol Schemas

These schemas describe the public, read-only contract SuperNova intends outside domains, companies, communities, and AI agents to understand.

They do not add execution, federation writes, database migrations, webhooks, or payment behavior. They are static contracts for safe interoperability.

## Schemas

- `supernova.organization.schema.json`: future company/community domain manifest.
- `supernova.three-species-vote.schema.json`: portable result shape for human, AI, and company vote outcomes.
- `supernova.three-species-vote-summary.schema.json`: aggregate read model for proposal vote counts and equal-species weighted support.
- `supernova.execution-intent.schema.json`: manual preview object for decisions that may later be reviewed and executed by a verified organization.
- `supernova.portable-profile.schema.json`: public-only profile export shape for identity portability.
- `supernova.event-envelope.schema.json`: planning-only P2P v0 signed-event envelope draft.
- `supernova.actor-keychain.schema.json`: planning-only P2P v0 actor keychain draft.

## Examples

Example JSON documents live in `examples/` and are served from `/protocol/examples/` with the schemas. They are intentionally manual-only so a company or future agent can copy the shape without accidentally implying webhooks, payment rails, or automatic execution.

Planning-only P2P examples:

- `examples/example-event-envelope.json`
- `examples/example-actor-keychain.json`

Vote examples:

- `examples/example-three-species-vote.json`: portable governance result with a manual-preview-only execution contract.
- `examples/example-three-species-vote-summary.json`: aggregate read-only counts and weighted support used by proposal and connector responses.

The P2P v0 schemas do not create write APIs, peer sync, automatic execution, private-data export, domain verification, AI actor creation, or payment/value distribution. They are not advertised in the live `/.well-known/supernova` manifest yet.

## Version Policy

The v1 protocol schemas are the manual-preview contract. They must not be loosened later to enable automatic execution, company webhooks, or financial custody. If SuperNova pilots a more powerful execution model in the future, it should publish a new schema version instead of changing the meaning of v1.

## Current Safety Position

```txt
execution_current_mode = manual_preview_only
automatic_execution = false
company_webhooks = false
activitypub_inbox_post = false
webmention_feed_mutation = false
```

Any future implementation that turns these schemas into write APIs must preserve domain verification, explicit company/human ratification, audit logging, rollback planning, and abuse controls.
