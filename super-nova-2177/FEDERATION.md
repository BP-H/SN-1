# SuperNova Open Federation Notes

SuperNova is open by default. Public discovery endpoints may be read from any origin, and the backend does not treat browser origin as identity.

The current safety model is:

- Public reads and discovery may use wildcard, non-credentialed CORS.
- Cross-origin cookies are not part of the public API model.
- Local writes are protected by existing request checks and optional bearer-token identity matching.
- Future remote writes should require proof, such as verified domain control, Webmention verification, ActivityPub HTTP signatures, or another signed actor flow.

Current read-only federation surfaces:

- `GET /.well-known/supernova`
- `GET /.well-known/supernova.json`
- `GET /.well-known/webfinger`
- `GET /actors/{username}`
- `GET /actors/{username}/outbox`
- `GET /u/{username}/export.json`
- `GET /api/users/{username}/portable-profile`

Related protocol guardrails:

- `GOVERNANCE_EXECUTION.md`
- `ORGANIZATION_MANIFEST.md`
- `VALUE_SHARING.md`
- `AI_RIGHTS_RESEARCH.md`
- `protocol/`

These endpoints must stay public-only. They should not expose email, password hashes, access tokens, direct messages, private message metadata, secrets, admin state, or debug internals.

Domain fields are claims until verified:

- `claimed_domain` and `domain_url` mean the user entered a domain.
- `domain_verified: false` means SuperNova has not proven domain ownership yet.
- `verified_domain`, `verified_at`, and `verification_method` must remain empty until a real ownership check exists.

Do not show a verified-domain badge from a claimed domain alone.

Do not add write federation in a small polish pass. ActivityPub inbox POST, live Webmention fetching, remote reply import, and remote feed mutation need queued verification, SSRF protections, rate limits, and abuse review before they become live.

SuperNova may choose what it hosts, indexes, or relays locally, but the long-term identity direction is user-owned domains and portable public profiles rather than platform-owned identity.
