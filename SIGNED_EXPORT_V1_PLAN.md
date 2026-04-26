# Signed Export v1 Plan

SuperNova portable profile exports should remain public-only while gaining verifiable provenance over time. Signing an export should prove where the export came from and which public profile state it represents; it must not expand what data is exposed.

## Current Mode

- Public export surfaces are read-only.
- Export payloads must exclude private fields.
- No email, password hash, access token, refresh token, direct messages, private message metadata, secrets, admin state, or debug state should appear in public exports.
- Domain ownership may be claimed but is not treated as verified until a separate verification flow proves control.

## Future v1 Envelope

A signed export can wrap the existing public export payload without changing its privacy boundary:

```json
{
  "schema": "supernova.signed_portable_profile.v1",
  "profile_url": "https://2177.tech/u/example/export.json",
  "issued_at": "2026-04-26T00:00:00Z",
  "issuer": "https://2177.tech/.well-known/supernova",
  "payload_hash": "sha256-...",
  "signature": {
    "type": "ed25519",
    "key_id": "https://2177.tech/.well-known/supernova#export-signing-key-1",
    "value": "base64url-signature"
  }
}
```

## Safety Requirements

- Sign only public export payloads.
- Keep the unsigned public export available for compatibility.
- Publish verification instructions before treating signatures as governance-grade.
- Support key rotation and revoked key metadata.
- Never sign private backups, direct messages, auth tokens, or admin/debug state.
- Do not treat a signed export as domain verification by itself.
- Do not trigger execution, webhooks, federation writes, or value distribution from a signed export.

## Verification Direction

Future verifiers should:

1. Fetch the public export payload.
2. Hash the exact canonical JSON representation.
3. Fetch the issuer's public signing key.
4. Check key validity and revocation metadata.
5. Verify the signature over the payload hash and metadata.
6. Display verification status separately from domain verification status.

Signed exports are a trust and portability primitive, not an execution primitive.
