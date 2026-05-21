# P2P Protocol Scope v0

## Purpose

Define the narrow object surface that can safely become signed event data later.

## In Scope

- public post/proposal metadata
- public comments
- public votes/governance signals
- public profile identity fields
- follows/public relationship signals
- public governance proposal lifecycle metadata

## Explicitly Out Of Scope

- direct messages
- private groups
- private backups
- email
- password hashes
- tokens
- secrets
- admin/debug state
- private moderation evidence
- automatic execution
- webhooks
- remote writes
- financial/value custody

Messages/DMs are excluded from P2P v0 until key custody, encryption, recovery, abuse review, and private-data export boundaries are designed.

## Event Type Candidates

- `ProposalCreated`
- `ProposalUpdatedPublicFields`
- `CommentCreated`
- `CommentUpdatedPublicFields`
- `VoteCast`
- `ProfileUpdatedPublicFields`
- `FollowCreated`
- `FollowRemoved`
- `GovernanceSnapshotPublished`

## Data Classification

| Surface | Current route/model | P2P v0 status | Privacy notes | Future event type |
| --- | --- | --- | --- | --- |
| Public post/proposal metadata | `/proposals`, `Proposal` | In scope | Public title/body/media/governance preview only | `ProposalCreated`, `ProposalUpdatedPublicFields` |
| Public comments | `/comments`, comment rows | In scope | Public comment body and public author identity only | `CommentCreated`, `CommentUpdatedPublicFields` |
| Votes/governance signals | `/votes`, system vote helpers | In scope | Public governance signal only; no execution authority | `VoteCast`, `GovernanceSnapshotPublished` |
| Public profile identity | `/profile/{username}`, `/u/{username}/export.json` | In scope | Public profile fields only; no email, auth, or private state | `ProfileUpdatedPublicFields` |
| Follows/public relationships | `/follows` surfaces | In scope | Public relationship signals only | `FollowCreated`, `FollowRemoved` |
| Direct messages | `/messages` | Out of scope | Excluded until private-data/export boundaries exist | None |
| Private/admin/debug state | admin/debug internals | Out of scope | Must never appear in signed public events | None |
