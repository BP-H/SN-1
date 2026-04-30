# SuperNova MCP Connector Prototype

This project is a dev-testable SuperNova MCP connector prototype. The first
version is public read-only: it exposes SuperNova public proposal, comment,
profile, vote-summary, and connector-spec reads through a separate MCP server
surface.

It is intentionally separate from the active FE7 frontend and active backend.
It does not implement OAuth, private reads, draft actions, approve/cancel
actions, writes, connector secrets, or token storage.

MCP endpoint:

```txt
https://YOUR-SUPERNOVA-MCP-DEPLOYMENT.vercel.app/mcp
```

Current behavior:

- Browser health/admin check: `/health`
- ChatGPT/Codex MCP URL: `/mcp`
- Browser `GET /mcp` saying it expects POST requests is normal
- If `/health` reports `upstream_connector_check.json:false`, set
  `SUPERNOVA_API_BASE_URL` to the backend API origin that returns JSON for
  `/connector/supernova`

Current production connector URLs:

```txt
ChatGPT/Codex connector URL: https://sn-1-anls.vercel.app/mcp
Browser health test:        https://sn-1-anls.vercel.app/health
```

For the Vercel project, `SUPERNOVA_API_BASE_URL` must be the backend API
origin that returns JSON for:

```txt
<SUPERNOVA_API_BASE_URL>/connector/supernova
```

If `https://2177.tech/connector/supernova` returns `404`, blank content, or
HTML, then `2177.tech` is acting as the frontend origin and should not be used
as `SUPERNOVA_API_BASE_URL` for the MCP deployment. Copy the real backend API
origin from the `sn-1` deployment settings, the FE7 `NEXT_PUBLIC_API_URL`, or
the Railway backend deployment URL.

## Tools

- `search_proposals`
  - Calls `GET {SUPERNOVA_API_BASE_URL}/connector/proposals`
  - Args: `search` optional, `limit` optional, `offset` optional
- `get_proposal`
  - Calls `GET {SUPERNOVA_API_BASE_URL}/connector/proposals/{id}`
  - Args: `id` required
- `get_proposal_comments`
  - Calls `GET {SUPERNOVA_API_BASE_URL}/connector/proposals/{id}/comments`
  - Args: `id` required, `limit` optional, `offset` optional
- `get_proposal_vote_summary`
  - Calls `GET {SUPERNOVA_API_BASE_URL}/connector/proposals/{id}/votes`
  - Args: `id` required
- `get_profile`
  - Calls `GET {SUPERNOVA_API_BASE_URL}/connector/profiles/{username}`
  - Args: `username` required
- `get_supernova_connector_spec`
  - Calls `GET {SUPERNOVA_API_BASE_URL}/connector/supernova/spec`

All tools use public connector endpoints only. Limits are clamped, offsets are
normalized, and upstream failures return clear tool errors without exposing
secrets, environment values, backend internals, or protected core internals.
Voting still happens only inside SuperNova through the existing hardened and
approval-required flows. This MCP server cannot cast votes silently.

## Environment

```txt
SUPERNOVA_API_BASE_URL=https://2177.tech
```

If `SUPERNOVA_API_BASE_URL` is not set, the server defaults to
`https://2177.tech`. For production Vercel deployments, override that default
with the backend API origin that returns JSON for `/connector/supernova`.

## Run Locally

```bash
npm install
npm run dev
```

Local endpoints:

- `http://127.0.0.1:3033/health`
- `http://127.0.0.1:3033/mcp`

`/mcp` is an MCP transport endpoint. Opening it directly in a browser with a
plain `GET` can return a message such as `expects POST requests`; that is
normal. Use `/health` for browser checks, and paste the `/mcp` URL into
ChatGPT/Codex or another MCP client because those clients POST MCP requests.

## Deploy To Vercel

1. Create a new Vercel project.
2. Set the project root directory to:

   ```txt
   super-nova-2177/supernova-mcp
   ```

3. Add this environment variable:

   ```txt
   SUPERNOVA_API_BASE_URL=https://2177.tech
   ```

4. Deploy.
5. Copy the deployment URL and append `/mcp`.

Connector URL pattern:

```txt
https://YOUR-MCP-DEPLOYMENT.vercel.app/mcp
```

## Dead-Simple Deployment Test

After deployment:

1. Open the health endpoint in a browser:

   ```txt
   https://YOUR-MCP-DEPLOYMENT.vercel.app/health
   ```

   It should return JSON with `ok:true`. Before connecting ChatGPT, also
   verify `upstream_connector_check.json` is `true`. That means the MCP
   deployment can reach a JSON backend connector facade at
   `/connector/supernova`.

   You can also test the upstream directly:

   ```txt
   <SUPERNOVA_API_BASE_URL>/connector/supernova
   ```

   That URL should return JSON. If it returns HTML, set
   `SUPERNOVA_API_BASE_URL` to the backend/Railway API origin, not the frontend
   app URL.

2. From this folder, run the smoke helper against the deployment base URL:

   ```bash
   npm run smoke -- https://YOUR-MCP-DEPLOYMENT.vercel.app
   ```

   The smoke helper checks `/health`, performs an MCP initialize/list-tools
   handshake against `/mcp`, and verifies these public read-only tools are
   present:

   - `search_proposals`
   - `get_proposal`
   - `get_proposal_comments`
   - `get_proposal_vote_summary`
   - `get_profile`
   - `get_supernova_connector_spec`

3. If ChatGPT exposes a custom connector or MCP developer UI, paste:

   ```txt
   https://YOUR-MCP-DEPLOYMENT.vercel.app/mcp
   ```

   Do not use browser `GET /mcp` as the deployment test. A browser-visible
   `expects POST requests` response is expected for the MCP endpoint.

4. If ChatGPT custom connector UI is not available, test with Codex CLI instead.

## Troubleshooting Vercel Output Directory

If Vercel reports:

```txt
Error: No Output Directory named "public" found after the Build completed.
```

this project includes `public/index.json` and `vercel.json` sets
`outputDirectory` to `public`. Redeploy the Vercel project rooted at
`super-nova-2177/supernova-mcp`, then open `/health` and run:

```bash
npm run smoke -- https://YOUR-MCP-DEPLOYMENT.vercel.app
```

## Troubleshooting Non-JSON Upstream Responses

If ChatGPT or the MCP smoke helper reports that SuperNova upstream returned a
non-JSON response, open:

```txt
https://YOUR-MCP-DEPLOYMENT.vercel.app/health
```

Check `upstream_connector_check`. If `json` is `false`, the configured
`SUPERNOVA_API_BASE_URL` is probably pointing at a frontend HTML route instead
of the backend JSON connector facade. Set it to the backend API origin where:

```txt
<SUPERNOVA_API_BASE_URL>/connector/supernova
```

returns JSON. The health payload reports only the upstream origin and connector
check status; it does not print connector secrets or private tokens.

## Test With Codex CLI

```bash
npm i -g @openai/codex
codex mcp add supernova --url https://YOUR-MCP-DEPLOYMENT.vercel.app/mcp
codex
```

Then ask:

```txt
Use SuperNova to search proposals about AI rights.
```

## Test In ChatGPT If Available

If your ChatGPT account exposes custom connector or MCP developer settings:

1. Open Settings.
2. Go to Apps / Connectors.
3. Choose Add custom connector, Add MCP server, or Developer connector.
4. Paste:

   ```txt
   https://YOUR-MCP-DEPLOYMENT.vercel.app/mcp
   ```

5. Connect.
6. Ask SuperNova questions such as:

   ```txt
   Search SuperNova proposals about AI rights.
   ```

Availability and labels for custom connector/MCP UI may vary by ChatGPT plan,
workspace, and rollout.

## Not Included Yet

- OAuth
- private reads
- draft actions
- approve/cancel actions
- writes
- voting
- connector secrets
- token storage

Those should be separate, explicitly scoped PRs that preserve SuperNova's
existing auth-bound write rules and approval-required connector safety model.
