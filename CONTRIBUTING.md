# Contributing to SuperNova 2177

SuperNova is a live experiment, so small, reversible changes are preferred.

## Safety Rules

- Do not edit `super-nova-2177/backend/supernova_2177_ui_weighted/supernovacore.py` unless the issue explicitly asks for core work.
- Do not add automatic execution, company webhooks, ActivityPub inbox writes, Webmention fetching, or remote feed mutation without a dedicated design review.
- Keep public federation endpoints read-only unless a future phase adds verified identity proof, abuse controls, and rollback plans.
- Public exports must never include email, password hashes, access tokens, refresh tokens, direct messages, private message metadata, secrets, admin state, or debug state.
- Keep no-token legacy FE7 compatibility unless the change explicitly migrates authentication.

## Before Opening a PR

- Run backend safety tests when backend protocol, federation, profile, or export behavior changes.
- Run FE7 lint/build when frontend files change.
- Confirm `supernovacore.py` has no diff unless the PR is intentionally scoped to core work.
- Prefer docs, schemas, tests, and small gateway changes before risky refactors.
