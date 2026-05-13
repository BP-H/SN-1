# SN-1 Release Candidate Verification - 2026-05-13

This is a read-only release-candidate verification for SN-1 alpha/release
readiness. No runtime behavior, frontend code, backend routes, database schema,
environment values, uploads, MCP tools, AI custody semantics, or protected core
files were changed.

## Repository State

- Repository: `BP-H/SN-1`
- Branch checked: `master`
- Current observed master SHA: `7c3ed643e69d99439bc0267c7500a7c35be21ea1`
- PR #177 is merged: AI media prompt input helpers extracted.
- PR #179 is merged: AI media prompt preflight verification recorded.
- PR #178 is merged: AI media prompt preflight script/doc baseline is on
  current master.

Current master includes all three changes. The observed merge order on master
is #177, #179, then #178, with #178 carrying the final master SHA above.

## Branch Protection

Required workflow check names exist in
`.github/workflows/local-safe-pr-gates.yml`:

- `Backend local deterministic checks`
- `FE7 local deterministic checks`

GitHub public branch metadata for `master` reported:

- `protected: true`
- `protection.enabled: false`
- required status-check enforcement: `off`
- required status-check contexts/checks: none visible

The direct branch protection endpoint returned `401 Unauthorized` without
admin credentials. Conclusion: branch protection appears partially visible, but
required status-check enforcement was not verified from available metadata.
Owner/manual GitHub settings confirmation is still required before treating
branch protection as fully enforced.

## Open Dependency PRs

Open PR count observed through the public GitHub API: 3. All were Dependabot
frontend dependency PRs and are non-blocking for this candidate unless they
fail current gates or are intentionally included in the release:

- #39 `deps: bump openai from 5.23.1 to 5.23.2 in /super-nova-2177/frontend-social-seven`
- #40 `deps: bump react-icons from 5.5.0 to 5.6.0 in /super-nova-2177/frontend-social-seven`
- #41 `deps: bump @eslint/eslintrc from 3.3.1 to 3.3.5 in /super-nova-2177/frontend-social-seven`

## Backend Public Smoke

Backend URL: `https://sn-1-production.up.railway.app`

| Endpoint | Status | Result |
| --- | ---: | --- |
| `/health` | 200 | JSON object |
| `/supernova-status` | 200 | JSON object |
| `/status` | 200 | JSON object |
| `/proposals?filter=latest&limit=30` | 200 | JSON array |
| `/connector/supernova` | 200 | JSON object |
| `/connector/supernova/spec` | 200 | JSON object |
| `/connector/public-digest` | 200 | JSON object |

Raw unsafe value scan across those public JSON responses found 0 raw
`postgres://` URLs, 0 username/password URL credentials, 0 Railway internal DB
hosts, and 0 raw long `data:image/...` bodies.

## Frontend Public Smoke

Frontend URL: `https://2177.tech`

| Path | Status | Result |
| --- | ---: | --- |
| `/` | 200 | HTML |
| `/about` | 200 | HTML |
| `/universe` | 200 | HTML |
| `/for-ai` | 200 | HTML |

## Public Data Snapshot

Command:

```powershell
python scripts/public_data_snapshot.py https://sn-1-production.up.railway.app
```

Result:

- `/health`: 200
- `/supernova-status`: 200
- `/proposals?filter=latest&limit=30`: 200
- proposal sample count: 23
- sampled proposal media includes `/uploads/560bea7b7b094bb49516f45f71d3dda6.png`

## Media Inventory

Command:

```powershell
python scripts/media_inventory.py https://sn-1-production.up.railway.app --limit 30 --max-urls 20 --timeout 10 --max-bytes 1024
```

Result:

- proposal count: 23
- media candidates found: 26
- media candidates checked: 20
- flagged count: 0
- sampled uploads returned image MIME types such as `image/png` and
  `image/jpeg`

## Public AI Reader Smoke

Command:

```powershell
python scripts/smoke_public_ai_reader.py https://sn-1-production.up.railway.app
```

Result:

- `/connector/supernova`: 200
- `/connector/supernova/spec`: 200
- `/connector/public-digest`: 200
- public digest mode: `public_read_only`
- public digest item count: 10
- unsafe finding count: 0

Digest safety flags:

- `no_writes`: true
- `no_private_state`: true
- `no_autonomous_execution`: true
- `approval_required_ai_actions`: true

## AI Media Prompt Preflight

Command:

```powershell
python scripts/smoke_ai_media_prompt_inputs.py --backend-url https://sn-1-production.up.railway.app --sample-upload-path /uploads/560bea7b7b094bb49516f45f71d3dda6.png --check-url
```

Result:

- public base URL resolved to `https://2177.tech`
- media base URL resolved to `https://sn-1-production.up.railway.app`
- sample upload path resolved to
  `https://sn-1-production.up.railway.app/uploads/560bea7b7b094bb49516f45f71d3dda6.png`
- raw `data:image/...` bodies were redacted in script diagnostics
- HEAD probe returned HTTP 200 with `image/png`
- no frontend-origin fallback warning appeared when `--backend-url` was set

## Advisory Notes

- Live/public smoke checks remain advisory/manual and are not branch-protection
  gates yet.
- Branch-protection required-check enforcement needs owner/manual GitHub
  settings confirmation because public metadata did not prove enforcement.
- Dependabot PRs #39, #40, and #41 are non-blocking unless intentionally pulled
  into the release or they fail the current gates.
- No release rollback action is indicated by this read-only verification.
