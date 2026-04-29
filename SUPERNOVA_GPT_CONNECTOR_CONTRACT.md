# SuperNova GPT Connector Contract

Branch: `product/assess-supernova-gpt-connector-contract`

Title: `[codex] Assess SuperNova GPT connector contract`

Current master commit inspected: `48d46a4`

Mode: docs-only product and safety contract. This PR does not change runtime
code, MCP/server implementation, backend routes, FE7 behavior, database
schemas, migrations, auth/session logic, connector secrets, OAuth/token
storage, external app access, packages, lockfiles, environment files, secrets,
or protected core files.

## Important Framing

This is not a Gmail, GitHub, or third-party external integration PR. This is a
contract for SuperNova itself to expose a future ChatGPT/GPT connector surface:
similar in spirit to a GitHub connector, but for SuperNova context, user-owned
actions, governance signals, mentions, notifications, and approved collab
decisions.

The first implementation should be read-only. Any future write tool must be
approval-required, user-scoped, audit-friendly, and backed by the same hardened
backend auth rules already used by FE7.

## Product Goal

A future ChatGPT-compatible connector should allow a user to connect SuperNova
as a source and tool surface. Depending on permissions, ChatGPT/GPT could read:

- public profiles;
- proposals and posts;
- comments and replies;
- mention notifications;
- collab requests;
- governance decision context;
- public protocol docs;
- the authenticated user's own vote state, notifications, and account context.

Later, the connector may help the user prepare and approve actions such as
voting, commenting, posting, requesting collabs, or approving and declining
collabs. It must never perform silent or autonomous writes.

## Capability Tiers

| Tier | Capability | Safety Boundary |
| --- | --- | --- |
| A. Public read-only connector | Read public profiles, public proposals/posts, public comments, public vote summaries or decision metadata, and public protocol docs. | No auth required; no private user state; no writes. |
| B. Signed-in private read connector | Read the authenticated user's notifications, mentions, collab requests, own profile/account state if allowed, and saved/following context if allowed. | Requires user-scoped auth; least privilege; no writes. |
| C. Draft/proposal tools | Draft a comment, proposal/post, vote intent, collab request, collab approval/decline, or proposal summary. | Drafts and recommendations only; user must explicitly approve before execution. |
| D. Approval-required write tools | Cast/remove/change vote, post comment, create proposal/post, request collab, approve/decline/remove collab, or update profile. | Requires explicit confirmation for every action, user identity binding, and audit records. |

## Proposed Connector Resources

Future connector resources should be named and scoped clearly:

| Resource | Scope |
| --- | --- |
| `profile` | Public profile details and optionally signed-in private account state. |
| `proposal/post` | Proposal/post title, text, media metadata, governance context, author, and public route. |
| `comment/reply` | Public comment and reply text, author, source proposal, and timestamps. |
| `vote summary` | Public aggregate support/opposition or decision metadata. |
| `user_vote_state` | Authenticated user's own vote state for a proposal. |
| `mention_notification` | Authenticated user's mention notifications. |
| `collab_request` | Authenticated user's pending, approved, declined, or removed collab requests. |
| `governance_decision_metadata` | Manual-preview governance status, ratification metadata, and decision summaries. |
| `public_protocol_docs` | Public protocol schemas, examples, and safety guarantees. |

Private resources must never be exposed through public unauthenticated connector
mode. Public resources must not leak pending collab requests, private messages,
secrets, environment values, tokens, or backend filesystem details.

## Proposed Connector Tool Names

These names are contract names only. This PR does not implement tools, MCP
servers, endpoints, OAuth, or token storage.

Read tools:

- `search_profiles`
- `get_profile`
- `search_proposals`
- `get_proposal`
- `get_comments`
- `get_notifications`
- `get_collab_requests`
- `get_my_vote`

Draft tools:

- `draft_vote`
- `draft_comment`
- `draft_proposal`
- `draft_collab_request`

Approval tools:

- `approve_vote_action`
- `approve_comment_action`
- `approve_proposal_action`
- `approve_collab_request_action`
- `approve_collab_decision_action`

Draft tools should return previewable action payloads and warnings, not execute
the action. Approval tools must require the authenticated user to confirm the
exact action being executed.

## Voting Safety

The connector may help with voting only under the authenticated user's identity.
It must:

- never invent a voter username;
- never vote without explicit user confirmation;
- preserve existing backend auth-bound vote rules;
- show the proposal, vote choice, and consequences before confirmation;
- distinguish draft vote intent from approved vote execution;
- audit both action proposal and action approval;
- support cancellation before execution;
- support vote removal or change only after a fresh explicit confirmation;
- avoid voting from background jobs, summaries, or autonomous agent loops.

The connector should not bypass FE7 or backend auth hardening. It should call
the same hardened backend write surface or an equally strict future connector
write surface.

## Write And Action Safety

Default posture:

- read-only by default;
- least privilege scopes;
- no hidden writes;
- no background voting;
- no automatic posting;
- no autonomous collab approvals;
- no payment, grant, legal, custody, or value distribution execution;
- no governance/core execution;
- no company or AI authority expansion;
- no silent profile changes;
- no private-message mention or notification writes unless separately assessed.

Every external write must require human confirmation. Every proposed and
approved action should have an audit record containing at minimum:

- authenticated user id;
- action type;
- source connector/client id if applicable;
- draft payload hash or canonical action summary;
- approval timestamp;
- execution result;
- rollback/cancellation status where applicable.

The connector must provide a clear revocation path. If future connector work can
affect protected protocol semantics, governance guarantees, execution, value
sharing, domain verification, exports, species behavior, weighted/equal species
behavior, or AI/company authority, that work must follow
`CORE_CHANGE_PROTOCOL.md` before implementation.

## Auth Model Options

Future implementation may choose one or more auth modes:

| Mode | Purpose | Constraints |
| --- | --- | --- |
| Public unauthenticated read mode | Public search and public proposal/profile context. | No private state and no writes. |
| User-scoped signed mode | Private reads and action drafting for the signed-in user. | Must bind every action to the authenticated user. |
| Service/connector token mode | Future server-to-server connector registration. | Least privilege, rotation, revocation, and never committed secrets. |
| Short-lived action approval tokens | Optional confirmation layer for write execution. | Must be narrow, time-limited, single-purpose, and auditable. |

Connector secrets, OAuth credentials, service tokens, action approval tokens,
and environment values must never be committed or printed in tests, logs, docs,
or PR bodies.

## Approval-Required Write Tool Contract

Future write tools should follow a two-step pattern:

1. Draft the action:
   - validate readable context;
   - return a human-readable action summary;
   - include the exact target, actor, payload, and consequences;
   - do not write.
2. Approve the action:
   - require authenticated user confirmation;
   - revalidate identity, permissions, and target state;
   - execute one bounded action;
   - persist an audit record;
   - return the result and rollback guidance when possible.

Approval must not be implied by the user asking for advice, summary, ranking, or
recommendation. Drafting is not consent to execute.

## Recommended Implementation Sequence

1. Docs contract only.
2. Read-only public connector prototype.
3. Authenticated read-only connector.
4. Action proposal model and audit storage.
5. Approval-required vote tool.
6. Approval-required comment and proposal/post tools.
7. Approval-required collab request and collab decision tools.
8. FE7 connector settings/status UI.
9. Audit log UI.

Do not combine first write tools with broad connector auth, collab route
implementation, FE7 profile-grid changes, or protected core changes.

## Relationship To Current Roadmap

This connector contract:

- does not block collab routes;
- does not replace FE7;
- does not replace backend auth hardening;
- does not replace public protocol docs;
- does not implement Gmail, GitHub, or other external integrations;
- is a parallel connector/product surface for SuperNova context and actions;
- must reuse existing hardened backend auth rules for all write tools;
- must keep `supernovacore.py` protected unless a future PR follows
  `CORE_CHANGE_PROTOCOL.md`.

Collab request/approval work can proceed independently. Connector write tools
should wait until the underlying backend route is hardened, tested, and
documented.

## Required Future Tests

Read-only connector tests:

- public unauthenticated reads expose only public profile/proposal/comment
  context;
- private notification and collab-request reads require user-scoped auth;
- public protocol docs are read-only and do not expose secrets;
- pending collab requests are not exposed through public resources.

Action drafting tests:

- draft vote/comment/proposal/collab tools do not write;
- drafts include actor, target, payload, and consequences;
- drafts reject unknown or unauthorized targets safely.

Approval action tests:

- missing/invalid auth fails;
- wrong-user auth fails;
- matching user auth succeeds only after explicit approval;
- repeated approval is idempotent or rejected with a clear status;
- cancellation before approval does not write;
- audit records are created for proposed and approved actions;
- existing FE7 and backend route auth tests still pass.

## Rollback Plan

This docs-only PR can be rolled back with a single revert of:

- `SUPERNOVA_GPT_CONNECTOR_CONTRACT.md`;
- the CODEOWNERS entry for this contract;
- the changelog line.

Future runtime connector PRs must include their own rollback plans, including
how to disable connector write scopes, revoke connector credentials, and keep
public SuperNova reads available.
