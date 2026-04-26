---
name: Feature request
about: Suggest a safe improvement that keeps current SuperNova guardrails intact
title: "[Feature] "
labels: enhancement
assignees: ""
---

## Summary

What would you like to improve?

## User Or Protocol Benefit

Who benefits and how?

## Safety Boundaries

- [ ] Does not touch `supernovacore.py` unless explicitly required.
- [ ] Does not add automatic execution.
- [ ] Does not add company webhooks.
- [ ] Does not add ActivityPub inbox writes.
- [ ] Does not add Webmention fetching or remote feed mutation.
- [ ] Does not expand public exports with private data.
- [ ] Does not change auth enforcement or database schema without a migration plan.

## Suggested Implementation

Describe the smallest safe version first.

## Verification

How should this be tested?
