# Social Backend Smoke Check

`scripts/smoke_social_backend.py` is a dependency-free, read-only smoke check for the public SuperNova backend.

Run it against the public frontend/protocol origin:

```powershell
python scripts/smoke_social_backend.py https://2177.tech
```

Run it separately against the direct backend API origin when `NEXT_PUBLIC_API_URL` is available and points to a reachable backend:

```powershell
python scripts/smoke_social_backend.py "$NEXT_PUBLIC_API_URL" --strict-backend
```

Do not print secrets, paste private environment values into public logs, or commit environment files while running these checks.
If `NEXT_PUBLIC_API_URL` points to a local development backend, start that backend first or treat strict backend smoke as not yet available for that environment.

It checks only safe GET routes:

- `/health`
- `/supernova-status`
- `/proposals?limit=1`
- `/.well-known/supernova`

If the public social/proposal endpoint is unavailable or requires auth, the script records it as `SKIP` with `skipped/auth-required or unavailable` instead of forcing a write flow.

When pointed at a frontend/protocol origin such as `https://2177.tech`, backend health/status or proposal reads may be reported as skipped if that origin only proxies protocol paths. For full backend coverage, run the script against the direct backend API origin with `--strict-backend`.

In `--strict-backend` mode, `/health` and `/supernova-status` must return `200` JSON or the script exits nonzero. Proposal/feed reads remain read-only and may still be skipped if the endpoint is unavailable or auth-gated.

## What This Proves

- The backend is reachable when backend health/status routes are not skipped.
- Public status/health routes return JSON when they are exposed on the checked origin.
- The public proposal/read surface is reachable when available and exposed on the checked origin.
- The public protocol bridge is still reachable from the same deployment origin.

## What This Does Not Prove

This smoke check does not test:

- user registration
- login or auth enforcement
- messages
- comments
- votes
- follows
- uploads
- proposal creation or edits
- database mutations

Those flows require a staged test account and separate write-safe testing later.
