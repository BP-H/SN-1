# Changelog

All notable public protocol, safety, and contributor-facing changes are summarized here.

## Unreleased

- Added a production backup/restore runbook and release-checklist confirmation gate without runtime or infrastructure changes.
- Added community health docs: root license, security policy, code of conduct, and issue templates.
- Added governance contracts documenting v1 manual-preview-only safety guarantees.
- Added verified-domain and signed-export v1 plans without enabling runtime verification or signing.
- Added public protocol schemas, examples, and manifest links for organization manifests, execution intents, three-species votes, and portable profiles.
- Added domain-verification preview metadata, including non-financial and non-custodial value-sharing language.
- Added portable profile governance/privacy metadata for public-only exports.
- Added public protocol smoke checks, a daily/manual smoke workflow, and the local safe-check helper.
- Added backend safety tests for read-only federation, absent dangerous POST routes, manual governance, public-only exports, system-vote non-execution, and species preservation.
- Added print-only cleanup candidate inventory tooling and maintenance audit guidance.
- Added conservative dependency monitoring, manual safe-check workflow, protocol guarantee matrix, and release checklist.
- Added dependency update policy and branch protection rollout plan.
- Tightened Dependabot to leave semver-major upgrades for manual migration branches.
- Added AI explanation and simulation v1 plan as preview-only, non-executing guidance.
- Added protected-path CODEOWNERS and a read-only cleanup candidate snapshot.
- Added branch protection rollout status to keep enforcement staged and non-surprising.
- Recorded CODEOWNERS validation outcome and safe-check baseline snapshot.
- Added read-only social/backend smoke checks, strict backend-origin mode, and PowerShell-correct documentation.
- Added auth/social login smoke baseline docs for Supabase dependency update gates.
- Added CODEOWNERS coverage for social/backend smoke tooling and refreshed the safe-check baseline after PR #13.
- Added CODEOWNERS coverage for cleanup assessment docs and changelog.
- Added CODEOWNERS coverage for dependency triage assessment.
- Updated FE7 eslint-config-next to 15.5.15 after isolated dependency checks.
- Updated FE7 tailwindcss to 4.2.4 after isolated dependency checks and visual sanity review.
- Updated FE7 @supabase/supabase-js to 2.104.1 after isolated dependency checks and auth/social smoke review.
- Pinned active FE7 Next to 15.5.15 after RSC/Next security assessment.
- Added production-only fallback SECRET_KEY hardening with focused tests.
- Added DB engine consistency tests for active backend runtime wiring.
- Added backend.db_utils fallback DB engine tests.
- Simplified backend.db_utils fallback session factory with tests preserving behavior.
- Added core-change protocol and SuperNova Lab strategy docs to protect future core/governance evolution.
- Added production readiness gap assessment for uploads, FE7 API origin, CI gates, and backup/restore planning.
- Added bounded backend upload size checks with focused oversized-file tests.
- Added FE7 production API-origin fail-fast validation to avoid localhost fallback in production.
- Added local safe PR gates workflow for deterministic backend and FE7 checks.
- Added read-compatible pagination parameters for public comment reads.
- Added read-compatible pagination parameters for direct message reads.
- Added read-compatible embedded comments/votes caps for proposal list reads.
- Added a safe DB index implementation plan for scalability follow-up PRs.
- Added idempotent comments and direct-message read indexes with focused tests.
- Added auth-bound write route hardening assessment for active backend identity checks.
- Added product roadmap assessment for grants, mentions, reply UI, and homepage clarity.
- Added guest write policy assessment for proposal and comment creation routes.
- Required bearer-token ownership checks for profile updates and direct-message routes.
- Required bearer-token ownership checks for upload-image profile sync.
- Required bearer-token ownership checks for follow and unfollow mutations.
- Required bearer-token ownership checks for comment edit and delete mutations.
- Required bearer-token ownership checks for votes router create/delete mutations and removed dummy user auto-create.
- Required bearer-token ownership checks for system-vote mutations and removed stale default deadline enforcement.
- Required bearer-token ownership checks for proposal and comment creation.
- Hardened debug-supernova production gating and removed filesystem internals from its development response.
- Removed generated combined repo snapshot after branch-tested cleanup.
- Removed tracked backup Python files after branch-tested cleanup.
