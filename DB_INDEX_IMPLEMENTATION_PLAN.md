# DB Index Implementation Plan

Branch: `scalability/plan-db-index-implementation`

Mode: docs-only planning. This pass does not change runtime code, database
schema, migrations, DB files, environment files, secrets, pagination behavior,
write behavior, frontend behavior, connectors, or agent mandates.

Current master commit inspected: `bda5c9d`

## Context

The first scalability pass is complete:

- PR #63 added optional `GET /comments` pagination.
- PR #64 added optional `GET /messages` pagination.
- PR #65 added optional embedded comments/votes caps to `GET /proposals`.

`PAGINATION_AND_INDEXES_ASSESSMENT.md` identified the likely index candidates.
This document narrows those findings into a safe implementation plan for future
schema/DDL PRs. No live database is touched here.

## Implementation Principles

- Prefer idempotent `CREATE INDEX IF NOT EXISTS`.
- Do not combine index creation with route behavior changes.
- Do not print or commit `DATABASE_URL`, secrets, tokens, cookies, or production
  connection values.
- Test index creation against an isolated temporary SQLite database first.
- Treat production-like database validation as required before applying DDL to
  a non-SQLite production backend.
- Keep `supernovacore.py`, `db_models.py`, migrations, DB files, FE7, auth,
  writes, federation, execution, domain verification, and AI runtime untouched
  unless a separate reviewed PR explicitly scopes them.

## Recommended Implementation Split

| Step | Scope | Why first |
| --- | --- | --- |
| A | comments + direct_messages indexes only | Directly supports the new read pagination paths and limits the first DDL PR to read-heavy social tables. |
| B | proposals + proposal_votes indexes only | Helps proposal feed ordering and embedded vote serialization, but has more planner nuance around `lower(userName)` and vote-count joins. |

Do not combine these with route changes or default limit changes.

## Step A: Comments And Direct Messages

### comments(proposal_id, created_at, id)

Candidate DDL:

```sql
CREATE INDEX IF NOT EXISTS idx_comments_proposal_created_id
ON comments (proposal_id, created_at, id);
```

Read paths helped:

- `GET /comments?proposal_id=...&limit=...&offset=...`
- embedded proposal comments when `embedded_comments_limit` is used
- proposal detail/list comment serialization if it later adopts stable ordering

Risk notes:

- `comments.proposal_id` is already visibly indexed in the ORM model. This
  composite index is still useful for stable ordered reads by proposal.
- Current no-param `/comments` behavior intentionally remains unchanged. This
  index must not be paired with an ordering/default behavior change.

Rollback note:

```sql
DROP INDEX IF EXISTS idx_comments_proposal_created_id;
```

### comments(parent_comment_id, created_at, id)

Candidate DDL:

```sql
CREATE INDEX IF NOT EXISTS idx_comments_parent_created_id
ON comments (parent_comment_id, created_at, id);
```

Read paths helped:

- notification reply lookup, especially reply scans by parent comment
- future reply-thread pagination if added later

Risk notes:

- `parent_comment_id` is already visibly indexed in the ORM model. This
  composite index improves ordered reply lookups without changing reply
  semantics.
- Do not pair this with comment tree/reply UI behavior changes.

Rollback note:

```sql
DROP INDEX IF EXISTS idx_comments_parent_created_id;
```

### direct_messages(conversation_id, created_at, id)

Candidate DDL:

```sql
CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation_created_id
ON direct_messages (conversation_id, created_at, id);
```

Existing index posture:

- `_ensure_direct_messages_table()` already creates:
  - `idx_direct_messages_conversation` on `(conversation_id, created_at)`
  - `idx_direct_messages_sender` on `(sender)`
  - `idx_direct_messages_recipient` on `(recipient)`

Read paths helped:

- `GET /messages?user=...&peer=...&limit=...&offset=...`
- stable peer-thread pagination ordered by `created_at ASC, id ASC`

Risk notes:

- The existing `(conversation_id, created_at)` index is already helpful. Adding
  `id` is a small improvement for the stable tie-breaker now used by the peer
  thread pagination query.
- Do not replace or remove the existing index in the first implementation PR.
- Conversation summary queries currently use `lower(sender)` and
  `lower(recipient)`, so plain sender/recipient indexes may be less useful for
  that query. Do not add expression indexes in the first PR.

Rollback note:

```sql
DROP INDEX IF EXISTS idx_direct_messages_conversation_created_id;
```

## Step B: Proposals And Proposal Votes

### proposals(created_at, id)

Candidate DDL:

```sql
CREATE INDEX IF NOT EXISTS idx_proposals_created_id
ON proposals (created_at, id);
```

Read paths helped:

- `GET /proposals?filter=latest`
- recent-post surfaces such as notifications/social graph scans
- future cursor pagination by created time, if introduced

Risk notes:

- Default feed ordering still often uses `id DESC`; primary key behavior may
  already help there.
- The index is most useful for `created_at` ordering and should not be combined
  with feed default/order behavior changes.

Rollback note:

```sql
DROP INDEX IF EXISTS idx_proposals_created_id;
```

### proposals(userName, id)

Candidate DDL:

```sql
CREATE INDEX IF NOT EXISTS idx_proposals_username_id
ON proposals (userName, id);
```

Read paths helped:

- profile/user post feeds where author filtering is used
- `GET /proposals?author=...`

Risk notes:

- Current filters use `lower(userName) = ...` in parts of the backend. A plain
  `(userName, id)` index may not be fully used for case-insensitive filters on
  every database.
- Do not introduce expression indexes such as `lower(userName)` in the first
  PR unless the target database support matrix is explicitly confirmed.
- A normalized lowercase author key could be a later schema change, but that is
  out of scope for this index plan.

Rollback note:

```sql
DROP INDEX IF EXISTS idx_proposals_username_id;
```

### proposal_votes(proposal_id, vote)

Candidate DDL:

```sql
CREATE INDEX IF NOT EXISTS idx_proposal_votes_proposal_vote
ON proposal_votes (proposal_id, vote);
```

Read paths helped:

- embedded vote serialization for proposal payloads
- vote-count aggregation for proposal filters such as top likes/fewest likes
- per-proposal vote breakdowns

Risk notes:

- `proposal_votes` already has a composite primary key on
  `(proposal_id, harmonizer_id)`, which helps per-proposal lookups.
- Adding `vote` helps vote-type filtering/counting, but should not be combined
  with vote write/auth changes.

Rollback note:

```sql
DROP INDEX IF EXISTS idx_proposal_votes_proposal_vote;
```

## Future Implementation PR A

Branch:

`scalability/add-comments-direct-messages-indexes`

Status:

- Completed by this follow-up PR with idempotent local/runtime DDL only.
- Added focused SQLite tests proving the three index names and existing
  direct-message indexes remain present after repeated helper calls.

Allowed files:

- `super-nova-2177/backend/app.py`, only if the existing runtime schema helper
  is the chosen DDL location.
- `super-nova-2177/backend/tests/test_db_indexes.py`, or similarly focused
  backend index tests.
- `CHANGELOG.md`.
- Optionally this plan document, only to mark PR A complete.

Recommended implementation:

- Add a tiny idempotent helper for read-path indexes, if no suitable helper
  already exists.
- Create only:
  - `idx_comments_proposal_created_id`
  - `idx_comments_parent_created_id`
  - `idx_direct_messages_conversation_created_id`
- Use `CREATE INDEX IF NOT EXISTS`.
- Do not remove or rename existing indexes.
- Do not change route behavior, default limits, auth, writes, or FE7.

Required tests:

- Temporary SQLite database creates all three indexes idempotently.
- Running the helper twice succeeds.
- Index names are visible via SQLite introspection.
- Existing comments/messages pagination tests still pass.
- No production DB URL or secret value is printed.

Required checks:

- `python -m unittest super-nova-2177/backend/tests/test_db_indexes.py`
- existing pagination tests
- existing auth/safety tests
- `python scripts/check_safe.py --local-only`
- full `python scripts/check_safe.py`
- social smoke against `https://2177.tech`
- FE7 lint/build
- protected `supernovacore.py` diff zero

Rollback:

- Revert the PR for code changes.
- If the DDL was applied to an environment, run the three `DROP INDEX IF EXISTS`
  statements listed in Step A.

## Future Implementation PR B

Branch:

`scalability/add-proposals-votes-indexes`

Status:

- Completed by this follow-up PR for `idx_proposals_created_id` and
  `idx_proposal_votes_proposal_vote` using idempotent local/runtime DDL.
- Deferred `idx_proposals_username_id` because active filters commonly use
  `lower(userName)`/case-insensitive matching and the mixed-case column makes a
  plain portable index less useful without production-like DB validation.

Allowed files:

- Same narrow pattern as PR A.
- Do not include comments/direct-message indexes unless PR A was deferred.

Recommended implementation:

- Create only:
  - `idx_proposals_created_id`
  - `idx_proposals_username_id`, only if current DB behavior accepts the limited
    usefulness around `lower(userName)` queries.
  - `idx_proposal_votes_proposal_vote`
- Use `CREATE INDEX IF NOT EXISTS`.
- Do not add expression indexes unless production-like DB validation explicitly
  approves them.

Required tests:

- Temporary SQLite database creates the proposed indexes idempotently.
- Running the helper twice succeeds.
- Existing proposal embedded caps tests still pass.
- Existing vote auth tests still pass.

Rollback:

- Revert the PR for code changes.
- If DDL was applied to an environment, run the `DROP INDEX IF EXISTS`
  statements listed in Step B.

## SQLite Versus Production-Like Validation

SQLite-compatible tests are enough to prove:

- DDL helper wiring is import-safe.
- `CREATE INDEX IF NOT EXISTS` statements are syntactically valid for SQLite.
- index creation is idempotent.
- index names are introspectable in a controlled temporary DB.

SQLite tests are not enough to prove:

- planner usage on the production database;
- expression-index portability;
- lock behavior or DDL runtime cost in production;
- case-insensitive author filtering performance.

Before applying indexes outside local/dev, run a production-like validation on
the actual DB engine family without printing connection strings or secrets.

## What Not To Touch

- runtime route behavior
- `supernovacore.py`
- `backend/app.py` except for a future narrowly scoped DDL helper PR
- `votes_router.py`
- `db_models.py`
- `auth_utils.py`
- FE7 behavior
- package files or lockfiles
- DB files or migrations in this planning PR
- uploads
- auth behavior
- pagination behavior
- proposal/comment/message/vote write behavior
- federation writes
- execution
- domain verification runtime
- AI runtime
- env files or secrets
- mentions, grants, reply UI
- connectors or agent mandates

## Bottom Line

Implement indexes in two small PRs. Start with comments and direct messages,
because they directly support the newly added read-compatible pagination
surfaces. Keep proposal and vote indexes separate because author filtering and
vote aggregation have more planner nuance. Do not combine index DDL with route
behavior changes.
