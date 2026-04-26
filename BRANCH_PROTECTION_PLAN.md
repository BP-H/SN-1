# Branch Protection Plan

This plan describes how SuperNova can move from manual guardrails to stronger GitHub branch protection without surprising contributors or breaking the live app.

Current rollout state is tracked in `BRANCH_PROTECTION_ROLLOUT_STATUS.md`.
CODEOWNERS validation should be confirmed in a PR before any CODEOWNERS-based branch rule is enabled.

## Phase 1: Manual Checks

Current posture:

- Public protocol smoke runs daily and manually.
- Local safe-check workflow is manual-only.
- Contributors run FE7 lint/build directly when frontend behavior changes.
- Protected core changes are checked with `git diff --exit-code`.

No workflow is required as a blocking branch rule yet.

## Phase 2: Require Public Protocol Smoke

After the public smoke workflow is stable, consider requiring it before merge.

Requirement:

- `Public Protocol Smoke` passes.

This should be low risk because the workflow checks public, read-only protocol surfaces and dangerous route absence.

## Phase 3: Require Local Safe Check

Only after the manual safe-check workflow proves reliable in GitHub Actions, consider requiring it.

Requirement:

- `Local Safe Check` passes.

Do not make this required until dependency install behavior is stable across multiple manual runs.

## Phase 4: Protected File Review

Add review rules for sensitive files:

- `super-nova-2177/backend/supernova_2177_ui_weighted/supernovacore.py`
- `super-nova-2177/frontend-vite-basic/supernovacore.py`
- `scripts/check_safe.py`
- `scripts/smoke_protocol.py`
- `super-nova-2177/backend/tests/test_public_federation_safety.py`
- `GOVERNANCE_CONTRACTS.md`
- `PROTOCOL_GUARANTEE_MATRIX.md`

Use `CODEOWNERS` only after the correct maintainer handle or team is confirmed.

## Phase 5: Cleanup Branches

For repo hygiene work:

- Use a separate branch.
- Remove one class of artifact at a time.
- Do not delete active production paths.
- Do not refactor core or app structure as part of artifact cleanup.
- Run the release checklist before merge.

## Do Not Require Yet

Do not require strict deployment, auth, DB migration, domain verification, Webmention, or execution-intent checks until those systems exist and have stable workflows.
