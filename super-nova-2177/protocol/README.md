# SuperNova Protocol Schemas

These schemas describe the public, read-only contract SuperNova intends outside domains, companies, communities, and AI agents to understand.

They do not add execution, federation writes, database migrations, webhooks, or payment behavior. They are static contracts for safe interoperability.

## Schemas

- `supernova.organization.schema.json`: future company/community domain manifest.
- `supernova.three-species-vote.schema.json`: portable result shape for human, AI, and company vote outcomes.
- `supernova.execution-intent.schema.json`: manual preview object for decisions that may later be reviewed and executed by a verified organization.

## Current Safety Position

```txt
execution_current_mode = manual_preview_only
automatic_execution = false
company_webhooks = false
activitypub_inbox_post = false
webmention_feed_mutation = false
```

Any future implementation that turns these schemas into write APIs must preserve domain verification, explicit company/human ratification, audit logging, rollback planning, and abuse controls.
