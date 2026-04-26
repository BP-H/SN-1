# Verified Domain v1 Plan

SuperNova domain verification should stay preview-only until the safety model is explicit, tested, and reversible. The current live product may show claimed domains and domain-as-profile intent, but it must not call a domain verified until control has been proven.

## Current Mode

- `GET /domain-verification/preview` returns instructions only.
- No external URL fetching is performed.
- No DNS lookup is performed.
- No database write is performed.
- No profile is marked verified.
- No execution, webhook, or federation write is enabled by domain preview.

## Future v1 Flow

1. User or organization claims a domain on its SuperNova profile.
2. SuperNova issues a short-lived verification challenge.
3. Domain owner publishes either:
   - `https://example.com/.well-known/supernova`
   - `_supernova.example.com` DNS TXT
4. SuperNova verifies the challenge through a guarded verifier.
5. SuperNova records:
   - `domain_verified: true`
   - `verified_at`
   - `verification_method`
   - `verification_challenge_id`
6. SuperNova periodically supports revocation or re-checking.

## Verifier Safety Requirements

- Block localhost, link-local, private, multicast, and metadata IP ranges.
- Limit redirects and reject protocol changes away from HTTPS.
- Use short timeouts and strict response-size caps.
- Parse JSON with a structured parser.
- Do not execute remote content.
- Treat DNS and HTTPS verification failures as unverified, not fatal app errors.
- Log verification attempts without storing secrets.

## Governance Boundary

Verified domains prove identity control only. They do not enable automatic execution.

For v1:

- `automatic_execution` remains `false`.
- Company webhooks remain disabled.
- ActivityPub inbox writes remain disabled.
- Webmention fetching/feed mutation remains disabled.
- Company/human ratification remains required for any future execution intent.
