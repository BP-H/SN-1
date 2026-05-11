# Media Storage Durability Plan

This is a readiness note for SN-1 production media. No media migration is
happening in this PR.

## Current Behavior

- The active backend reads `UPLOADS_DIR` from the environment. If it is unset,
  it falls back to `super-nova-2177/backend/uploads`.
- The backend creates the upload directory on startup and mounts `/uploads`
  through `SuperNovaUploadStaticFiles` in `super-nova-2177/backend/app.py`.
- Legacy extensionless image uploads are MIME-sniffed by byte signature when
  Starlette would otherwise serve them as `text/plain`.
- `/upload-image`, `/upload-file`, and proposal creation save uploaded bytes to
  the filesystem upload directory.
- Proposal media payloads store upload filenames or JSON arrays of filenames in
  proposal fields, then serialize them back as `/uploads/...` URLs.
- Small newly uploaded proposal images may also store bounded `data:image/...`
  fallback data in the proposal payload, controlled by
  `UPLOAD_IMAGE_DB_FALLBACK_MAX_BYTES`.

## Production Risk

Uploaded media is runtime state, not git state. A code deploy, branch sync, or
server restart should not delete posts by itself, but media can appear missing
when:

- production points at the wrong `DATABASE_URL`;
- production points at the wrong `UPLOADS_DIR`;
- the upload directory is on ephemeral local disk instead of a preserved volume;
- a deploy starts with an empty upload mount;
- existing `/uploads/...` bytes were already lost before the current code ran.

Old missing upload bytes cannot be reconstructed from code alone. A stored
filename is only a pointer; the original file bytes must come from the current
upload volume, backup, original file, or future durable object storage.

## Environment Values To Preserve

Before deploy, promotion, rollback, or a future storage migration, record and
preserve:

- `DATABASE_URL`
- `UPLOADS_DIR`
- `NEXT_PUBLIC_API_URL`
- any future object-storage bucket/account/key configuration

Never run DB reset, seed, drop, truncate, upload cleanup, or media rewrite
against production as part of a media-storage change.

## Backup Requirements

Before any future media migration:

1. Take a database backup.
2. Take an upload/media byte backup from the active `UPLOADS_DIR` volume or
   bucket.
3. Run `python scripts/public_data_snapshot.py <backend-url>`.
4. Run `python scripts/media_inventory.py <backend-url>`.
5. Save proposal count, proposal IDs/titles, sampled media URLs, and media probe
   content types.

## Read-Only Media Inventory

Use the inventory helper to sample public proposal media without mutating data:

```powershell
python scripts/media_inventory.py https://sn-1-production.up.railway.app
```

The helper:

- reads public proposals through GET only;
- collects sampled `/uploads/...` URLs;
- probes sampled upload URLs with GET only;
- reports status code and content type;
- flags missing files, `text/plain` images, and non-image MIME for image URLs;
- redacts query strings and inline `data:image/...` bytes in output;
- never writes, deletes, rewrites, uploads, or reads production secrets.

## Future Durable Storage Target

The recommended production target is durable object storage such as S3, R2, or
an equivalent managed bucket. A later migration should add a small storage
abstraction, preserve `/uploads/...` compatibility or provide safe URL
translation, copy current upload bytes to the bucket, verify public media URLs,
and only then promote the new storage path.

Do not begin that migration until backups, preview smoke, public data snapshots,
and media inventory checks are captured before and after the change.

## Restore Order

If posts or media appear broken after a deploy or future storage migration:

1. Roll back code/deployment first.
2. Restore upload/media bytes second.
3. Restore the database only if DB data changed unexpectedly.
4. Re-run `public_data_snapshot.py`, `media_inventory.py`, and browser smoke.
