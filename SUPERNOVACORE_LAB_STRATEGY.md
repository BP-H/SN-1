# SuperNovaCore Lab Strategy

This document describes how conceptual protocol ideas may move through
SuperNova without turning `supernovacore.py` into an unsafe permanent monolith.

## Purpose

`supernovacore.py` is both historically important and dangerous to edit
casually. It contains core protocol semantics and early experimental ideas. The
safe long-term direction is:

- Lab: explore carefully with explicit approval;
- Graduate: move proven concepts behind clean seams with tests;
- Retire: shrink the monolith over time without rushed refactors.

This strategy is not permission to casually edit `supernovacore.py`.
Production fixes should usually happen outside `supernovacore.py`.

Any core semantic change must follow `CORE_CHANGE_PROTOCOL.md`.

## Lab

New conceptual protocol ideas may be explored in or around `supernovacore.py`
only with explicit approval and protected-core review.

Lab work must answer:

- What protocol guarantee could this affect?
- Is this preview-only, read-only, or executable?
- Does it alter species authority, governance thresholds, or ratification?
- Does it expose new `/core` behavior?
- What test proves it cannot exceed its intended authority?

Lab work should stay small, labeled, reversible, and separate from routine
cleanup or dependency updates.

## Graduate

Proven concepts should graduate behind clean modules or backend wrapper seams
with focused tests. Graduation is appropriate when a concept has stable
semantics and a clear production boundary.

Graduation examples:

- weighted voting engine extracted behind a reviewed tally interface;
- governance threshold logic covered by explicit tests;
- AI or company participation represented as labeled, auditable inputs;
- domain verification preview separated from real verification fetching;
- signed export generation isolated from profile privacy policy;
- constellation or social graph reads exposed through bounded read APIs;
- future agent participation APIs separated from execution or write authority.

Graduated modules should preserve v1 guarantees unless a versioned protocol
change is approved.

## Retire

Over time, `supernovacore.py` should become a thin coordinator rather than a
large mixed-purpose file. Retirement must be gradual.

Do not retire core code by broad refactor. Prefer:

- assessment first;
- focused tests;
- one seam at a time;
- zero behavior drift;
- documented rollback.

Core retirement is successful when behavior becomes easier to prove, not merely
when files become smaller.

## Example Areas

The following areas require special care:

- weighted voting engine;
- governance thresholds and 90 percent important-decision behavior;
- AI participation and AI explanation/simulation;
- company participation and company ratification;
- domain verification and domain-as-profile trust;
- signed exports and portable public profiles;
- constellation/social graph ideas;
- future agent participation APIs;
- any path toward execution intents, webhooks, value sharing, or custody.

These areas may be explored, but they must remain visible, reviewed, tested,
and consistent with `CORE_CHANGE_PROTOCOL.md`.

## Practical Rule

If a change is a production fix, pagination improvement, deployment fix,
frontend compatibility change, smoke test, cleanup, or dependency update, assume
`supernovacore.py` should remain untouched.

If a change needs `supernovacore.py`, treat it as protocol work first and code
work second.
