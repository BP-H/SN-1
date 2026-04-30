# Alpha Release Go/No-Go Checklist

Use this checklist before an alpha release, production promotion, or public demo.
Keep the pass practical and observational. SuperNova is nonprofit
public-interest infrastructure; this checklist must not introduce payment,
token, equity, crypto, or automatic value-distribution expectations.

Each checklist box is the pass marker. Mark it only when the expected behavior
passes; leave it unchecked and record a follow-up issue/PR note when it fails.

## Account / Session

- [ ] **Create account**
  - Expected: a new user can create an account and land in the active FE7 app.
  - Quick test: sign up with a test username, species, and avatar if available.
- [ ] **Sign in**
  - Expected: existing user can sign in and account-bound UI appears.
  - Quick test: sign in, reload, and confirm profile/account state persists.
- [ ] **Sign out**
  - Expected: sign-out clears account-bound state without hiding public reads.
  - Quick test: sign out, reload, and confirm public feed/profile pages still load.
- [ ] **Expired session UX**
  - Expected: stale/invalid tokens show friendly session prompts, not raw backend errors.
  - Quick test: simulate stale token, then open Profile -> Collabs and Messages.

## Posting / Media

- [ ] **Create text post**
  - Expected: signed-in user can create a text-only post.
  - Quick test: publish a short post and confirm it appears in feed/profile.
- [ ] **Create media post**
  - Expected: accepted media uploads attach to the post and render without overflow.
  - Quick test: post a small supported image and inspect feed/profile/mobile.
- [ ] **Edit/delete own post**
  - Expected: author can edit/delete own post; wrong user cannot.
  - Quick test: edit then delete a test post from the author account.

## Voting / System Vote

- [ ] **Vote and unvote proposal**
  - Expected: signed-in user can vote and remove their vote; public reads remain public.
  - Quick test: vote on a post, refresh, then unvote.
- [ ] **Weighted support display**
  - Expected: feed and profile support percentages match the weighted species logic.
  - Quick test: compare the same post in feed and profile.
- [ ] **System vote write auth**
  - Expected: signed-in user can cast/remove; missing or wrong token is rejected.
  - Quick test: cast/remove as the matching account.

## Comments

- [ ] **Create comment**
  - Expected: signed-in user can comment on a public post.
  - Quick test: add a comment with normal text and an existing mention.
- [ ] **Edit/delete own comment**
  - Expected: author can edit/delete; wrong user cannot.
  - Quick test: edit then delete the test comment.
- [ ] **Mention safety**
  - Expected: existing mentions link; unknown `@names`, emails, and URL path segments stay safe.
  - Quick test: compare `@existing`, `@fake`, `a@b.com`, and a URL containing `@`.

## Follows

- [ ] **Follow/unfollow**
  - Expected: signed-in user can follow and unfollow another account.
  - Quick test: follow a test account, reload, then unfollow.
- [ ] **Follow auth guardrail**
  - Expected: wrong-user or missing bearer writes fail cleanly.
  - Quick test: confirm UI does not show raw backend auth errors.

## Messages

- [ ] **Conversation list**
  - Expected: signed-in user sees conversations or a clean empty state.
  - Quick test: open Messages after sign-in.
- [ ] **Send/read message**
  - Expected: message sends to another user and appears in the thread.
  - Quick test: send a short message to a test account.
- [ ] **Message auth UX**
  - Expected: stale session shows a friendly session prompt.
  - Quick test: simulate invalid token and open Messages.

## Collabs

- [ ] **Invite collaborator from composer**
  - Expected: selecting an existing mention can add a pending collab chip before posting.
  - Quick test: select `@existinguser`, confirm invite, publish post.
- [ ] **Review incoming collab**
  - Expected: receiver sees the request in Profile -> Collabs and can approve/decline.
  - Quick test: open `/users/<receiver>?tab=collabs`.
- [ ] **Cancel/remove collab**
  - Expected: author/collaborator can remove allowed pending/approved rows.
  - Quick test: remove a test request from the Collabs tab.
- [ ] **Approved collab visibility**
  - Expected: approved collab appears on both profiles and in the matching normal tab.
  - Quick test: verify Visuals, Decisions, or Posts plus the Collabs tab.
- [ ] **Delete post with collab**
  - Expected: author can delete own post with pending or approved collab rows.
  - Quick test: delete a test collab post as the author.

## Profile Tabs / Contribution Record

- [ ] **Tab deep links**
  - Expected: `/users/<username>` defaults to All; `?tab=all`, `?tab=visuals`,
    `?tab=decisions`, `?tab=posts`, and `?tab=collabs` open safely; invalid
    tabs fall back to All.
  - Quick test: open the default profile URL, each tab query URL, and one
    invalid tab query directly.
- [ ] **Tab badges**
  - Expected: five icon-only tabs show readable selected state and non-cluttering badges.
  - Quick test: inspect light, dark, and mobile widths.
- [ ] **Contribution record wording**
  - Expected: copy uses public contribution-record language only.
  - Quick test: confirm there is no payment, reward, token, equity, or guarantee language.

## Public Signed-Out Reads

- [ ] **Feed**
  - Expected: signed-out users can read public feed content.
  - Quick test: sign out, reload the home feed.
- [ ] **Profile**
  - Expected: signed-out users can read public profile content and approved collabs only.
  - Quick test: open another user's profile while signed out.
- [ ] **Proposal detail**
  - Expected: signed-out users can read proposal detail and public comments.
  - Quick test: open a direct proposal URL while signed out.

## MCP Connector

- [ ] **Browser health**
  - Expected: health returns JSON and upstream connector check is good.
  - Quick test: open `https://sn-1-anls.vercel.app/health`.
- [ ] **Upstream connector check**
  - Expected: health shows `upstream_connector_check.status=200` and
    `upstream_connector_check.json=true`.
  - Quick test: inspect the health JSON before connecting ChatGPT.
- [ ] **Connector URL**
  - Expected: ChatGPT/Codex uses `https://sn-1-anls.vercel.app/mcp`.
  - Quick test: paste `/mcp` into an MCP-capable client; browser `GET /mcp`
    may say the endpoint expects POST requests.
- [ ] **Backend API origin**
  - Expected: if tools list but calls fail, `SUPERNOVA_API_BASE_URL` points to
    the backend JSON API origin, not the frontend domain.
  - Quick test: confirm `<SUPERNOVA_API_BASE_URL>/connector/supernova` returns JSON.

## Mobile / Light / Dark Smoke

- [ ] **Home mobile**
  - Expected: header, feed, composer, and bottom navigation do not overlap.
  - Quick test: inspect a mobile-width viewport.
- [ ] **Profile mobile**
  - Expected: profile header, tabs, collab cards, and badges fit without overflow.
  - Quick test: inspect own profile and another profile on mobile width.
- [ ] **Light theme**
  - Expected: standard accents are solid SuperNova pink and surfaces are readable.
  - Quick test: scan feed, profile, messages, collabs, and composer.
- [ ] **Dark theme**
  - Expected: dark surfaces remain readable and no selected state turns muddy or gradient-like.
  - Quick test: scan the same surfaces in dark theme.

## Safety Guardrails

- [ ] **No protected core diff**
  - Expected: protected core remains untouched.
  - Quick test: run `git diff --exit-code HEAD -- super-nova-2177/backend/supernova_2177_ui_weighted/supernovacore.py`.
- [ ] **No private data expansion**
  - Expected: pending collabs, notifications, messages, and private account state stay auth-bound.
  - Quick test: inspect signed-out and other-user profile views.
- [ ] **No write execution expansion**
  - Expected: MCP remains read-only and no new connector write execution is added.
  - Quick test: confirm MCP exposes no write tools beyond public read-only tools.
- [ ] **No financial promise language**
  - Expected: docs/UI describe recognition and contribution records without payment guarantees.
  - Quick test: search touched docs/UI for risky words and keep only guardrail uses.
