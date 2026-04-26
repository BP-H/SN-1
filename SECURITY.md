# Security Policy

SuperNova is an open, public-interest coordination experiment. Please report security issues carefully so private data, account integrity, and future federation trust are protected.

## Please Report

- Private data exposure in public endpoints or exports.
- Authentication, session, token, or identity bypasses.
- Upload handling issues, including unsafe file handling.
- CORS, cache, or proxy behavior that exposes private account data.
- Federation or protocol routes that unexpectedly mutate data.
- Domain verification, signed export, or future Webmention risks such as SSRF.
- Any path that enables automatic execution, company webhooks, or value distribution without explicit governance review.

## How To Report

Prefer a private GitHub Security Advisory if repository access allows it. If a private channel is not available, open a minimal public issue that says a security report exists, without exploit details, private data, tokens, or proof-of-concept payloads.

For urgent issues, include:

- A short summary of the affected surface.
- Whether private data, auth, uploads, federation, or execution safety is involved.
- Reproduction steps that avoid exposing real secrets or user data.
- Suggested severity and any safe mitigation you already know.

## Safety Boundary

Do not publicly post exploit payloads, credentials, direct messages, private profile data, admin/debug output, or details that would enable abuse before maintainers have time to respond.

## Current Security Posture

Public federation and protocol routes are intentionally open for read-only discovery. Origin is not identity. Future remote writes must use proof such as verified domain control, signatures, or reviewed protocol-specific verification.

The v1 governance posture is manual-preview-only. Reports that find automatic execution, company webhook activation, write federation, or private export expansion should be treated as high priority.
