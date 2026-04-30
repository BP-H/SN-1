# Alpha QA Checklist

Use this checklist for a fast manual pass before product-sensitive releases.
Keep the checks observational: no payment, token, financial, or automatic value
distribution behavior is part of this alpha surface.

## Account

- Create an account.
- Sign in.
- Sign out.
- Sign back in after signing out.

## Public Social Flow

- Create a post.
- Vote on a post.
- Comment on a post.
- Follow another account.
- Send and read a message.
- Confirm public signed-out reads still work for feed, proposal, and profile
  pages.

## Collaborations

- Invite a collaborator from the post composer.
- Approve a collab request.
- Confirm the approved collab appears on both profiles.
- Confirm the approved collab appears in the correct profile tabs.
- Delete your own post that has a collab request or approved collab.

## Connector

- Open the MCP health URL in a browser: `/health`.
- Confirm `/health` reports an upstream JSON connector check.
- Use `/mcp` only as the ChatGPT/Codex connector URL; a browser GET to `/mcp`
  may say the endpoint expects POST requests.
- Run the MCP smoke helper against the deployed MCP origin when available.

## Mobile And Themes

- Smoke the main feed on mobile width.
- Smoke profile tabs on mobile width.
- Smoke light theme.
- Smoke dark theme.
