# Product Grants, Mentions, and Reply UI Assessment

Assessment branch: `product/assess-grants-mentions-reply-ui`

Baseline master commit: `c8b3d16`

This is a planning-only product assessment. It does not implement runtime behavior, frontend behavior, database changes, notification writes, mention parsing, homepage polish, payment flows, grant distribution, or governance execution. Security hardening, pagination, and protocol safety work remain separate tracks.

## Files Inspected

- `super-nova-2177/backend/app.py`
- `super-nova-2177/backend/supernova_2177_ui_weighted/db_models.py`
- `super-nova-2177/frontend-social-seven/content/proposal/content/ProposalCard.jsx`
- `super-nova-2177/frontend-social-seven/content/proposal/content/InsertComment.jsx`
- `super-nova-2177/frontend-social-seven/content/proposal/content/DisplayComments.jsx`
- `super-nova-2177/frontend-social-seven/content/home/HomeWrapper.jsx`
- `super-nova-2177/frontend-social-seven/content/home/HomeFeed.jsx`
- `super-nova-2177/frontend-social-seven/content/header/DesktopRightRail.jsx`
- `C:\Users\tahag\Downloads\deep-research-report (1).md`

## Grants / Nonprofit Mission Theme

SuperNova 2177 Inc. can use the platform as a public record layer for real nonprofit governance without turning v1 into an execution or finance system. The safest near-term posture is:

- Board decisions can be posted as decision proposals.
- Grant proposals can be posted as visible public records.
- Aid or program decisions can be explained, discussed, and ratified manually.
- Public governance records can preserve reasoning, votes, dissent, updates, and final board/manual ratification status.

This fits the existing v1 contract only if the platform remains manual-preview-only:

- No automatic execution.
- No payment automation.
- No custody or escrow.
- No UBI distribution.
- No legal or financial automation.
- No automatic grant disbursement.
- No company, nonprofit, or AI action without human/company ratification.

Safe future UI copy surfaces:

| Surface | Safe Meaning | Notes |
| --- | --- | --- |
| Grant proposal category | Labels a post/decision as grant-related | UI label only first; no payment semantics |
| Nonprofit decision tag | Marks board/program governance context | Should not imply legal finality by itself |
| Board/manual ratification status | Shows draft, under review, ratified, declined, or archived | Must remain manually maintained in v1 |
| Why this decision matters field | Adds plain-language public reasoning | Safe as text metadata, not execution logic |

Recommendation:

Start with docs-first and UI-label-first work. A future PR may add safe copy and labels around existing decision proposal metadata, but it should not add grant execution, automated fund flows, custody, or legal automation.

## Mentions Roadmap

Desired behavior:

- Users can type `@username` in posts, comments, and replies.
- The backend parses mentions server-side rather than trusting client-provided mention lists.
- Mentioned users receive notifications.
- Mention rendering is consistent in FE7.
- Autocomplete comes later, after the backend contract is tested.

Why backend parsing matters:

- Prevents clients from spoofing mentioned users.
- Avoids trusting hidden form fields or client-generated mention payloads.
- Lets future spam controls and notification deduplication live server-side.
- Keeps mentions compatible with auth-bound write hardening.

Risks to avoid:

- Impersonation by arbitrary usernames in unauthenticated writes.
- Mention spam or notification flooding.
- Private data leakage through notifications or profile lookups.
- Cross-surface inconsistencies between posts, comments, and replies.
- Parsing differences between FE7 and backend.

Recommended first mention implementation:

1. Add backend tests for mention parsing in comments/posts without changing runtime behavior.
2. Define allowed mention syntax and normalization.
3. Parse mentions server-side after write-auth policy is clear for comments/posts.
4. Create notification records only after the parsing and auth boundaries are pinned.
5. Render mentions in FE7 after backend output shape is stable.
6. Add autocomplete last.

Do not implement mention autocomplete first. Autocomplete is a UX layer and should wait until the server-side contract, spam posture, and notification shape are settled.

## Notifications Contract For Mentions

Existing notification surfaces:

- `GET /notifications` in `backend/app.py` returns recent post notifications and comment-reply notifications.
- The current reply notification payload includes fields like `id`, `type`, `proposal_id`, `comment_id`, `parent_comment_id`, `title`, `actor`, `body`, and `time`.
- `db_models.py` contains a `Notification` model with `harmonizer_id`, `message`, `is_read`, and `created_at`.
- `db_models.py` also contains a `comment_mentions` association table and `Comment.mentions` relationship, but mention notification behavior is not currently implemented as an active runtime contract.

Minimal future mention notification shape:

| Field | Meaning |
| --- | --- |
| `mentioned_by` | Username that authored the source text |
| `mentioned_user` | Username receiving the mention |
| `source_type` | `post`, `comment`, or `reply` |
| `source_id` | Source post/comment/reply id |
| `proposal_id` | Proposal id when relevant |
| `created_at` | Server timestamp |
| `read` or `is_read` | Read/unread state if supported |

Compatibility notes:

- Mention notifications should not expose private direct-message content.
- Mention notifications should not rely on client-submitted usernames alone.
- Mention notifications should deduplicate repeated mentions of the same user in one source item.
- Mention notifications should skip self-mentions unless product policy explicitly wants them.
- Mention notification creation should be covered by focused tests before FE7 rendering.

No notification runtime changes should happen in this PR.

## Comment Reply Composer UI Issue

Current FE7 behavior:

- `ProposalCard.jsx` keeps one `replyTarget` state for the whole proposal card.
- The single `InsertComment` composer is rendered once near the top of the comments section, before the thread list.
- `DisplayComments.jsx` sends reply intent up through `onReply({ id, user, comment })`.
- `InsertComment.jsx` receives `parentComment` and shows "Replying to ..." above the composer.

Why the reply input may feel detached:

- The reply composer is not rendered under the comment being replied to.
- Clicking reply on a lower comment changes the top composer rather than opening a local composer in the thread.
- The user can lose visual connection between target comment and input, especially in long threads.

Recommended tiny future FE7-only fix:

- Render the reply composer directly under the target comment row.
- Keep normal top-level comment composer at the top of the comments section.
- Keep focus local to the selected reply composer.
- Cancel should close only that local reply composer.
- Submission should insert or reload the reply in the expected thread position.
- No backend contract should change for this UI fix; it should keep sending `parent_comment_id`.

Suggested implementation boundary:

- Touch only FE7 comment components, likely `ProposalCard.jsx`, `DisplayComments.jsx`, and/or `InsertComment.jsx`.
- Preserve existing comment response handling and auth headers.
- Add a small manual visual verification checklist in the PR body.

## Homepage / Onboarding Clarity

Product feedback from the deep research thread says the public homepage and first impression are under-explained and can expose raw/internal status language. The current code inspection found the desktop right rail uses:

- `Live pulse`
- `Core connected`
- `Checking core`
- `Core unavailable`
- `Routes`
- `Links`

Those labels are useful for maintainers, but they can confuse newcomers when shown as first-impression product language. A visitor may not know what "core", "routes", or "links" mean, and "Core unavailable" can read like product failure even when the frontend/protocol surface is intentionally live while direct backend API routes are separate.

Safe homepage/onboarding opportunities:

- Clearer hero line explaining what SuperNova is in plain language.
- Safer public status language such as "Protocol bridge live", "Backend status checking", or "Some live systems are still being verified" instead of raw internal status.
- Clear newcomer CTA: read, join, create a profile, or explore decisions.
- Trust links for docs/about/status/privacy/contact.
- A short explanation of manual-preview-only governance.
- A public note that domain/protocol discovery is open read-only while writes require identity.

Do not implement homepage polish in this PR. Keep it after the security-hardening and pagination branches, or place it in a separate FE7-only product polish branch.

## Recommended Future PR Sequence

| Order | Future PR | Scope | Risk | Notes |
| --- | --- | --- | --- | --- |
| A | FE7-only comment reply composer placement fix | FE7 comment UI only | Low-medium | No backend changes; verify long thread and mobile/narrow viewport |
| B | Docs/copy-only grants/nonprofit wording | Docs and possibly safe labels only | Low | No grant execution, payments, custody, or legal automation |
| C | Mentions backend assessment/tests | Tests/docs first | Low | Define syntax, dedupe, auth boundary, and notification expectations |
| D | Mentions parser plus notification creation | Backend runtime, tests required | Medium | Must respect auth-bound writes and avoid spam/leakage |
| E | FE7 mention rendering | FE7 display only | Medium | Render known mention tokens after backend shape is stable |
| F | FE7 mention autocomplete | FE7 UX plus API search if needed | Medium | Later only; requires rate/spam posture |
| G | Homepage clarity polish | FE7 product copy/status language | Low-medium | Should use deep research feedback but avoid runtime/protocol changes |

Security hardening, pagination implementation, debug route hardening, comment/vote route hardening, and system-vote deadline policy must remain on their own branches.

## Compatibility And Safety Rules

- Preserve public reads and protocol discovery.
- Preserve manual-preview-only governance.
- Preserve auth-bound write hardening.
- Preserve FE7 login/session behavior.
- Do not add automatic execution, payments, custody, UBI distribution, grant disbursement, domain verification fetching, federation writes, AI runtime action, or legal/financial automation.
- Do not change runtime behavior from this assessment PR.

## Required Checks For This Docs-Only PR

- `python scripts/check_safe.py --local-only`
- `python scripts/check_safe.py`
- `python scripts/smoke_social_backend.py https://2177.tech`
- `python -m unittest super-nova-2177/backend/tests/test_auth_bound_write_routes.py`
- `python -m unittest super-nova-2177/backend/tests/test_upload_size_limits.py`
- `python -m unittest super-nova-2177/backend/tests/test_public_federation_safety.py`
- `python -m unittest super-nova-2177/backend/tests/test_secret_key_hardening.py`
- `python -m unittest super-nova-2177/backend/tests/test_db_engine_consistency.py`
- `python -m unittest super-nova-2177/backend/tests/test_db_utils_fallback.py`
- `python -m unittest super-nova-2177/backend/tests/test_read_pagination_baseline.py`
- FE7 `npm run lint`
- FE7 `npm run build`
- protected `supernovacore.py` diff zero

## Rollback Plan

Revert this docs-only PR. No runtime, frontend behavior, database, migration, dependency, upload, authentication, federation, execution, domain verification, AI runtime, environment, or secret state is changed.
