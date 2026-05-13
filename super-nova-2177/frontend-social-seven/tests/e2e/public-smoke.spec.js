import { expect, test } from "@playwright/test";

const obviousRuntimeErrors = /Application error|Unhandled Runtime Error|Build Error|Failed to compile|Module not found/i;
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l6x2GQAAAABJRU5ErkJggg==",
  "base64"
);

async function mockPublicBackend(
  page,
  posts = [
    {
      id: 2177001,
      title: "Smoke proposal from Playwright",
      text: "A public signed-out feed item rendered from a mocked local backend response.",
      userName: "smoke-human",
      userInitials: "SH",
      author_type: "human",
      time: new Date("2026-05-05T00:00:00Z").toISOString(),
      media: {
        image: "",
        images: [],
        layout: "carousel",
        governance: null,
        video: "",
        link: "",
        file: "",
      },
      comments: [],
      likes: [],
      dislikes: [],
    },
  ],
  options = {}
) {
  await page.route("**/proposals?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(posts),
    });
  });

  await page.route("**/uploads/smoke-image.png", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: tinyPng,
    });
  });

  await page.route("**/system-vote**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        question: "Should SuperNova keep public smoke tests advisory?",
        deadline: "2099-01-01T00:00:00Z",
        likes: [],
        dislikes: [],
        user_vote: null,
      }),
    });
  });

  await page.route("**/social-graph?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        nodes: [
          { username: "smoke-human", display_name: "Smoke Human", species: "human" },
          { username: "smoke-ai", display_name: "Smoke AI", species: "ai" },
          { username: "smoke-org", display_name: "Smoke ORG", species: "company" },
        ],
        edges: [{ source: "smoke-human", target: "smoke-ai" }],
      }),
    });
  });

  await page.route("**/notifications?**", async (route) => {
    if (options.notificationsDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.notificationsDelayMs));
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });
}

async function seedPasswordSession(page, { reseedOnReload = true } = {}) {
  await page.addInitScript(({ reseedOnReload: shouldReseed }) => {
    if (!shouldReseed && window.localStorage.getItem("supernova_e2e_password_seed_used") === "1") {
      return;
    }
    window.localStorage.setItem("supernova_e2e_password_seed_used", "1");
    window.sessionStorage.setItem(
      "supernova_password_session",
      JSON.stringify({
        token: "e2e-local-token",
        id: "e2e-user",
        username: "e2e-human",
        email: "e2e@example.test",
        species: "human",
      })
    );
  }, { reseedOnReload });
}

function aiReviewAction(id = "draft-review-smoke") {
  return {
    id,
    action_type: "draft_ai_review",
    status: "draft",
    target_type: "proposal",
    target_id: 2177001,
    created_at: "2026-05-05T00:00:00Z",
    draft_payload: {
      proposal_id: 2177001,
      proposal_title: "Smoke proposal from Playwright",
      intended_choice: "support",
      rationale: "The delegate supports this smoke proposal after chartered review.",
      ai_actor_display_name: "Smoke Delegate",
      custody_label: "delegate of @e2e-human",
      autonomy_preferences: { reviews: "custodian_approval_required" },
      model_identity: "supernova-protocol-charter-v1",
      generation_source: "deterministic_fallback_no_key",
      content_hash: "content-hash-smoke",
      reasoning_hash: "reasoning-hash-smoke",
      confidence: 0.82,
    },
  };
}

function aiCommentAction() {
  return {
    id: "draft-comment-smoke",
    action_type: "draft_ai_comment",
    status: "draft",
    target_type: "proposal",
    target_id: 2177001,
    created_at: "2026-05-05T00:00:00Z",
    draft_payload: {
      proposal_id: 2177001,
      proposal_title: "Smoke proposal from Playwright",
      generated_comment: "Smoke Delegate offers a concise public comment.",
      ai_actor_display_name: "Smoke Delegate",
      custody_label: "delegate of @e2e-human",
      autonomy_preferences: { posts: "custodian_approval_required" },
      model_identity: "supernova-protocol-charter-v1",
      generation_source: "deterministic_fallback_no_key",
      content_hash: "content-hash-comment",
      confidence: 0.77,
    },
  };
}

function aiPostAction() {
  return {
    id: "draft-post-smoke",
    action_type: "draft_ai_post",
    status: "draft",
    target_type: "proposal",
    target_id: 2177001,
    created_at: "2026-05-05T00:00:00Z",
    draft_payload: {
      generated_title: "AI-authored smoke draft",
      generated_post_body: "Smoke Delegate proposes one labeled public post.",
      ai_actor_display_name: "Smoke Delegate",
      custody_label: "delegate of @e2e-human",
      autonomy_preferences: { posts: "custodian_approval_required" },
      model_identity: "supernova-protocol-charter-v1",
      generation_source: "deterministic_fallback_no_key",
      content_hash: "content-hash-post",
      confidence: 0.74,
    },
  };
}

function smokeDelegate() {
  return {
    id: 177,
    username: "e2e-human-smoke",
    display_name: "Smoke Delegate",
    active: true,
    custody_label: "Delegate of @e2e-human",
    persona_traits: ["AI Safety", "Governance"],
    model_identity: "supernova-protocol-charter-v1",
    provider_connection: {
      text: {
        provider_label: "supernova",
        model_label: "supernova-protocol-charter-v1",
      },
    },
  };
}

async function mockAiActionQueue(page, actions = [aiReviewAction()]) {
  await page.route("**/connector/actions?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        actions,
      }),
    });
  });

  await page.route("**/proposal-collabs?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ collabs: [] }),
    });
  });
}

async function mockAiDelegates(page, delegates = [smokeDelegate()]) {
  await page.route("**/ai/delegates", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        delegates,
        count: delegates.length,
      }),
    });
  });
}

async function mockAiReviewEndpoints(page, actionId) {
  const calls = { approve: 0, cancel: 0 };

  await page.route(`**/connector/actions/${actionId}/approve-ai-review`, async (route) => {
    calls.approve += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        summary: {
          proposal_id: 2177001,
          actor: "Smoke Delegate",
          vote: {
            proposal_id: 2177001,
            voter: "Smoke Delegate",
            voter_type: "ai",
            normalized_vote: "support",
          },
          comment: {
            id: "comment-smoke-ai-review",
            proposal_id: 2177001,
            userName: "Smoke Delegate",
            author_type: "ai",
            body: "The delegate supports this smoke proposal after chartered review.",
          },
        },
      }),
    });
  });

  await page.route(`**/connector/actions/${actionId}/cancel`, async (route) => {
    calls.cancel += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "canceled" }),
    });
  });

  return calls;
}

test("signed-out home feed renders without obvious runtime errors", async ({ page }) => {
  await mockPublicBackend(page);
  await page.goto("/");

  await expect(page.getByText("smoke-human")).toBeVisible();
  await expect(
    page.getByText("A public signed-out feed item rendered from a mocked local backend response.")
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("empty signed-out feed shows the first-user create cue", async ({ page }) => {
  await mockPublicBackend(page, []);
  await page.goto("/");

  await expect(page.getByText("No posts yet.")).toBeVisible();
  await expect(
    page.getByText("Start the commons with a post, proposal, image, or AI delegate draft.")
  ).toBeVisible();
  await expect(page.getByRole("main").getByRole("button", { name: "Create post" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("about page route renders the standalone page", async ({ page }) => {
  await page.goto("/about");

  await expect(page).toHaveTitle(/SuperNova 2177/i);
  await expect(page.locator("body")).toContainText(/Human/i);
  await expect(page.locator("body")).toContainText(/Organization/i);
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("universe page route renders a mocked public graph", async ({ page }) => {
  await mockPublicBackend(page);
  await page.goto("/universe");

  await expect(page.getByRole("heading", { name: "Live Universe" })).toBeVisible();
  await expect(page.getByText("Fork this universe")).toBeVisible();
  await expect(page.getByRole("link", { name: "For AI readers" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("for-ai page explains public read-only connector boundaries", async ({ page }) => {
  await mockPublicBackend(page);
  await page.goto("/for-ai");

  await expect(page.getByRole("heading", { name: "For AI readers" })).toBeVisible();
  await expect(page.getByText("Public read-only")).toBeVisible();
  await expect(page.getByText("approval-required drafts")).toBeVisible();
  await expect(page.getByText("No autonomous voting, posting, or execution.")).toBeVisible();
  await expect(page.locator("code").filter({ hasText: "Connector discovery" })).toContainText("/connector/supernova");
  await expect(page.locator("code").filter({ hasText: "Connector spec" })).toContainText("/connector/supernova/spec");
  await expect(page.locator("code").filter({ hasText: "Public digest" })).toContainText("/connector/public-digest");
  await expect(page.locator("body")).not.toContainText(/payment|token|equity|payout|compensation|reward promise|financial return/i);
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("mocked image post keeps media after reload", async ({ page }) => {
  await mockPublicBackend(page, [
    {
      id: 2177002,
      title: "Image refresh smoke",
      text: "The mocked upload image should still render after the feed reloads.",
      userName: "smoke-human",
      userInitials: "SH",
      author_type: "human",
      time: new Date("2026-05-05T00:00:00Z").toISOString(),
      media: {
        image: "/uploads/smoke-image.png",
        images: [],
        layout: "carousel",
        governance: null,
        video: "",
        link: "",
        file: "",
      },
      comments: [],
      likes: [],
      dislikes: [],
    },
  ]);

  await page.goto("/");

  await expect(page.getByText("The mocked upload image should still render after the feed reloads.")).toBeVisible();
  await expect(page.locator('img[src*="/uploads/smoke-image.png"]').first()).toBeVisible();

  await page.reload();

  await expect(page.getByText("The mocked upload image should still render after the feed reloads.")).toBeVisible();
  await expect(page.locator('img[src*="/uploads/smoke-image.png"]').first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("password sign-out returns to public state after one click", async ({ page }) => {
  await seedPasswordSession(page, { reseedOnReload: false });
  await mockPublicBackend(page, undefined, { notificationsDelayMs: 350 });

  await page.goto("/profile");

  await expect(page.getByRole("main").getByText("e2e-human")).toBeVisible();
  await expect(page.getByText("Password account")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();

  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByText("Tap to sign in or create an account.")).toBeVisible();
  await expect(page.getByText("e2e-human")).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => window.sessionStorage.getItem("supernova_password_session")))
    .toBeNull();

  await page.waitForTimeout(450);

  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByText("e2e-human")).toHaveCount(0);

  await page.reload();

  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByText("Tap to sign in or create an account.")).toBeVisible();
  await expect(page.getByText("e2e-human")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("AI Genesis renders without offering standalone AI account signup", async ({ page }) => {
  await mockPublicBackend(page);
  await page.goto("/settings/ai-delegates");

  await expect(page.getByRole("heading", { name: "AI Genesis" })).toBeVisible();
  await expect(page.getByText("Sign in to charter AI delegates.")).toBeVisible();
  await expect(page.getByText("Custody is accountability, not ownership.")).toBeVisible();

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("supernova:open-account", { detail: { mode: "create" } }));
  });

  const accountPanel = page.locator(".profile-auth-card");
  await accountPanel.getByRole("button", { name: "Create account" }).click();
  await expect(accountPanel.getByRole("button", { name: "Human" })).toBeVisible();
  await expect(accountPanel.getByRole("button", { name: "ORG" })).toBeVisible();
  await expect(accountPanel.getByRole("button", { name: /^AI$/ })).toHaveCount(0);
  await expect(accountPanel).toContainText("AI delegates are created after signup through AI Genesis.");
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("AI Actions queue exposes manual approve and cancel semantics", async ({ page }) => {
  await seedPasswordSession(page);
  await mockPublicBackend(page);
  await mockAiActionQueue(page, [aiReviewAction(), aiCommentAction(), aiPostAction()]);

  await page.goto("/");
  await expect(page.getByText("smoke-human")).toBeVisible();
  await page.locator('[aria-label="SuperNova AI cursor"]').waitFor();

  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent("supernova:ai-actions-refresh", {
        detail: { notice: "Smoke AI Actions opened." },
      })
    );
  });

  await expect(page.getByText("Pending approval-required actions")).toBeVisible();
  await expect(page.getByText("Approval publishes exactly one AI vote and one rationale comment.")).toBeVisible();
  await expect(page.getByText("Approval publishes exactly one AI-authored comment.")).toBeVisible();
  await expect(page.getByText("Approval publishes exactly one AI-authored post.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Approve$/ })).toHaveCount(3);
  await expect(page.getByRole("button", { name: /^Cancel$/ })).toHaveCount(3);
  await expect(page.locator('[title="Cancel prevents publication."]')).toHaveCount(3);
  await expect(page.locator("body")).not.toContainText(/autonomous publishing/i);
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("duplicate AI comment draft request shows one existing action notice", async ({ page }) => {
  let draftRequests = 0;
  const existingCommentAction = aiCommentAction();
  await seedPasswordSession(page);
  await mockPublicBackend(page);
  await mockAiDelegates(page);
  await mockAiActionQueue(page, [existingCommentAction]);
  await page.route("**/connector/actions/draft-ai-delegate-comment", async (route) => {
    draftRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        mode: "duplicate_guard",
        executed: false,
        duplicate: true,
        action_proposal: {
          id: existingCommentAction.id,
          status: "draft",
          action_type: "draft_ai_comment",
          target_type: "proposal_ai_comment",
          target_id: "2177001",
        },
        summary: {
          action: "duplicate_ai_comment",
          proposal_id: 2177001,
          ai_actor_id: 177,
          existing_action_id: existingCommentAction.id,
          message:
            "This AI delegate already has a pending comment draft for this proposal. Review or cancel the existing draft in AI Actions.",
        },
        safety: {
          duplicate_guard: true,
          no_execution: true,
          no_write_action_performed: true,
        },
      }),
    });
  });

  await page.goto("/");
  await expect(page.getByText("smoke-human")).toBeVisible();
  await page.locator(".post-action-bar").last().getByRole("button", { name: /^0$/ }).click();
  await page.getByRole("button", { name: "Generate AI comment" }).click();
  await expect(page.getByText("AI comment")).toBeVisible();

  await page.getByRole("button", { name: /^Comment$/ }).click();

  await expect.poll(() => draftRequests).toBe(1);
  await expect(page.locator(".ai-delegate-notice").filter({ hasText: /reopened here for approve\/cancel/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Comment ready" })).toBeVisible();
  await expect(page.getByText("Smoke Delegate offers a concise public comment.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve AI draft" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel AI draft. Nothing will be published." })).toBeVisible();
  await expect(page.getByText("Pending approval-required actions")).toHaveCount(0);
  await expect(page.locator(".ai-action-card").filter({ hasText: "AI comment draft" })).toHaveCount(0);
  await expect(page.getByText("Comment ready. Approve or cancel here.")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("published duplicate AI comment request says already posted", async ({ page }) => {
  let draftRequests = 0;
  await seedPasswordSession(page);
  await mockPublicBackend(page);
  await mockAiDelegates(page);
  await mockAiActionQueue(page, []);
  await page.route("**/connector/actions/draft-ai-delegate-comment", async (route) => {
    draftRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        mode: "duplicate_guard",
        executed: false,
        duplicate: true,
        action_proposal: {
          id: null,
          status: "published",
          action_type: "draft_ai_comment",
          target_type: "proposal_ai_comment",
          target_id: "2177001",
        },
        summary: {
          action: "duplicate_ai_comment",
          proposal_id: 2177001,
          ai_actor_id: 177,
          existing_comment_id: 90210,
          duplicate_reason: "published",
          message: "This AI delegate already has an AI-authored comment for this proposal.",
        },
        safety: {
          duplicate_guard: true,
          no_execution: true,
          no_write_action_performed: true,
        },
      }),
    });
  });

  await page.goto("/");
  await expect(page.getByText("smoke-human")).toBeVisible();
  await page.locator(".post-action-bar").last().getByRole("button", { name: /^0$/ }).click();
  await page.getByRole("button", { name: "Generate AI comment" }).click();
  await expect(page.getByText("AI comment")).toBeVisible();

  await page.getByRole("button", { name: /^Comment$/ }).click();

  await expect.poll(() => draftRequests).toBe(1);
  await expect(page.locator(".ai-delegate-notice").filter({ hasText: /already posted an AI-authored comment/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Comment ready" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Approve AI draft" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cancel AI draft. Nothing will be published." })).toHaveCount(0);
  await expect(page.locator(".ai-delegate-notice")).not.toContainText(/pending draft|pending review|reopened here/i);
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("AI Actions approval waits for an explicit click and publishes one labeled review", async ({ page }) => {
  const action = aiReviewAction("approve-review-smoke");
  const calls = await mockAiReviewEndpoints(page, action.id);
  await seedPasswordSession(page);
  await mockPublicBackend(page);
  await mockAiActionQueue(page, [action]);

  await page.goto("/");
  await expect(page.getByText("smoke-human")).toBeVisible();
  await page.locator('[aria-label="SuperNova AI cursor"]').waitFor();

  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent("supernova:ai-actions-refresh", {
        detail: { notice: "Smoke AI Actions opened." },
      })
    );
  });

  const reviewCard = page.locator(".ai-action-card").filter({ hasText: "AI review draft" });
  await expect(reviewCard).toContainText("Smoke Delegate");
  await expect(reviewCard).toContainText("Approval publishes exactly one AI vote and one rationale comment.");
  expect(calls.approve).toBe(0);
  expect(calls.cancel).toBe(0);

  await reviewCard.getByRole("button", { name: /^Approve$/ }).click();

  await expect.poll(() => calls.approve).toBe(1);
  expect(calls.cancel).toBe(0);
  await expect(page.getByText("Published as Smoke Delegate.")).toBeVisible();
  await expect(reviewCard).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("AI Actions cancel prevents publication without approval", async ({ page }) => {
  const action = aiReviewAction("cancel-review-smoke");
  const calls = await mockAiReviewEndpoints(page, action.id);
  await seedPasswordSession(page);
  await mockPublicBackend(page);
  await mockAiActionQueue(page, [action]);

  await page.goto("/");
  await expect(page.getByText("smoke-human")).toBeVisible();
  await page.locator('[aria-label="SuperNova AI cursor"]').waitFor();

  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent("supernova:ai-actions-refresh", {
        detail: { notice: "Smoke AI Actions opened." },
      })
    );
  });

  const reviewCard = page.locator(".ai-action-card").filter({ hasText: "AI review draft" });
  await expect(reviewCard.getByRole("button", { name: /^Cancel$/ })).toBeVisible();
  expect(calls.approve).toBe(0);
  expect(calls.cancel).toBe(0);

  await reviewCard.getByRole("button", { name: /^Cancel$/ }).click();

  await expect.poll(() => calls.cancel).toBe(1);
  expect(calls.approve).toBe(0);
  await expect(page.getByText("Canceled - nothing published.")).toBeVisible();
  await expect(reviewCard).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});
