# SN-1 Sync Preflight - 2026-05-06

This is the safe handoff checklist for a future SN-2 to SN-1 sync. It is
preparation only. Do not use this PR to merge into SN-1 `master`, push directly
to SN-1 `master`, change production data, reset databases, delete uploads, or
change environment variables.

## Current Readiness

- SN-2 controlled alpha/preview gates are green through PR #73.
- SN-2 `master` branch protection is still not verified enabled unless the owner
  confirms it in GitHub settings or branch metadata.
- SN-2 to SN-1 must be pushed as a non-default branch first.
- Suggested SN-1 branch: `sn2-alpha-sync-2026-05-06`.
- Do not merge SN-1 `master` until preview smoke passes and the owner explicitly
  approves the SN-1 `master` merge.

## Data And Media Preservation Rules

- Preserve `DATABASE_URL`.
- Preserve `UPLOADS_DIR` or the durable media bucket.
- Preserve `NEXT_PUBLIC_API_URL`.
- Take a database backup before deploy or sync.
- Take an upload/media backup before deploy or sync.
- Git does not carry DB rows or uploaded image bytes.
- Existing posts and images disappear only if the deploy points at the wrong DB,
  points at the wrong storage, or upload bytes are missing.
- Old missing upload bytes cannot be reconstructed from app code alone.
- Do not run DB reset, seed, drop, truncate, migration reset, upload cleanup, or
  destructive local-state commands against production or staging data.

## Future Command Plan

These commands are documentation only for the future sync operator. Do not run
them in this PR.

```powershell
# 1. Verify remotes.
git remote -v

# Expected:
# origin -> https://github.com/BP-H/SN-1.git
# sn2    -> https://github.com/BP-H/SN-2.git

# 2. Fetch latest SN-2 master.
git fetch sn2 master

# 3. Verify or add the SN-1 remote without changing master.
git remote get-url origin
# If missing or wrong, fix deliberately:
# git remote add origin https://github.com/BP-H/SN-1.git

# 4. Create the non-default SN-1 sync branch from SN-2 master.
git switch -c sn2-alpha-sync-2026-05-06 sn2/master

# 5. Push only the non-default branch to SN-1.
git push -u origin sn2-alpha-sync-2026-05-06

# 6. Open an SN-1 PR or preview deployment from that branch.
# Do not push to SN-1 master.
# Do not merge SN-1 master yet.
```

Forbidden in the future sync unless explicitly approved after preview smoke:

```powershell
git push origin master
git push origin sn2/master:master
git checkout master
git merge sn2/master
```

## Snapshot Plan

Before sync or deploy:

```powershell
python scripts/public_data_snapshot.py <current-backend-url>
```

Save outside git:

- timestamp
- backend URL
- `/health` status
- `/supernova-status` status
- `/proposals?filter=latest&limit=30` status
- proposal count
- proposal IDs and titles
- sampled media URLs

After SN-1 preview deploy:

```powershell
python scripts/public_data_snapshot.py <sn1-preview-backend-url>
```

Compare:

- endpoint status remains 200 where expected
- proposal sample count is sane for the intended DB
- proposal IDs and titles match the expected environment
- sampled media URLs are preserved
- sampled `/uploads/...` URLs return HTTP 200 with image content type where
  bytes exist
- `data:image/...` entries remain data URLs and are not prefixed with a backend
  origin

If the snapshot mismatches:

1. Roll back code first.
2. Restore uploads/media bytes second.
3. Restore DB only if actual DB data changed unexpectedly.
4. Re-run the snapshot and quick browser image smoke.

## SN-1 Master Merge Gates

Before any SN-1 `master` merge, require:

- `Backend local deterministic checks` green.
- `FE7 local deterministic checks` green.
- FE7 deploy root is `super-nova-2177/frontend-social-seven`.
- Backend health/status/proposals return 200:
  - `/health`
  - `/supernova-status`
  - `/proposals?filter=latest&limit=30`
- Public data snapshot before and after preview deploy matches the intended DB
  and media state.
- Sampled `/uploads/...` URLs return HTTP 200 with image content type where files
  exist.
- Quick browser smoke passes:
  - signed-out feed
  - create post/proposal
  - comment
  - vote/support
  - image upload and refresh
  - existing image display where bytes exist
  - AI delegate create
  - AI review/comment/post approve and cancel
  - mobile feed/composer/AI modal sanity
- Owner explicitly approves the SN-1 `master` merge.

## Rollback Plan

- Keep SN-1 `master` unchanged until preview smoke passes.
- Keep a pre-sync SN-1 commit/tag reference.
- Keep DB backup and upload/media backup from before deploy or sync.
- If images or posts appear broken after preview, restore the previous code
  deployment first, restore upload/media bytes second, and restore DB only if
  data changed unexpectedly.

## Status

SN-1 sync was not performed in this PR.
