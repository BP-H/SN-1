# Deployment And Media Preflight

Use this before an SN-2 alpha deployment, preview promotion, or SN-1 branch sync.
The goal is to prevent deployment/environment drift from looking like product
bugs, especially around uploaded images.

Pair this with `DATA_PRESERVATION_PREFLIGHT.md` before release promotion or any
future SN-1 sync preview.

For durable media/storage readiness and future object-storage migration gates,
see `MEDIA_STORAGE_DURABILITY_PLAN.md`.

For the concrete future SN-2 to SN-1 branch handoff, use
`SN1_SYNC_PREFLIGHT_2026-05-06.md` and keep the sync as a non-default branch
first.

## Active Deployment Roots

- Active FE7 deploy root: `super-nova-2177/frontend-social-seven`
- Active backend source: `super-nova-2177/backend/app.py`
- Root compatibility backend entrypoint: `app.py`
- Protected core files must remain zero-diff:
  - `super-nova-2177/backend/supernova_2177_ui_weighted/supernovacore.py`
  - `super-nova-2177/frontend-vite-basic/supernovacore.py`

Do not point production at deleted legacy frontend folders. Historical cleanup
docs may mention them, but they are not active deploy roots.

## Environment Preflight

Record and verify:

- `NEXT_PUBLIC_API_URL` points at the intended backend API origin, with no
  accidental localhost value in production.
- `DATABASE_URL` points at the intended production or staging database.
- `UPLOADS_DIR` points at the intended upload volume/folder if local filesystem
  uploads are used.
- Any object-storage or durable-media env vars point at the intended bucket or
  service.
- Backend CORS mode matches the intended public/open-network posture.
- Rollback deploy target and env snapshot owner are recorded.

## Media Persistence Reality

Uploaded images and files are runtime state, not git state.

- Git does not carry old upload bytes.
- `/uploads/<file>` works only when that file exists in the active upload
  storage.
- The bounded DB-backed `data:image/...` fallback helps newly uploaded proposal
  images stored after the fallback shipped.
- Old posts whose stored record only contains a filename cannot be reconstructed
  from app code if the file bytes are gone.
- Restore old missing images from original files, backups, or durable storage if
  available.

## Image URL Probe

Before deploy:

1. Fetch `/proposals?filter=latest&limit=30` from the current backend.
2. Record a small sample of media URLs:
   - `/uploads/...`
   - `data:image/...`
   - external URLs, if any
3. Directly request sampled `/uploads/...` URLs and confirm HTTP 200 plus an
   image content type.

After deploy:

1. Fetch the same proposals endpoint from the target backend.
2. Confirm sampled `/uploads/...` URLs still return HTTP 200 when the file is
   expected to exist.
3. Confirm `data:image/...` entries remain data URLs and are not prefixed with
   the backend origin.
4. Upload one fresh image, refresh feed/detail, and confirm it still renders.

For a structured read-only snapshot, run:

```powershell
python scripts/public_data_snapshot.py <backend-url>
```

For a read-only upload/media MIME inventory, run:

```powershell
python scripts/media_inventory.py <backend-url>
```

## AI Media Prompt Preflight

AI delegate image-aware drafts need `/uploads/...` media references to resolve
through a backend/media origin, not a frontend-only public site. Before a
deploy, verify that one of these values points at the intended backend or
durable media origin:

- `SUPERNOVA_MEDIA_PUBLIC_URL`
- `PUBLIC_MEDIA_BASE_URL`
- `SUPERNOVA_BACKEND_PUBLIC_URL`
- `BACKEND_PUBLIC_URL`
- `PUBLIC_API_BASE_URL`
- `SUPERNOVA_API_BASE_URL`
- `NEXT_PUBLIC_API_URL`
- `BACKEND_URL`
- Railway public URL/domain values when Railway hosts the backend

If none of these are configured, media prompt inputs may fall back to
`SUPERNOVA_PUBLIC_URL`, `PUBLIC_BASE_URL`, `NEXT_PUBLIC_SITE_URL`, or
`https://2177.tech`. That is acceptable only when that origin also serves
`/uploads/...`; otherwise AI image prompts can resolve through the wrong host.

Run the advisory preflight in dry mode:

```powershell
python scripts/smoke_ai_media_prompt_inputs.py --backend-url <backend-url> --sample-upload-path /uploads/<sample-image>
```

To probe the resolved sample upload with read-only HEAD/GET requests:

```powershell
python scripts/smoke_ai_media_prompt_inputs.py --backend-url <backend-url> --sample-upload-path /uploads/<sample-image> --check-url
```

The helper prints `PASS`, `WARN`, and `FAIL` lines. It never writes files,
mutates the database, uploads or deletes media, or prints raw `data:image/...`
bodies. This production smoke is advisory/manual for now; do not add it as a
required branch-protection gate until it is stable for scheduled/live checks.


Latest recorded production verification:
`AI_MEDIA_PROMPT_PREFLIGHT_VERIFICATION_2026-05-13.md`.

## Rollback

If media breaks after deploy:

1. Restore the previous FE7/backend deployment first.
2. Restore upload bytes to the expected `UPLOADS_DIR` or durable media store.
3. Restore database state only if the deploy changed data unexpectedly.
4. Re-run the image URL probe and manual image upload smoke.
