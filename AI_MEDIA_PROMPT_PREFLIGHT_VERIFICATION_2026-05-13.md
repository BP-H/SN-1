# AI Media Prompt Preflight Verification - 2026-05-13

This is a read-only production verification for AI media prompt image inputs.
No production writes, uploads, deletes, DB mutations, env changes, or media
migration actions were performed.

## Backend

- Backend URL: `https://sn-1-production.up.railway.app`
- Public discovery endpoint: `GET /proposals?filter=latest&limit=30`
- Public proposal sample count: 23
- Media inventory result: 26 media candidates found, 20 sampled, 0 flagged

## Sample Upload

- Selected proposal: `66`
- Selected upload path: `/uploads/560bea7b7b094bb49516f45f71d3dda6.png`
- Discovery source: public proposal media field
- Media inventory probe: HTTP 200, `image/png`

## Preflight Commands

Dry advisory preflight:

```powershell
python scripts/smoke_ai_media_prompt_inputs.py --backend-url https://sn-1-production.up.railway.app --sample-upload-path /uploads/560bea7b7b094bb49516f45f71d3dda6.png
```

Result:

- PASS: public base URL resolves to `https://2177.tech`
- PASS: media base URL resolves to `https://sn-1-production.up.railway.app`
- PASS: sample upload path resolves to
  `https://sn-1-production.up.railway.app/uploads/560bea7b7b094bb49516f45f71d3dda6.png`
- PASS: raw `data:image/...` bodies are redacted in script diagnostics
- WARN: network probe not run in dry mode

Read-only media probe:

```powershell
python scripts/smoke_ai_media_prompt_inputs.py --backend-url https://sn-1-production.up.railway.app --sample-upload-path /uploads/560bea7b7b094bb49516f45f71d3dda6.png --check-url
```

Result:

- PASS: public base URL resolves to `https://2177.tech`
- PASS: media base URL resolves to `https://sn-1-production.up.railway.app`
- PASS: sample upload path resolves to
  `https://sn-1-production.up.railway.app/uploads/560bea7b7b094bb49516f45f71d3dda6.png`
- PASS: raw `data:image/...` bodies are redacted in script diagnostics
- PASS: HEAD returned HTTP 200 with `image/png`

## Status

- Media origin resolves to the backend/media origin.
- No frontend-origin fallback warning appeared when `--backend-url` was set.
- Raw inline image data stayed redacted in script diagnostics.
- The sampled production upload was reachable with an image MIME type.
- This remains an advisory/manual production smoke check, not a required
  branch-protection gate.
