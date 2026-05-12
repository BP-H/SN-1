# Public AI Reader Release Verification - 2026-05-11

This note records a GET-only production verification pass after PR #136 added
the public AI reader surface. No production writes, authentication, DB reset,
upload changes, environment changes, or protected core changes were performed.

## Production Frontend GET Checks

All checked frontend pages returned `200` HTML and were not rate limited:

- `https://2177.tech/`
- `https://2177.tech/about`
- `https://2177.tech/universe`
- `https://2177.tech/for-ai`

The new `/for-ai` page returned clean HTML with no unsafe value hits from the
secret/private marker scan. The existing `/about` page still contains a
pre-existing public contact `mailto:` link; this is not connector data and was
not changed in this verification PR.

## Production Backend GET Checks

All checked backend routes returned `200` JSON and were not rate limited:

- `https://sn-1-production.up.railway.app/health`
- `https://sn-1-production.up.railway.app/supernova-status`
- `https://sn-1-production.up.railway.app/status`
- `https://sn-1-production.up.railway.app/proposals?filter=latest&limit=30`
- `https://sn-1-production.up.railway.app/connector/supernova`
- `https://sn-1-production.up.railway.app/connector/supernova/spec`
- `https://sn-1-production.up.railway.app/connector/public-digest`

Structured scans of backend JSON string values found no raw DB URLs,
userinfo-style credentials, Railway internal DB hosts, private notification
markers, pending collab markers, private email values, or giant inline
`data:image/...` bodies.

## Public Digest Result

`/connector/public-digest` returned:

- `mode`: `public_read_only`
- sampled public digest items: `10`
- `safety.no_writes`: `true`
- `safety.no_private_state`: `true`
- `safety.no_autonomous_execution`: `true`
- `safety.approval_required_ai_actions`: `true`

No raw upload bytes or giant inline image bodies were observed in the digest.

## Smoke Tool Result

The new smoke helper was run against production:

```powershell
python scripts/smoke_public_ai_reader.py https://sn-1-production.up.railway.app
```

Result:

- `/connector/supernova`: `200`
- `/connector/supernova/spec`: `200`
- `/connector/public-digest`: `200`
- unsafe finding count: `0`
- overall result: pass

The helper performs unauthenticated GET requests only. It never writes,
authenticates, mutates data, reads local environment files, or prints
secret-bearing response values.

## Release Status

The public AI reader release surface is verified for production GET access.
The connector remains public-read-only, AI actions remain approval-required, and
no autonomous execution path was added.
