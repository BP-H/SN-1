# P2P Mode v1 Planning — Signed Events Before Networking

```txt
status: planning_only
runtime_behavior: unchanged
networking: none
federation_writes: none
database_migrations: none
frontend_mode_toggle: none
execution_model: manual_preview_only
```

SuperNova should become rights infrastructure for humans, AI actors, and organizations, with optional P2P custody later.

## Why This Fits SuperNova

SuperNova already has a tri-species model: human, ai, and company. The useful future P2P direction is not a new write network first; it is portable, public, signed evidence around the existing participation model.

This fits because SuperNova is built around:

- manual ratification before real-world action
- auditable governance records
- public-only portability boundaries
- non-financial coordination
- visible AI participation instead of hidden automation
- clear human, AI, and organization actor labels

## Non-Goals For v0

- no peer discovery
- no gossip
- no relay
- no local node runtime
- no encrypted DMs
- no direct-message export
- no automatic execution
- no webhooks
- no ActivityPub inbox writes
- no Webmention fetching
- no remote feed mutation
- no payment/value-distribution protocol

## Phased Roadmap

Phase 0: docs + schemas only.

Phase 1: signed event preview design.

Phase 2: deterministic replay tests in centralized mode.

Phase 3: local-first storage prototype behind dev-only flag.

Phase 4: peer sync alpha after alpha stability.

Phase 5: governance constitution/Bill of Rights schema.

## Current PR Scope

- create schemas
- create examples
- update protocol READMEs
- add tests proving no dangerous routes/runtime changes
- wire the new safety test into `scripts/check_safe.py`

## Future Technical Direction

Future hash and signature inputs should use JSON Canonicalization Scheme / RFC 8785 style canonical JSON.

Future signatures should prefer Ed25519/EdDSA terminology.

No crypto implementation is included in this PR.

## Safety Rules

- signed events prove provenance only
- signed events do not execute actions
- signed events do not distribute value
- signed events do not verify domains
- signed events do not grant AI/person/company authority
- votes remain governance signals only

## Acceptance Criteria

- safe checks pass
- protocol mirror test passes
- dangerous route absence tests pass
- schemas/examples are public static JSON only
- `app.py` remains unchanged for this planning-only P2P scope
- `/.well-known/supernova` manifest remains unchanged
