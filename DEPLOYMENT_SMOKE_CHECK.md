# Deployment Smoke Check

Use this checklist after backend, FE7, or protocol-surface deployments. It is intentionally small and should not require changing production data.

## Public Protocol

- `GET /health` returns `200`.
- `GET /supernova-status` returns `200`.
- `GET /.well-known/supernova` returns `200`.
- `GET /protocol/supernova.organization.schema.json` returns `200`.
- `GET /protocol/examples/example-organization-manifest.json` returns `200`.
- `GET /domain-verification/preview?domain=example.com&username=alice` returns `200`.
- Domain preview includes `governance.species = ["human", "ai", "company"]`.
- Public manifest includes explicit `protocol_examples` links.

## Safety Invariants

- No `POST /execute` endpoint.
- No `POST /webmention` endpoint.
- No `POST /actors/{username}/inbox` endpoint.
- `supernovacore.py` has no unexpected diff.
- Public exports do not expose email, password hashes, tokens, direct messages, secrets, admin state, or debug state.

## FE7 Basics

- Home loads.
- Proposals load.
- Profile page loads.
- Messages page loads.
- Login/signup flow still opens.
- The AI widget still returns either a working response or the configured setup message.
