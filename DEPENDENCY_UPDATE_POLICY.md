# Dependency Update Policy

Dependabot helps surface security and maintenance updates, but dependency PRs should not be merged automatically.

## Default Rule

- No automerge.
- Review every dependency PR before merging.
- Do not merge dependency PRs while public protocol smoke or local safe checks are failing.
- Do not batch unrelated framework/runtime upgrades into the same merge unless a dedicated compatibility pass proves them safe.

## Patch And Minor Updates

Patch and minor updates may be merged after:

- `python scripts/check_safe.py --local-only`
- `python scripts/check_safe.py`
- FE7 `npm run lint` and `npm run build` when frontend packages changed.
- Backend federation/safety tests when backend Python packages changed.
- Review confirms no protocol, export, auth, execution, or federation-write behavior changed unexpectedly.

## Major Updates

Major updates require a separate review pass.

Dependabot is configured to ignore semver-major updates on monitored active surfaces. Major upgrades should be opened intentionally by a maintainer on a focused migration branch, not by routine dependency automation.

Treat these as higher risk:

- Next.js, React, TypeScript, ESLint, Tailwind, or build-tool major updates.
- FastAPI, Pydantic, SQLAlchemy, auth, crypto, upload, HTTP client, or database-driver major updates.
- GitHub Actions major updates that affect checkout, Python, Node, dependency install, or deployment behavior.

Major updates should include:

- A focused PR.
- Passing FE7 lint/build or backend tests as applicable.
- Public protocol smoke passing.
- A rollback plan or clear revert path.

## Never Rush These

Do not merge dependency updates that:

- Add automatic execution.
- Enable company webhooks.
- Enable write federation.
- Expand public exports with private data.
- Change auth enforcement without a migration plan.
- Change database schema without a migration plan.
- Break Vercel or Railway deployment assumptions.

## Dependabot Scope

Dependabot is intentionally limited to active surfaces:

- GitHub Actions.
- Active FE7 frontend dependencies.
- Root local-runner dependencies.
- Active backend wrapper dependencies.

Legacy and experimental subtrees should be updated only in dedicated branch-tested cleanup work.
