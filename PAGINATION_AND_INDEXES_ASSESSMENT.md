# Pagination and Indexes Assessment

Branch: `scalability/assess-feed-pagination-and-indexes`

Mode: assessment only. This pass does not change runtime code, route behavior,
database schema, migrations, frontend behavior, deployment settings, environment
files, secrets, or legacy frontend files.

Current master commit inspected: `8b5d581`

## Summary

The active FE7 proposal feed is already using bounded pagination:

- FE7 main feed requests `/proposals?filter=...&limit=30&offset=...`.
- FE7 profile posts request `/proposals?filter=latest&author=...&limit=30&offset=...`.
- The backend `/proposals` route accepts `limit`, `offset`, and `before_id`,
  with a default limit of 80 and a max limit of 200.

The smallest safe future improvement is not a schema change first. It is a
backend-only, additive pagination/capping PR that preserves existing behavior by
default while allowing FE7 to opt into bounded embedded payloads:

- add optional embedded vote/comment caps to `/proposals`;
- add optional `limit`/`offset` or cursor params to `/comments`;
- add optional `limit`/`before_id` or `before_created_at` params to direct
  message peer threads.

DB indexes would help existing ordering/filtering, but index work should be a
separate schema/DDL PR with explicit tests and rollback notes. Do not combine
index creation with route pagination behavior.

## Active Route And Frontend Findings

| Surface | Current behavior | FE7 usage | Risk |
| --- | --- | --- | --- |
| `GET /proposals` | Supports `filter`, `search`, `author`, `before_id`, `limit`, and `offset`. Default `limit=80`, max `200`. Orders by `id`, `created_at`, or vote counts depending on filter. | Main feed and user profile posts use `limit=30` plus offset pagination. Header/notifications use `limit=3`. | Top-level list is bounded, but each returned proposal serializes all votes and comments for that proposal. |
| `GET /proposals/{pid}` | Fetches one proposal and serializes all votes and comments for that proposal. | Detail pages and cards fetch individual proposals. | Detail payload can grow with comments/votes. |
| `GET /comments?proposal_id=...` | Returns all comments for a proposal. No `limit`, `offset`, or cursor. | Comment UI primarily receives embedded comments from proposal payloads, but the route is public and unbounded. | Unbounded route. First pagination candidate. |
| `GET /messages?user=...` | Conversation summary uses DB query `ORDER BY created_at DESC LIMIT 1000`; JSON fallback scans all local messages. | Message page and mobile header request conversation summaries. | DB path bounded but high; JSON fallback scans all local messages. |
| `GET /messages?user=...&peer=...` | Peer thread returns all messages in that conversation ordered ascending. | Message page fetches selected peer thread without pagination. | Unbounded peer-thread route. First pagination candidate. |
| `GET /social-users` | Default `limit=36`, max `80`; internally scans up to 240 proposals to infer users. | Message/search UI uses default, `limit=8`, or `limit=80`. | Bounded enough for now. |
| `GET /social-graph` | Default `limit=14`, max `96`; internally bounds proposal scan to 80-320, comments/votes to 120 per proposal, direct messages to 160-360. | Universe page uses `limit=72`; right rail uses `limit=14`. | Bounded. Keep as-is for first pass. |
| `GET /notifications` | Default `limit=12`, max `30`; reply lookup caps owned comments at 500. | Header and notification panel use `limit=3`. | Bounded. Keep as-is for first pass. |
| `GET /follows` | Reads JSON follow store and returns all matching followers/following for a user. Store is trimmed to last 5000 writes. | User profile and comment/profile actions use this route. | Not DB-indexable today; pagination can wait. |
| `GET /profile/{username}` | Returns profile summary, latest proposal, and counts; does not return a list. | Profile surfaces use it. | Not a list route. |
| `GET /decisions` and `GET /runs` | Return all rows ordered by id desc. | Not active FE7 feed/social UI; execution-related surfaces should stay untouched. | Unbounded but out of scope because execution/runtime behavior must not change yet. |

## FE7 Pagination Posture

Observed FE7 files:

- `super-nova-2177/frontend-social-seven/content/proposal/Proposal.jsx`
- `super-nova-2177/frontend-social-seven/app/users/[username]/page.jsx`
- `super-nova-2177/frontend-social-seven/app/messages/page.jsx`
- `super-nova-2177/frontend-social-seven/app/universe/page.jsx`
- `super-nova-2177/frontend-social-seven/content/header/Header.jsx`
- `super-nova-2177/frontend-social-seven/content/header/HeaderMobile.jsx`
- `super-nova-2177/frontend-social-seven/content/header/content/NotificationsPanel.jsx`
- `super-nova-2177/frontend-social-seven/content/header/DesktopRightRail.jsx`

Findings:

- Main proposals and user posts already use `useInfiniteQuery`, `limit=30`, and
  offset-based pagination.
- Header and notification preview fetches use small proposal/notification
  limits.
- Social graph requests are bounded with explicit limits.
- Message peer threads do not pass pagination params because the backend does
  not expose them yet.
- FE7 does not need to change in the first backend-only pagination PR if the
  backend adds optional params and keeps current defaults.

## Tables And Columns Involved

| Area | Current storage/model | Existing visible indexes | Query pressure |
| --- | --- | --- | --- |
| Proposals/posts | `Proposal` table `proposals`; key columns `id`, `created_at`, `userName`, `author_type`, `status`, `group_id`. | `id` primary/index, `group_id` index, `status` index. No visible `created_at`, `userName`, or `author_type` index in `db_models.py`. | Feed ordering, author profile posts, author-type filters, search, vote-count joins. |
| Comments | `Comment` table `comments`; key columns `id`, `proposal_id`, `parent_comment_id`, `created_at`, `author_id`. | `id`, `proposal_id`, `parent_comment_id`, and `vibenode_id` visible as indexed. No visible `created_at` index. | Proposal detail/list payloads and comment route by `proposal_id`; notification reply lookup by parent comment. |
| Votes | `ProposalVote` table `proposal_votes`; composite primary key `(proposal_id, harmonizer_id)`, plus `vote`, `voter_type`. | Composite primary key should help proposal lookups. No visible secondary index for `vote` aggregation. | Per-proposal vote serialization and vote-count filters. |
| Follows | JSON store in `backend/follows_store.json` through `_read_follows_store()`. | No DB indexes; not currently DB-backed. | Follower/following list scans matching a bounded local store. |
| Direct messages | Raw `direct_messages` table created by `_ensure_direct_messages_table()`. | Existing runtime indexes on `(conversation_id, created_at)`, `sender`, and `recipient`. | Peer thread query by conversation id; conversation summary query by lower sender/recipient and order by created_at desc. |
| Notifications | ORM `Notification` model exists, but active `/notifications` synthesizes replies/recent posts from comments/proposals. | `Notification.harmonizer_id` and `is_read` are indexed, but active route mostly uses comments/proposals. | Current route is bounded by request limit. |
| Decisions/runs | `Decision` and `Run` tables. | `Decision.proposal_id` indexed; `Run.decision_id` not visibly indexed. | Unbounded legacy/execution lists; out of scope for first feed/social scalability work. |

## Existing Pagination Behavior

| Route | Params | Default | Max | Ordering |
| --- | --- | ---: | ---: | --- |
| `/proposals` | `limit`, `offset`, `before_id`, `filter`, `search`, `author` | 80 | 200 | `id desc` default; `created_at` for latest/oldest/type filters; vote counts for vote filters. |
| `/actors/{username}/outbox` | `limit` | 40 | 100 | Reuses proposal listing helper with `before_id=None`, `offset=0`. |
| `/u/{username}/export.json` and `/api/users/{username}/portable-profile` | `limit` | 100 | 200 | Reuses proposal listing helper for public export. |
| `/social-users` | `limit`, `search` | 36 | 80 | Derived from harmonizers and recent proposal activity. |
| `/social-graph` | `limit` | 14 | 96 | Derived graph, bounded internal scans. |
| `/notifications` | `limit` | 12 | 30 | Recent replies/posts, bounded. |
| `/messages` summary | none today | hard-coded DB limit 1000 | none exposed | `created_at desc`. |
| `/messages` peer thread | none today | unbounded | none exposed | `created_at asc`. |
| `/comments` | none today | unbounded | none exposed | DB/native order; no explicit order in ORM branch. |
| `/decisions`, `/runs` | none today | unbounded | none exposed | `id desc`. |

## Unbounded Or Hidden-Fanout Risks

1. `/proposals` is bounded at the top level, but serializes all votes and all
   comments for each returned proposal. A page of 30 proposals can still produce
   a large response if older proposals have large discussion threads.
2. `/proposals/{pid}` serializes all comments and votes for one proposal.
3. `/comments` returns every comment for a proposal and has no explicit order.
4. `/messages?peer=...` returns the full conversation history.
5. `/decisions` and `/runs` are unbounded but should remain out of the first
   scalability pass because they touch execution-related surfaces.

## Smallest Safe Future Implementation

Recommended first implementation branch:

`scalability/add-read-compatible-feed-pagination-params`

Recommended scope:

- Backend-only first.
- Add optional, read-compatible params; preserve current default behavior unless
  tests and FE7 review explicitly approve new defaults.
- Do not add migrations or indexes in the same PR.
- Do not touch `supernovacore.py`, `db_models.py`, DB files, FE7 behavior,
  auth behavior, votes/comments write behavior, messages write behavior,
  federation writes, execution, domain verification, AI runtime, environment
  files, or secrets.

Candidate additive params:

| Route | Additive params | Compatibility posture |
| --- | --- | --- |
| `/comments` | `limit: Optional[int]`, `offset: int = 0`, later `before_id` if useful | If `limit` is absent, preserve current behavior. FE7 can opt in later. |
| `/messages` peer thread | `limit: Optional[int]`, `before_id` or `before_created_at` | If params are absent, preserve current behavior. FE7 can opt in later. |
| `/proposals` | `embedded_comments_limit`, `embedded_votes_limit` | If params are absent, preserve current behavior. FE7 can opt in to smaller embedded payloads later. |
| `/proposals/{pid}` | `comments_limit`, `votes_limit`, and optional comment offset/cursor | If params are absent, preserve current behavior. Detail pages can opt in later. |

Suggested later defaults after compatibility review:

- `/comments`: default `limit=100`, max `500`
- `/messages` peer thread: default `limit=100`, max `500`
- `/proposals` embedded comments/votes: FE7 passes explicit small caps first;
  server default can remain unchanged until UI behavior is reviewed.

## Index Recommendations

Index work should be a separate PR because it changes schema/DDL behavior.

Potential helpful indexes for a later migration/DDL plan:

| Table | Candidate index | Helps |
| --- | --- | --- |
| `proposals` | `(id DESC)` or rely on primary key if DB planner already handles id ordering | Default feed ordering and `before_id`. |
| `proposals` | `(created_at DESC, id DESC)` | `filter=latest`, recent notification posts, social graph scans. |
| `proposals` | `(author_type, created_at DESC, id DESC)` | `filter=ai`, `filter=company`, `filter=human`. |
| `proposals` | `(userName, id DESC)` or a normalized lowercase author key in a later schema change | Profile/user post feeds. Current `lower(userName)` filters may not benefit from a plain case-sensitive index on every DB. |
| `comments` | `(proposal_id, created_at, id)` | Comment route pagination and stable ordering. |
| `comments` | `(parent_comment_id, created_at DESC, id DESC)` | Notification reply lookup. |
| `proposal_votes` | `(proposal_id, vote)` | Per-proposal vote serialization and upvote-count aggregations. |
| `direct_messages` | `(conversation_id, created_at, id)` | Peer thread pagination. Existing `(conversation_id, created_at)` already helps; adding `id` may improve stable cursors. |
| `direct_messages` | `(sender, created_at DESC)` and `(recipient, created_at DESC)` | Conversation summaries. Current query uses `lower(sender)`/`lower(recipient)`, so a future normalized key may be cleaner than expression indexes. |

Do not add indexes to `db_models.py` or runtime helpers without deciding whether
production should use migrations, explicit `CREATE INDEX IF NOT EXISTS`, or
another controlled schema path.

## Tests Needed Before Implementation

For additive pagination params:

- Seed a temporary SQLite DB with many proposals, comments, votes, and direct
  messages.
- Assert current `/proposals` pagination still returns the same default shape.
- Assert `/comments` with no pagination preserves current behavior.
- Assert `/comments?limit=...&offset=...` returns stable ordered slices.
- Assert `/messages?user=...&peer=...` with no pagination preserves current
  behavior.
- Assert `/messages?user=...&peer=...&limit=...` returns a stable bounded
  slice and does not leak other conversations.
- Assert `/proposals?embedded_comments_limit=...` and
  `/proposals?embedded_votes_limit=...` only cap embedded arrays when the params
  are provided.
- Keep existing write-route tests unchanged; pagination must be read-only.

For indexes:

- Add schema/DDL tests against a temporary SQLite database.
- Confirm indexes can be created idempotently.
- Confirm production DB values are never printed.
- Confirm rollback instructions are documented.
- Do not run index creation against live production in tests.

## Implementation Classification

| Question | Recommendation |
| --- | --- |
| Should this PR implement anything? | No. This PR is docs-only assessment. |
| First implementation type | Backend-only first, with additive read-compatible pagination params. |
| Frontend posture | FE7-compatible additive params. Do not require FE7 changes in the first PR. |
| Default behavior | Preserve current defaults first; add stricter defaults only after tests and UI review. |
| Index posture | Requires separate schema/DDL or migration decision. Do not combine with pagination params. |
| Migration required? | Pagination params: no. Indexes: yes, or an explicit idempotent DDL helper with tests and rollback plan. |

## Rollback Plan

For this assessment PR:

- Revert the assessment commit. No runtime behavior changes are present.

For future pagination PRs:

- Revert the pagination commit.
- Re-run backend route tests, safe checks, live read-only smokes, FE7 lint/build,
  and protected `supernovacore.py` diff.
- Because future params should be additive, rollback should not require DB
  changes.

For future index PRs:

- Include explicit index-drop or no-op rollback notes before merge.
- Avoid destructive rollback by using idempotent `CREATE INDEX IF NOT EXISTS`
  or a reversible migration where possible.
- Re-run schema tests against temporary SQLite and any supported production-like
  test DB before merge.

## What Not To Touch Yet

- `super-nova-2177/backend/supernova_2177_ui_weighted/supernovacore.py`
- `super-nova-2177/backend/supernova_2177_ui_weighted/db_models.py`
- DB files
- migrations
- uploads
- active FE7 behavior
- auth behavior
- vote/comment/message write behavior
- federation writes
- execution routes
- domain verification
- AI runtime
- environment files
- secrets
- local launchers
- legacy frontend files

## Bottom Line

Top-level proposal feed pagination is already in decent shape. The first real
scalability risk is hidden fanout: embedded comments/votes in proposal payloads,
unbounded `/comments`, and unbounded peer message threads. Add read-compatible
backend pagination params first, then decide on DB indexes in a separate
schema/DDL PR.
