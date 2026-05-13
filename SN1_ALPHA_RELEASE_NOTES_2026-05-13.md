# SN-1 Alpha Release Notes - 2026-05-13

These notes summarize the current SN-1 alpha release candidate after the SN-2
sync, production stabilization, public AI reader work, AssistantOrb and
ProposalCard decomposition passes, media preflights, and PR #181 password
hashing unification.

## Release Highlights

- Public AI reader surface is available through the read-only connector routes
  and the `/for-ai` FE7 page.
- AI delegate actions remain custody-preserving: drafts require explicit human
  approve/cancel decisions before anything is published.
- Duplicate AI delegate standalone comments and replies are guarded by delegate,
  target proposal, and parent reply scope.
- AssistantOrb display decomposition extracted shell, settings, actions,
  status, reply, comment, collab, dock, and action-detail/button components
  while leaving state, API calls, and custody semantics in the owning flow.
- ProposalCard display decomposition extracted author, text, media, vote,
  action, options, collab, and comments display shells while leaving mutations
  and API ownership in `ProposalCard`.
- AI image/media prompt handling now resolves backend/media-origin upload URLs,
  supports bounded inline image fallback, and has advisory preflight smoke
  verification.
- Password hashing is unified through `backend/password_hashing.py`; new model
  and seed hashes use PBKDF2 helpers, while legacy SHA-256 login compatibility
  and successful-login upgrade behavior are preserved.

## Current Known Caveats

- Branch protection enforcement still needs owner/manual confirmation in GitHub
  settings before it should be treated as fully enforced.
- Alembic migrations remain future work.
- Dependabot PRs #39, #40, and #41 are non-blocking unless intentionally
  included in a separate dependency pass.
- No production DB schema migration is included in this release.
- No autonomous AI execution is included in this release.

## Release Boundary

This release-prep bundle is docs and verification only. It does not change
runtime behavior, backend routes, frontend code, database schema, environment
settings, uploads, MCP tools, AI custody semantics, or protected core files.
