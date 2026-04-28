# Backup And Restore Runbook

This runbook defines **documentation-only** backup and restore operations for SuperNova production readiness. It is intentionally conservative and does **not** require direct changes to live infrastructure from this repository.

## Scope And Constraints

- This runbook does not modify Railway, Vercel, database infrastructure, upload storage, or runtime secrets.
- Follow `CORE_CHANGE_PROTOCOL.md`; no protected core edits are required for backup/restore documentation.
- Local fallback database files are development safety tools and are not production state.

## 1) Never Commit These Items

Never commit or print in docs/logs:

- Database dumps or raw SQL backup exports.
- `DATABASE_URL` values.
- `SECRET_KEY` values.
- Supabase keys beyond expected public anon keys.
- Tokens, cookies, session values, OAuth callback codes, or auth artifacts.
- Production upload archives.
- `.env` files.

If sensitive material is captured locally for an operator drill, keep it outside the repository and purge it after the drill.

## 2) Production State Inventory

Treat the following as production state to inventory before release:

- Railway database referenced by `DATABASE_URL`.
- Backend uploads directory (or configured `UPLOADS_DIR`) when storage is local/persistent.
- Vercel environment variables.
- Railway environment variables.
- Public protocol/governance files committed in this repository.

Not production state:

- Local fallback DB files used for development/test resilience.

## 3) Pre-Release Backup Checklist

Before a production release:

- Confirm the latest production deployment is known and stable.
- Confirm the current DB backup/export path and operator ownership.
- Confirm uploads backup path if uploads are local or persistent.
- Record the release commit SHA.
- Run local and full safe checks.
- Run protocol and social/backend smoke checks according to release policy.

## 4) Restore Drill Checklist

Run restore drills in staging or another controlled environment first:

- Restore DB backup in non-production first.
- Verify health/status endpoints:
  - `/health`
  - `/supernova-status`
  - `/core/status`
- Verify protocol smoke checks.
- Verify social/backend smoke checks.
- Verify FE7 loads and can read posts.
- Verify upload URLs/content behavior if uploads apply.
- Never print secrets, token material, or DB URLs in logs/docs.

Promote to production only after non-production drill verification succeeds.

## 5) Rollback Decision Tree

Use the smallest rollback that restores safety and availability:

- **Frontend-only issue**: rollback FE deployment first when backend/protocol remain healthy.
- **Backend runtime issue**: rollback backend deploy/version while preserving validated data.
- **DB migration issue**: use migration rollback only when a migration was intentionally approved and introduced; avoid casual migrations.
- **Uploads/storage issue**: restore storage snapshot or prior upload volume when user-visible media integrity is affected.
- **Protocol/docs issue**: rollback to previous reviewed docs/protocol commit when runtime behavior is unchanged.

Escalate from narrow rollback to broader rollback only when prior scope does not recover service.

## 6) Post-Restore Verification

Run the following verification set after restore actions:

- `python scripts/check_safe.py --local-only`
- `python scripts/check_safe.py`
- `python scripts/smoke_social_backend.py https://2177.tech`
- FE7 lint/build validation.
- Protected `supernovacore.py` diff remains zero unless an explicitly approved core change is part of the operation.

## Operational Notes

- Keep this runbook aligned with `RELEASE_CHECKLIST.md` and `PRODUCTION_READINESS_GAP_ASSESSMENT.md`.
- Any future automation should be proposed in a separate, narrow PR with explicit safety review.
