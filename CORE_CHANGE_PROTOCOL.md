# SuperNova Core Change Protocol

This protocol protects changes that could alter SuperNova's governance meaning,
public protocol guarantees, or future real-world authority. It is meant for
maintainers, contributors, and AI coding agents before any protected-core work.

## Constitutional Core

`super-nova-2177/backend/supernova_2177_ui_weighted/supernovacore.py` is the
constitutional core source of truth for SuperNova protocol semantics.

Most frontend, backend-wrapper, cleanup, pagination, deployment, smoke-check,
tooling, and documentation work must keep protected `supernovacore.py` diff
zero. A zero diff is the default proof that routine work did not silently alter
core governance behavior.

## Changes That Trigger This Protocol

Use this protocol before any change that affects or may affect:

- governance semantics;
- species rights or species identity preservation;
- AI or company authority;
- weighted-vs-equal species behavior;
- 90 percent important-decision behavior or governance thresholds;
- voting, tallying, ratification, or proposal execution meaning;
- execution intents or any path from votes to real-world action;
- value sharing, value distribution, custody, payments, or financial language;
- domain verification, claimed-domain authority, or domain-as-profile trust;
- public/private export boundaries, portable profiles, or signed exports;
- public protocol schemas, examples, or versioned v1 behavior;
- `/core` route exposure or any public surface that reveals core internals.

## Required Review Package

Any core semantic change must include:

- a guarantee impact statement explaining which v1 promises are affected;
- review or update of `GOVERNANCE_CONTRACTS.md`;
- review or update of `PROTOCOL_GUARANTEE_MATRIX.md`;
- schema and version review if v1 behavior changes;
- focused tests for the changed guarantee;
- smoke/check updates if public behavior changes;
- rollback plan with exact files and behavior to restore;
- explicit maintainer approval before merge.

If the change does not affect guarantees, state that clearly in the PR and keep
the protected core diff zero.

## V1 Non-Negotiables

SuperNova v1 remains manual-preview-only.

The following must not be added silently:

- automatic execution after votes;
- company webhooks;
- ActivityPub inbox writes;
- Webmention fetching or remote feed mutation;
- real domain verification fetching;
- value distribution, custody, or payment flows;
- hidden AI authority;
- unreviewed `/core` route expansion.

Votes create governance signals. AI may help explain or simulate. Companies may
participate visibly. Human and company ratification remains required before
future real-world action.

## Real-World Action Rule

Any feature that can trigger real-world execution, distribute or custody value,
verify domains with external fetching, or bind companies to action requires:

- a new protocol version or explicit versioned extension;
- human and company ratification design;
- legal review;
- security review;
- abuse and rollback plan;
- dedicated tests and public smoke coverage;
- documentation updates before runtime wiring.

Do not turn a v1 governance signal into an executor by incremental route changes.

## Default Safe Path

For ordinary work:

1. Keep `supernovacore.py` untouched.
2. Prefer backend-wrapper seams, frontend compatibility layers, docs, tooling,
   and tests.
3. Run safe checks.
4. Confirm protected core zero diff.
5. Record any guarantee impact as "none" when appropriate.

For core work:

1. Stop and write the guarantee impact statement first.
2. Update governance docs and tests with the implementation.
3. Keep the PR small enough to review as protocol work, not incidental cleanup.
