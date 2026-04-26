# Protocol Guarantee Matrix

This matrix maps SuperNova v1 promises to the places that document, test, or smoke-check them. It is meant to help future contributors and AI agents understand which contracts are active today.

| Guarantee | Documented by | Tested by | Smoke-checked by | Current status |
| --- | --- | --- | --- | --- |
| Votes do not execute automatically | `GOVERNANCE_CONTRACTS.md` | `test_system_vote_records_tally_without_execution_side_effects` and `test_proposal_governance_payload_stays_manual_and_non_executing` | Dangerous POST absence checks in `scripts/smoke_protocol.py` | Active |
| Proposal governance stays manual | `GOVERNANCE_CONTRACTS.md` | `test_proposal_governance_payload_stays_manual_and_non_executing` | Manifest manual-preview checks in `scripts/smoke_protocol.py` | Active |
| Domain preview does not verify or mutate | `VERIFIED_DOMAIN_V1_PLAN.md` | `test_domain_verification_preview_does_not_verify_or_mutate` | Domain-preview safety checks in `scripts/smoke_protocol.py` | Active |
| Domain verification does not enable execution | `VERIFIED_DOMAIN_V1_PLAN.md` and `GOVERNANCE_CONTRACTS.md` | Route absence and preview safety tests | Dangerous POST and preview safety checks | Active |
| Public exports exclude private data | `SIGNED_EXPORT_V1_PLAN.md` and `GOVERNANCE_CONTRACTS.md` | `test_actual_portable_profile_export_declares_public_only_privacy` and manifest privacy tests | Manifest private-field and portable-profile example checks | Active |
| Signed exports do not execute or distribute value | `SIGNED_EXPORT_V1_PLAN.md` and `GOVERNANCE_CONTRACTS.md` | Planned for signed export v1 implementation | Planned | Documented |
| No write federation exists in v1 | `super-nova-2177/FEDERATION.md` and `GOVERNANCE_CONTRACTS.md` | `test_write_federation_and_execution_routes_are_not_registered` | Dangerous POST absence checks | Active |
| ActivityPub actor/outbox remains read-only | `super-nova-2177/FEDERATION.md` | Route absence tests for inbox/outbox POSTs | Dangerous POST absence checks | Active |
| Webmention fetching/feed mutation is absent | `super-nova-2177/FEDERATION.md` and `GOVERNANCE_CONTRACTS.md` | Route absence tests | Dangerous POST absence checks | Active |
| Value sharing is non-financial and non-custodial | `super-nova-2177/VALUE_SHARING.md` | Domain-preview value-sharing assertions | Domain-preview value-sharing smoke checks | Active |
| Existing account species is not silently overwritten | `README.md` Species Contract | `test_social_sync_preserves_existing_account_species` | Not smoke-checked | Active |
| AI participation is visible and auditable | `GOVERNANCE_CONTRACTS.md` and `super-nova-2177/AI_RIGHTS_RESEARCH.md` | Planned | Planned | Documented |

## Change Rule

If a future change weakens or expands any active v1 guarantee, update this matrix, add or update a test, and prefer a new protocol/schema version over silently changing v1.
