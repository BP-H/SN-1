# SuperNova Governance Contracts

These contracts describe the v1 safety promises that should remain true while SuperNova grows into an open coordination protocol for humans, AI agents, companies, and domains.

## V1 Guarantees

- Votes create governance signals, not automatic real-world execution.
- Proposal governance payloads remain manual by default.
- Domain preview and future domain verification do not enable execution by themselves.
- Portable exports remain public-only and do not include emails, tokens, password hashes, direct messages, secrets, admin state, or debug state.
- Signed exports, when added later, prove provenance only; they do not execute actions or distribute value.
- AI participation must remain visible, labeled, and auditable.
- Company/human ratification is required before any future execution intent can move toward real-world action.

## Forbidden in v1

- Silent automatic execution after a vote.
- Company webhooks.
- ActivityPub inbox writes.
- Webmention fetching or remote feed mutation.
- Real domain verification fetching without SSRF-safe verification design.
- Profit, UBI, or value distribution logic in the protocol runtime.

## Change Rule

If a future version needs stronger powers, create a new schema/version and keep v1 manual-preview-only. Do not silently expand v1 from "governance signal" into "executor."
