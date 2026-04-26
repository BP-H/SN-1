# Deployment Smoke Check

Use this checklist after backend, FE7, or protocol-surface deployments. It is intentionally small and should not require changing production data.

## Automated Check

Run the public protocol smoke script after deployment:

```bash
python scripts/smoke_protocol.py https://2177.tech
```

The script checks public manifests, schemas, examples, domain-preview safety fields, and confirms dangerous POST routes still return `404` or `405`.
It follows canonical host redirects, so either `https://2177.tech` or `https://www.2177.tech` can be checked.

For local pre-push verification, run:

```bash
python scripts/check_safe.py
```

This runs the backend federation safety tests, the public protocol smoke script, and a `supernovacore.py` zero-diff check that fails on protected-core diffs. Use `--skip-live` or `--local-only` when offline.

Run FE7 checks directly when frontend files change:

```bash
cd super-nova-2177/frontend-social-seven
npm run lint
npm run build
```

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
