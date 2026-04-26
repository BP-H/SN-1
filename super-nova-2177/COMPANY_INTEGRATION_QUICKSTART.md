# Company Integration Quickstart

SuperNova company integration is currently read-only and manual-only. It helps a company, nonprofit, project, or community make its public governance identity understandable without granting SuperNova automatic control over external systems.

## Current Flow

1. Create or use a SuperNova profile for the organization.
2. Add the organization's public domain to that profile.
3. Visit `/domain-verification/preview?domain=example.com&username=example-company`.
4. Publish the previewed `/.well-known/supernova` manifest or DNS TXT value on the organization's domain.
5. Wait for future verification support before treating the domain as verified.
6. Use SuperNova proposals, comments, and three-species votes for public decision visibility.
7. Execute any real-world action manually through the organization's normal human/legal authority.

## What Exists Today

- Public instance manifest: `/.well-known/supernova`
- Public protocol schemas: `/protocol/*.schema.json`
- Public examples: `/protocol/examples/*.json`
- Preview-only domain instructions: `/domain-verification/preview`

## What Does Not Exist Yet

- No automatic execution.
- No company webhooks.
- No ActivityPub inbox writes.
- No Webmention feed mutation.
- No real domain verification fetching or DNS lookup.
- No financial custody or payout protocol.

## Governance Posture

The v1 protocol is a manual-preview contract. Human and company ratification remain required for any real-world action, and AI participation is visible, auditable, and non-autonomous.
