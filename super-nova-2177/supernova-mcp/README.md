# SuperNova MCP Connector Prototype

This project is a dev-testable SuperNova MCP connector prototype. The first
version is public read-only: it exposes SuperNova public proposal, comment,
profile, and connector-spec reads through a separate MCP server surface.

It is intentionally separate from the active FE7 frontend and active backend.
It does not implement OAuth, private reads, draft actions, approve/cancel
actions, writes, connector secrets, or token storage.

MCP endpoint:

```txt
https://YOUR-SUPERNOVA-MCP-DEPLOYMENT.vercel.app/mcp
```

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
- `get_profile`
  - Calls `GET {SUPERNOVA_API_BASE_URL}/connector/profiles/{username}`
  - Args: `username` required
- `get_supernova_connector_spec`
  - Calls `GET {SUPERNOVA_API_BASE_URL}/connector/supernova/spec`

All tools use public connector endpoints only. Limits are clamped, offsets are
normalized, and upstream failures return clear tool errors without exposing
secrets, environment values, backend internals, or protected core internals.

## Environment

```txt
SUPERNOVA_API_BASE_URL=https://2177.tech
```

If `SUPERNOVA_API_BASE_URL` is not set, the server defaults to
`https://2177.tech`.

## Run Locally

```bash
npm install
npm run dev
```

Local endpoints:

- `http://127.0.0.1:3033/health`
- `http://127.0.0.1:3033/mcp`

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

   It should return JSON with `ok:true`.

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
   - `get_profile`
   - `get_supernova_connector_spec`

3. If ChatGPT exposes a custom connector or MCP developer UI, paste:

   ```txt
   https://YOUR-MCP-DEPLOYMENT.vercel.app/mcp
   ```

4. If ChatGPT custom connector UI is not available, test with Codex CLI instead.

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
- connector secrets
- token storage

Those should be separate, explicitly scoped PRs that preserve SuperNova's
existing auth-bound write rules and approval-required connector safety model.
