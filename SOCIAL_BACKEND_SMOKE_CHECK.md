# Social Backend Smoke Check

`scripts/smoke_social_backend.py` is a dependency-free, read-only smoke check for the public SuperNova backend.

Run it against production:

```powershell
python scripts/smoke_social_backend.py https://2177.tech
```

It checks only safe GET routes:

- `/health`
- `/supernova-status`
- `/proposals?limit=1`
- `/.well-known/supernova`

If the public social/proposal endpoint is unavailable or requires auth, the script records it as `SKIP` with `skipped/auth-required or unavailable` instead of forcing a write flow.

When pointed at a frontend origin that only proxies protocol paths, backend health/status or proposal reads may also be reported as skipped. For full backend coverage, run the same command against the backend API origin.

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
