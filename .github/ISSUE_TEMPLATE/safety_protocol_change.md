---
name: Protocol or safety change
about: Propose a change to federation, governance, verification, exports, or execution guardrails
title: "[Protocol/Safety] "
labels: protocol,safety
assignees: ""
---

## Proposal

What protocol or safety contract should change?

## Current Contract

Which current file or test does this affect?

- [ ] `GOVERNANCE_CONTRACTS.md`
- [ ] `super-nova-2177/FEDERATION.md`
- [ ] `VERIFIED_DOMAIN_V1_PLAN.md`
- [ ] `SIGNED_EXPORT_V1_PLAN.md`
- [ ] `scripts/smoke_protocol.py`
- [ ] `super-nova-2177/backend/tests/test_public_federation_safety.py`
- [ ] Other:

## Risk Review

- [ ] Does not enable automatic execution.
- [ ] Does not enable company webhooks.
- [ ] Does not enable write federation.
- [ ] Does not enable remote feed mutation.
- [ ] Does not expose private data.
- [ ] Keeps company/human ratification required for real-world action.

## Migration Or Versioning

If this changes a v1 contract, explain why it should become a new schema/version instead of silently changing v1.

## Verification

What tests, smoke checks, or docs must change with this proposal?
