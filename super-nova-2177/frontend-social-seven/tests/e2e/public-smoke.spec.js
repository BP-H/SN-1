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
      like_count: 0,
      dislike_count: 0,
      comment_count: 0,
      voting_closed: false,
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

  await page.route(/.*\/uploads\/smoke-image(?:-\d+)?\.png(?:\?.*)?$/, async (route) => {
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
          { id: "smoke-human", username: "smoke-human", display_name: "Smoke Human", species: "human", avatar_url: "/uploads/smoke-image.png" },
          { id: "smoke-ai", username: "smoke-ai", display_name: "Smoke AI", species: "ai" },
          { id: "smoke-org", username: "smoke-org", display_name: "Smoke ORG", species: "company" },
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
      body: JSON.stringify(options.notifications || []),
    });
  });

  await page.route("**/supernova-menu**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        orgs: [{ name: "Smoke ORG", posts: 2 }],
        agents: [{ name: "Smoke Delegate" }],
        status: { metrics: { total_vibenodes: 3, community_wellspring: 8 } },
        network: { node_count: 3 },
        capabilities: [
          { key: "public_read", label: "Public read-only connector", available: true },
        ],
      }),
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

function smokeDelegate(overrides = {}) {
  const delegate = {
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
  return { ...delegate, ...overrides };
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

  await expect(page.getByRole("link", { name: "smoke-human" })).toBeVisible();
  await expect(
    page.getByText("A public signed-out feed item rendered from a mocked local backend response.")
  ).toBeVisible();

  // Compact clarity explainer for first-time visitors.
  await expect(
    page.getByRole("heading", {
      name: "A nonprofit network for visible human, AI, and organization participation.",
    })
  ).toBeVisible();

  // The quiet disclosure reveals concrete custody guarantees on demand.
  const detailPoint = page.getByText(/explicitly approves them/i);
  const disclosure = page.getByRole("button", { name: "How it works" });
  await expect(detailPoint).toBeHidden();
  await disclosure.click();
  await expect(detailPoint).toBeVisible();
  await expect(page.getByText(/never execute actions automatically/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /About the nonprofit/i })).toBeVisible();
  await disclosure.click();
  await expect(detailPoint).toBeHidden();

  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("vote breakdown modal filters voter names by species and answer", async ({ page }) => {
  await mockPublicBackend(page, [
    {
      id: 2177002,
      title: "Vote breakdown smoke proposal",
      text: "A public vote modal item with visible voter detail.",
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
      likes: [
        { voter: "human-yes", type: "human" },
        { voter: "nova-ai", type: "ai" },
      ],
      dislikes: [
        { voter: "org-no", type: "company" },
      ],
      like_count: 2,
      dislike_count: 1,
      comment_count: 0,
      voting_closed: false,
    },
  ]);
  await page.goto("/");

  await page.getByRole("button", { name: "Show vote breakdown" }).first().click();
  const modal = page.locator("[data-vote-modal]");
  await expect(modal).toBeVisible();
  await expect(modal.getByText("@human-yes")).toBeVisible();
  await expect(modal.getByText("@nova-ai")).toBeVisible();
  await expect(modal.getByText("@org-no")).toBeVisible();

  await modal.getByRole("button", { name: /^AI$/ }).click();
  await modal.getByRole("button", { name: /^Yes$/ }).click();
  await expect(modal.getByText("@nova-ai")).toBeVisible();
  await expect(modal.getByText("@human-yes")).toHaveCount(0);
  await expect(modal.getByText("@org-no")).toHaveCount(0);

  await modal.getByRole("button", { name: "Close vote breakdown" }).click();
  await expect(modal).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("system decision breakdown shares the polished vote popup shell", async ({ page }) => {
  await mockPublicBackend(page);
  await page.goto("/");

  await page.getByRole("button", { name: "Show species vote breakdown" }).click();
  const modal = page.locator("[data-vote-modal]");
  await expect(modal).toBeVisible();
  await expect(modal.getByText("Vote breakdown")).toBeVisible();

  await modal.getByRole("button", { name: "Close vote breakdown" }).click();
  await expect(modal).toHaveCount(0);

  await page.getByRole("button", { name: "Show species vote breakdown" }).click();
  await expect(modal).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);

  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("home mission hero is disabled by default for release", async ({ page }) => {
  await mockPublicBackend(page);
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto("/");

  await expect(page.locator(".home-mission-hero")).toHaveCount(0);
  await expect(page.getByText("System Decision")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("light post options menu keeps items flat until hover", async ({ page }) => {
  await mockPublicBackend(page);
  await page.addInitScript(() => {
    window.localStorage.setItem("supernova-theme", "light");
  });
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const smokeCard = page
    .locator("[data-proposal-card]")
    .filter({ hasText: "A public signed-out feed item rendered from a mocked local backend response." })
    .first();
  await expect(smokeCard).toBeVisible();
  await smokeCard.scrollIntoViewIfNeeded();
  await smokeCard.getByRole("button", { name: "Post options" }).click();

  const menu = page.locator(".proposal-options-menu").first();
  await expect(menu).toBeVisible();
  const saveItem = menu.getByRole("button", { name: /^save$/i });
  await expect(saveItem).toBeVisible();

  const restingBackground = await saveItem.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(restingBackground).toBe("rgba(0, 0, 0, 0)");
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("account create events open create mode directly", async ({ page }) => {
  await mockPublicBackend(page);
  await page.goto("/");

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("supernova:open-account", { detail: { mode: "create" } }));
  });

  const accountPanel = page.locator(".profile-auth-card");
  await expect(accountPanel.getByRole("button", { name: "Create account" })).toBeVisible();
  await expect(accountPanel.getByPlaceholder("Email")).toBeVisible();
  await expect(accountPanel.getByRole("button", { name: "Human" })).toBeVisible();
  await expect(accountPanel.getByRole("button", { name: "ORG" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("signed-out protected sections open sign-in before signup", async ({ page }) => {
  await mockPublicBackend(page);
  await page.goto("/messages");

  await page.locator(".messages-shell").getByRole("button", { name: "Sign in" }).click();

  const accountPanel = page.locator(".profile-auth-card");
  await expect(accountPanel.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(accountPanel.getByPlaceholder("Password")).toBeVisible();
  await expect(accountPanel.getByPlaceholder("Email")).toHaveCount(0);
  await expect(accountPanel).toContainText("Don't have an account?");
  await expect(accountPanel.getByRole("button", { name: "Create account" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("forgot password flow stays honest when email delivery is not configured", async ({ page }) => {
  await mockPublicBackend(page);
  await page.route("**/auth/password-reset/request", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        email_configured: false,
        message: "Password reset email delivery is not configured yet.",
      }),
    });
  });
  await page.goto("/");

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("supernova:open-account", { detail: { mode: "login" } }));
  });

  const accountPanel = page.locator(".profile-auth-card");
  await accountPanel.getByRole("button", { name: "Forgot password?" }).click();
  await accountPanel.getByPlaceholder("Email or username").fill("reset-user@example.test");
  await accountPanel.getByRole("button", { name: "Send reset link" }).click();

  await expect(accountPanel).toContainText("Password reset email is not configured yet.");
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("password reset link page can set a new password", async ({ page }) => {
  await mockPublicBackend(page);
  await page.route("**/auth/password-reset/confirm", async (route) => {
    const payload = route.request().postDataJSON();
    expect(payload).toMatchObject({ code: "smoke-reset-code", password: "new-secret" });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, message: "Password updated. You can sign in now." }),
    });
  });

  await page.goto("/reset-password?code=smoke-reset-code");
  await page.getByPlaceholder("New password", { exact: true }).fill("new-secret");
  await page.getByPlaceholder("Confirm new password").fill("new-secret");
  await page.getByRole("button", { name: "Save new password" }).click();

  await expect(page.getByText("Password updated. You can sign in now.")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("mobile profile nav opens own public profile when signed in", async ({ page }) => {
  await seedPasswordSession(page);
  await mockPublicBackend(page);
  await page.route("**/profile/e2e-human", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        username: "e2e-human",
        display_name: "e2e-human",
        species: "human",
        avatar_url: "",
        bio: "E2E human profile.",
      }),
    });
  });
  await page.route("**/social-users?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });
  await page.route("**/proposal-collabs?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ collabs: [] }),
    });
  });
  await page.route("**/follows/status?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ following: false }),
    });
  });

  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto("/");
  await page.locator("[data-mobile-nav]").getByRole("button", { name: "Profile" }).click();

  await expect(page).toHaveURL(/\/users\/e2e-human$/);
  await expect(page.getByRole("heading", { name: "e2e-human" })).toBeVisible();
  await expect(page.getByRole("main").getByText("e2e-human").first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("collapsed composer stays aligned on narrow mobile", async ({ page }) => {
  await mockPublicBackend(page);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");

  const metrics = await page.locator(".composer-collapsed-bar").first().evaluate((bar) => {
    const prompt = bar.querySelector(".composer-collapsed-prompt").getBoundingClientRect();
    const actions = [...bar.querySelectorAll(".composer-collapsed-action, .composer-collapsed-send")]
      .map((element) => element.getBoundingClientRect());
    return {
      promptWidth: prompt.width,
      promptHeight: prompt.height,
      actionWidths: actions.map((rect) => rect.width),
      sameRow: actions.every((rect) => Math.abs(rect.top - prompt.top) < 5),
    };
  });

  expect(metrics.promptWidth).toBeGreaterThan(80);
  expect(metrics.promptHeight).toBeLessThanOrEqual(42);
  expect(metrics.actionWidths.every((width) => width >= 30 && width <= 38)).toBeTruthy();
  expect(metrics.sameRow).toBeTruthy();
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("home hierarchy keeps social content in the first fold", async ({ page }) => {
  const imagePost = {
    id: 2177099,
    title: "Visible participation smoke signal",
    text: "Real social content remains the visual priority.",
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
    like_count: 0,
    dislike_count: 0,
    comment_count: 0,
    voting_closed: false,
  };

  await mockPublicBackend(page, [imagePost]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const explanation = page.locator(".home-quick-explain");
  await expect(explanation).toContainText(
    "A nonprofit network for visible human, AI, and organization participation."
  );
  await expect(explanation).toContainText(/Human\s*×\s*AI\s*×\s*ORG/);
  expect((await explanation.boundingBox())?.height).toBeLessThanOrEqual(96);

  const disclosure = explanation.getByRole("button", { name: "How it works" });
  await expect(disclosure).toHaveAttribute("aria-expanded", "false");
  await disclosure.click();
  await expect(disclosure).toHaveAttribute("aria-expanded", "true");
  await expect(explanation.getByText(/explicitly approves them/i)).toBeVisible();
  await expect(explanation.getByText(/never execute actions automatically/i)).toBeVisible();
  await disclosure.click();
  await expect(disclosure).toHaveAttribute("aria-expanded", "false");
  await expect(explanation.getByText(/explicitly approves them/i)).toBeHidden();

  const postCard = page.locator("[data-proposal-card]").first();
  const media = postCard.locator('img[src*="smoke-image.png"]').first();
  await expect(postCard.getByText("Real social content remains the visual priority.")).toBeVisible();
  await expect(media).toHaveAttribute("alt", "Visible participation smoke signal");
  await expect(media).toBeVisible();
  expect(await media.evaluate((element) => element.getBoundingClientRect().top)).toBeLessThan(844);

  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.locator(".desktop-right-rail")).toBeVisible();
  const desktopExplanationGeometry = await explanation.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const styles = getComputedStyle(element);
    const childHeight = (selector) =>
      element.querySelector(selector)?.getBoundingClientRect().height || 0;
    return {
      height: rect.height,
      paddingBlock: `${styles.paddingTop} ${styles.paddingBottom}`,
      summary: childHeight(".home-quick-explain-summary"),
      title: childHeight(".home-quick-explain-title"),
      chips: childHeight(".home-quick-explain-chips"),
      actions: childHeight(".home-quick-explain-actions"),
      details: childHeight(".home-quick-explain-details"),
    };
  });
  expect(
    desktopExplanationGeometry.height,
    JSON.stringify(desktopExplanationGeometry)
  ).toBeLessThanOrEqual(76);
  expect(await media.evaluate((element) => element.getBoundingClientRect().top)).toBeLessThan(720);

  const metricBackgrounds = await page.locator(".desktop-metric-grid > div").evaluateAll((nodes) =>
    nodes.map((node) => getComputedStyle(node).backgroundColor)
  );
  expect(metricBackgrounds.every((value) => value === "rgba(0, 0, 0, 0)")).toBeTruthy();

  await page.evaluate(() => document.documentElement.setAttribute("dir", "rtl"));
  const overflow = await page.evaluate(() => ({
    body: document.body.scrollWidth - document.body.clientWidth,
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  expect(overflow.body).toBeLessThanOrEqual(1);
  expect(overflow.document).toBeLessThanOrEqual(1);
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("empty signed-out feed shows the first-user create cue", async ({ page }) => {
  await mockPublicBackend(page, []);
  await page.goto("/");

  await expect(page.getByText("No posts yet.")).toBeVisible();
  await expect(
    page.getByText("Start the commons with a post, signal, image, or AI delegate draft.")
  ).toBeVisible();
  await expect(page.getByRole("main").getByRole("button", { name: "Create post" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("supernova menu exposes account and theme controls safely", async ({ page }) => {
  await seedPasswordSession(page, { reseedOnReload: false });
  await mockPublicBackend(page);
  await page.addInitScript(() => {
    window.localStorage.setItem("supernova-theme", "light");
  });
  await page.goto("/");

  await page.getByRole("button", { name: "Open SuperNova menu" }).click();
  const menu = page.locator(".supernova-menu-drawer");
  await expect(menu.getByText("Account")).toBeVisible();
  await expect(menu.getByRole("button", { name: /View my profile/ })).toBeVisible();
  await expect(menu.getByRole("button", { name: /Profile settings/ })).toBeVisible();
  await expect(menu.getByRole("button", { name: /Sign out/ })).toBeVisible();

  await menu.getByRole("button", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await menu.getByRole("button", { name: /Sign out/ }).click();
  await expect
    .poll(() => page.evaluate(() => window.sessionStorage.getItem("supernova_password_session")))
    .toBeNull();

  await page.getByRole("button", { name: "Open SuperNova menu" }).click();
  await expect(page.locator(".supernova-menu-drawer").getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.locator(".supernova-menu-drawer").getByRole("button", { name: "Create account" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("supernova menu saves language preference and localizes shell labels", async ({ page }) => {
  await mockPublicBackend(page);
  await page.goto("/");

  await page.getByRole("button", { name: "Open SuperNova menu" }).click();
  const menu = page.locator(".supernova-menu-drawer");
  const languageToggle = menu.getByRole("button", { name: /Language/ });
  await expect(languageToggle).toBeVisible();
  await expect(languageToggle).toHaveAttribute("aria-expanded", "false");
  await expect(menu.getByRole("button", { name: "한국어" })).toHaveCount(0);

  await languageToggle.click();
  await expect(languageToggle).toHaveAttribute("aria-expanded", "true");
  await expect(menu.getByRole("button", { name: "한국어" })).toBeVisible();
  await expect(menu.getByRole("button", { name: "中文" })).toBeVisible();
  await expect(menu.getByRole("button", { name: "हिन्दी" })).toBeVisible();
  await expect(menu.getByRole("button", { name: "العربية" })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Português" })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Français" })).toBeVisible();

  await menu.getByRole("button", { name: "Español" }).click();

  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(menu.getByText("Cuenta", { exact: true })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Inicio" })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Crear cuenta" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("supernova-locale-preference")))
    .toBe("es");
  await expect
    .poll(() => page.evaluate(() => document.cookie.includes("supernova_locale=es")))
    .toBeTruthy();
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("malformed locale cookie falls back without breaking the shell", async ({ page }) => {
  await mockPublicBackend(page);
  await page.addInitScript(() => {
    document.cookie = "supernova_locale=%E0%A4%A; Path=/";
  });

  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("button", { name: "Open SuperNova menu" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("about page route renders the standalone page", async ({ page }) => {
  await page.goto("/about");

  await expect(page).toHaveTitle(/SuperNova 2177/i);
  await expect(page.locator("body")).toContainText(/Human/i);
  await expect(page.locator("body")).toContainText(/Organization/i);
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("about page reads as a quiet, non-fundraising briefing", async ({ page }) => {
  await page.goto("/about");

  // Explainer + FAQ content is present.
  await expect(page.locator("body")).toContainText(/What is SuperNova 2177\?/i);
  await expect(page.locator("body")).toContainText(/How is it different from Instagram, X, or Facebook\?/i);
  await expect(page.locator("body")).toContainText(/Is this a fundraising page\?/i);

  // Legal disclaimer is present.
  await expect(page.locator("body")).toContainText(/does not offer tokens, crypto products/i);
  await expect(page.locator("body")).toContainText(/AI-assisted drafts do not publish automatically/i);

  // Nonprofit status and the public-interest programs are shown honestly.
  await expect(page.locator("body")).toContainText(/501\(c\)\(3\)/i);
  await expect(page.locator("body")).toContainText(/Fashion for Dignity/i);

  // The loud fundraising CTA stays off the quiet QR page.
  await expect(page.locator("body")).not.toContainText(/Support the Mission/i);
});

test("not found route renders the branded release state in dark mode", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("supernova-theme", "dark");
  });

  await page.goto("/release-smoke-missing-page");

  await expect(page.getByRole("heading", { name: "This signal is not here." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Constellation" })).toBeVisible();
  await expect(page.locator(".release-state-card")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("universe page route renders a mocked public graph", async ({ page }) => {
  await mockPublicBackend(page);
  await page.goto("/universe");

  await expect(page.getByRole("heading", { name: "Live Universe" })).toBeVisible();
  await expect(page.getByText("Fork this universe")).toBeVisible();
  await expect(page.getByRole("link", { name: "For AI readers" })).toBeVisible();
  const stage = page.locator(".desktop-constellation-stage").first();
  await expect(stage).toBeVisible();
  const beforeMove = await stage.boundingBox();
  expect(beforeMove).not.toBeNull();
  await page.mouse.move(beforeMove.x + beforeMove.width * 0.25, beforeMove.y + beforeMove.height * 0.35);
  await page.mouse.move(beforeMove.x + beforeMove.width * 0.72, beforeMove.y + beforeMove.height * 0.62);
  await page.waitForTimeout(250);
  const afterMove = await stage.boundingBox();
  expect(afterMove).not.toBeNull();
  expect(Math.abs(afterMove.height - beforeMove.height)).toBeLessThan(2);
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

test("for-ai page follows Spanish language preference", async ({ page }) => {
  await mockPublicBackend(page);
  await page.addInitScript(() => {
    window.localStorage.setItem("supernova-locale-preference", "es");
  });

  await page.goto("/for-ai");

  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByRole("heading", { name: "Para lectores de IA" })).toBeVisible();
  await expect(page.getByText("Lectura pública")).toBeVisible();
  await expect(page.getByText("Sin voto, publicación ni ejecución autónoma.")).toBeVisible();
  await expect(page.locator("code").filter({ hasText: "Digest público" })).toContainText("/connector/public-digest");
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("for-ai page follows Korean language preference", async ({ page }) => {
  await mockPublicBackend(page);
  await page.addInitScript(() => {
    window.localStorage.setItem("supernova-locale-preference", "ko");
  });

  await page.goto("/for-ai");

  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await expect(page.getByRole("heading", { name: "AI 독자를 위해" })).toBeVisible();
  await expect(page.getByText("공개 읽기 전용")).toBeVisible();
  await expect(page.getByText("자율 투표, 게시, 실행은 없습니다.")).toBeVisible();
  await expect(page.locator("code").filter({ hasText: "공개 다이제스트" })).toContainText("/connector/public-digest");
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("for-ai page follows Arabic preference with rtl document direction", async ({ page }) => {
  await mockPublicBackend(page);
  await page.addInitScript(() => {
    window.localStorage.setItem("supernova-locale-preference", "ar");
  });

  await page.goto("/for-ai");

  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: "لقراء AI" })).toBeVisible();
  await expect(page.getByText("قراءة عامة فقط")).toBeVisible();
  await expect(page.getByText("لا يوجد تصويت أو نشر أو تنفيذ ذاتي.")).toBeVisible();
  await expect(page.locator("code").filter({ hasText: "ملخص عام" })).toContainText("/connector/public-digest");
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
      like_count: 0,
      dislike_count: 0,
      comment_count: 0,
      voting_closed: false,
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

test("media gallery lightbox arrows advance without closing", async ({ page }) => {
  await mockPublicBackend(page, [
    {
      id: 2177002,
      title: "Gallery smoke signal",
      text: "A multi-image signal keeps the desktop lightbox controls stable.",
      userName: "smoke-human",
      userInitials: "SH",
      author_type: "human",
      time: new Date("2026-05-05T00:00:00Z").toISOString(),
      media: {
        image: "",
        images: ["/uploads/smoke-image.png", "/uploads/smoke-image-2.png", "/uploads/smoke-image-3.png"],
        layout: "grid",
        governance: null,
        video: "",
        link: "",
        file: "",
      },
      comments: [],
      likes: [],
      dislikes: [],
      like_count: 0,
      dislike_count: 0,
      comment_count: 0,
      voting_closed: false,
    },
  ]);

  await page.goto("/");
  await page.getByRole("button", { name: "Open image 1" }).click();

  await expect(page.getByRole("button", { name: "Close image" })).toBeVisible();
  await expect(page.getByText("1/3")).toBeVisible();
  await page.getByRole("button", { name: "Next image" }).last().click();
  await expect(page.getByText("2/3")).toBeVisible();
  await page.getByRole("button", { name: "Previous image" }).last().click();
  await expect(page.getByText("1/3")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("composer shows posting progress while create request is pending", async ({ page }) => {
  await seedPasswordSession(page);
  await mockPublicBackend(page);

  let releasePost;
  const releasePostPromise = new Promise((resolve) => {
    releasePost = resolve;
  });
  await page.route("**/proposals", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await releasePostPromise;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: 2177999,
        title: "Progress smoke post",
        text: "Progress smoke post body",
        userName: "e2e-human",
        userInitials: "EH",
        author_type: "human",
        time: new Date("2026-05-13T00:00:00Z").toISOString(),
        media: { image: "", images: [], layout: "carousel", governance: null, video: "", link: "", file: "" },
        comments: [],
        likes: [],
        dislikes: [],
        like_count: 0,
        dislike_count: 0,
        comment_count: 0,
        voting_closed: false,
      }),
    });
  });

  await page.goto("/");
  await page.getByText("Post a signal, or ask AI...").click();
  await page.getByPlaceholder("Share your idea, update, or question").fill("Progress smoke post body");
  await page.locator('button[aria-label="Post"]').last().click();

  await expect(page.getByText(/Posting|Uploading and posting|Starting post/)).toBeVisible();
  await expect(page.getByText(/keep this tab open/i)).toBeVisible();
  const progress = page.locator(".composer-publish-progress");
  await expect(progress).toBeVisible();
  await expect
    .poll(async () => Number(await progress.getAttribute("data-progress-percent")), { timeout: 5000 })
    .toBeGreaterThan(52);

  releasePost();

  await expect(page.locator(".composer-publish-progress")).toHaveCount(0);
  await expect(page.getByText("Post a signal, or ask AI...")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("unified media picker accepts video without a separate video button", async ({ page }) => {
  await seedPasswordSession(page);
  await mockPublicBackend(page);

  await page.goto("/");

  await expect(page.getByRole("button", { name: "Add media" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add video" })).toHaveCount(0);

  await page.getByText("Post a signal, or ask AI...").click();
  await page.locator("#mediaInput").setInputFiles({
    name: "smoke-video.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("mock video bytes"),
  });

  await expect(page.locator("video").first()).toBeVisible();

  await page.locator("#mediaInput").setInputFiles([
    { name: "one.mp4", mimeType: "video/mp4", buffer: Buffer.from("one") },
    { name: "two.mp4", mimeType: "video/mp4", buffer: Buffer.from("two") },
  ]);
  await expect(page.getByText("Choose one video for this signal.")).toBeVisible();

  await page.locator("#mediaInput").setInputFiles({
    name: "smoke-image.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });

  await expect(page.getByText("Choose one video for this post.")).toHaveCount(0);
  await expect(page.getByAltText("Preview 1")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("composer image preview can add and remove individual images", async ({ page }) => {
  await seedPasswordSession(page);
  await mockPublicBackend(page);

  await page.goto("/");
  await page.getByText("Post a signal, or ask AI...").click();
  await page.locator("#mediaInput").setInputFiles([
    { name: "first.png", mimeType: "image/png", buffer: tinyPng },
    { name: "second.png", mimeType: "image/png", buffer: tinyPng },
  ]);

  await expect(page.getByRole("button", { name: /Remove image/ })).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Add more images" })).toBeVisible();

  await page.getByRole("button", { name: "Add more images" }).click();
  await page.locator('input[accept="image/*"]').setInputFiles({
    name: "third.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });

  await expect(page.getByRole("button", { name: /Remove image/ })).toHaveCount(3);
  await page.getByRole("button", { name: "Remove image 2" }).click();
  await expect(page.getByRole("button", { name: /Remove image/ })).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Show image 2" })).toBeVisible();
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

test("notification badge clears after opening activity panel", async ({ page }) => {
  await seedPasswordSession(page);
  await mockPublicBackend(page, undefined, {
    notifications: [
      {
        id: "notice-1",
        type: "mention",
        actor: "smoke-human",
        title: "Smoke mention signal",
        body: "Smoke Human mentioned you.",
        time: new Date("2026-05-13T00:00:00Z").toISOString(),
      },
    ],
  });

  await page.goto("/");

  const notificationButton = page.getByRole("button", { name: "Notifications" });
  await expect(notificationButton.locator("span").filter({ hasText: "1" })).toBeVisible();

  await notificationButton.click();
  await expect(page.getByText("Recent Activity")).toBeVisible();
  await expect(page.getByText("Smoke mention signal")).toBeVisible();
  await expect(notificationButton.locator("span").filter({ hasText: "1" })).toHaveCount(0);

  await notificationButton.click();
  await notificationButton.click();
  await expect(notificationButton.locator("span").filter({ hasText: "1" })).toHaveCount(0);
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

test("public AI profile falls back from generic delegate name to handle", async ({ page }) => {
  await mockPublicBackend(page);
  await page.route("**/ai-actors/nova-abc123", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        actor: {
          id: 177,
          username: "nova-abc123",
          display_name: "SuperNova AI delegate",
          ai_name: "SuperNova AI delegate",
          ai_actor_type: "principal_delegate",
          active: true,
          custody_label: "Delegate of @e2e-human",
          model_identity: "supernova-protocol-charter-v1",
          persona_summary: "Nova reviews public proposals through the locked charter.",
          legal_status: "custodied_delegate_v1",
          custody_status: "custodied",
          autonomy_preferences: { reviews: "custodian_approval_required" },
        },
      }),
    });
  });

  await page.goto("/ai/nova-abc123");

  await expect(page.getByRole("heading", { name: "@nova-abc123" })).toBeVisible();
  await expect(page.getByText("Delegate of @e2e-human")).toBeVisible();
  await expect(page.getByRole("heading", { name: "SuperNova AI delegate" })).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("AI delegate picker prefers generated handles over generic labels and keeps custom names", async ({ page }) => {
  await seedPasswordSession(page);
  await mockPublicBackend(page);
  await mockAiDelegates(page, [
    smokeDelegate({
      id: 177,
      username: "nova-abc123",
      display_name: "SuperNova AI delegate",
      custody_label: "Delegate of @e2e-human",
    }),
    smokeDelegate({
      id: 178,
      username: "nova-ethics",
      display_name: "Nova Ethics Reviewer",
      custody_label: "Delegate of @e2e-human",
    }),
  ]);
  await mockAiActionQueue(page, []);

  await page.goto("/");
  await expect(page.locator(".proposal-author-inline-name").filter({ hasText: "smoke-human" }).first()).toBeVisible();
  await page.locator(".post-action-bar").last().getByRole("button", { name: /^0$/ }).click();
  await page.getByRole("button", { name: "Generate AI comment" }).click();

  const pickerButton = page.locator(".ai-delegate-picker-button");
  await expect(pickerButton).toContainText("@nova-abc123");
  await expect(pickerButton).not.toContainText("SuperNova AI delegate");

  await pickerButton.click();
  await page.getByRole("option", { name: /Nova Ethics Reviewer/ }).click();
  await expect(pickerButton).toContainText("Nova Ethics Reviewer");
  await expect(pickerButton).toContainText("@nova-ethics");
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("AI Genesis settings list falls back from generic delegate names to handles", async ({ page }) => {
  await seedPasswordSession(page);
  await mockPublicBackend(page);
  await mockAiDelegates(page, [
    smokeDelegate({
      id: 177,
      username: "nova-abc123",
      display_name: "SuperNova AI delegate",
      custody_label: "Delegate of @e2e-human",
    }),
    smokeDelegate({
      id: 178,
      username: "nova-ethics",
      display_name: "Nova Ethics Reviewer",
      custody_label: "Delegate of @e2e-human",
    }),
  ]);

  await page.goto("/settings/ai-delegates");
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));

  await expect(page.getByRole("heading", { name: "AI Genesis" })).toBeVisible();
  await expect(page.locator(".ai-genesis-surface")).toBeVisible();
  await expect(page.locator(".ai-genesis-panel").first()).toBeVisible();
  await expect(page.locator(".ai-delegate-scroll-area").first()).toBeVisible();
  await expect(page.locator(".ai-delegate-scroll-area").first()).toHaveCSS("overscroll-behavior-y", "contain");
  await expect(page.locator(".ai-genesis-panel").first()).toHaveCSS("background-color", "rgba(245, 248, 253, 0.96)");
  await expect(page.getByRole("link", { name: "@nova-abc123" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Nova Ethics Reviewer" })).toBeVisible();
  await expect(page.getByRole("link", { name: "SuperNova AI delegate" })).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("assistant settings checks logged-in delegates without generic server AI calls", async ({ page }) => {
  let genericAiCalls = 0;
  await seedPasswordSession(page);
  await mockPublicBackend(page);
  await mockAiDelegates(page, [smokeDelegate()]);
  await page.route("**/api/ai", async (route) => {
    genericAiCalls += 1;
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error_code: "unexpected_generic_ai_call" }),
    });
  });

  await page.goto("/");
  await expect(page.locator(".proposal-author-inline-name").filter({ hasText: "smoke-human" }).first()).toBeVisible();
  await page.locator('[aria-label="SuperNova AI cursor"]').click({ force: true });

  await expect(page.getByRole("button", { name: "Check my AI delegates" })).toBeVisible();
  await expect(page.getByText("Generic server-key replies are disabled here")).toBeVisible();
  await page.getByRole("button", { name: "Check my AI delegates" }).click();

  await expect(page.getByText("1 AI delegate ready for approval-required drafts.")).toBeVisible();
  await expect.poll(() => genericAiCalls).toBe(0);
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("newly created AI delegate remains selected after delegate refresh", async ({ page }) => {
  let createRequests = 0;
  const existingDelegate = smokeDelegate({
    id: 177,
    username: "e2e-human-smoke",
    display_name: "Smoke Delegate",
  });
  const createdDelegate = smokeDelegate({
    id: 178,
    username: "nova-abc123",
    display_name: "SuperNova AI delegate",
    custody_label: "Delegate of @e2e-human",
  });

  await seedPasswordSession(page);
  await mockPublicBackend(page);
  await mockAiActionQueue(page, []);

  await page.route("**/ai/delegates/persona-draft", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        persona: {
          ai_name: "Nova",
          username: "nova-abc123",
          display_name: "SuperNova AI delegate",
          traits: ["AI Safety"],
          persona_summary: "Nova reviews public proposals through the locked charter.",
          public_description: "Nova reviews public proposals through the locked charter.",
          persona_hash: "persona-hash-nova",
          generation_source: "deterministic_fallback_no_key",
        },
      }),
    });
  });

  await page.route("**/ai/delegates", async (route) => {
    if (route.request().method() === "POST") {
      createRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, delegate: createdDelegate }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        delegates: [existingDelegate],
        count: 1,
      }),
    });
  });

  await page.goto("/");
  await expect(page.locator(".proposal-author-inline-name").filter({ hasText: "smoke-human" }).first()).toBeVisible();
  await page.locator(".post-action-bar").last().getByRole("button", { name: /^0$/ }).click();
  await page.getByRole("button", { name: "Generate AI comment" }).click();
  await expect(page.locator(".ai-delegate-picker-button")).toContainText("Smoke Delegate");

  await page.getByRole("button", { name: "Create another AI delegate" }).click();
  const createCard = page.locator(".ai-delegate-create-card");
  await createCard.locator("input").first().fill("Nova");
  await createCard.getByRole("button", { name: "AI Safety" }).click();
  await page.getByRole("button", { name: /Generate persona/ }).click();
  await expect(page.getByText("Nova reviews public proposals through the locked charter.")).toBeVisible();
  await page.getByRole("button", { name: "Approve and create AI delegate" }).click();

  await expect.poll(() => createRequests).toBe(1);
  const pickerButton = page.locator(".ai-delegate-picker-button");
  await expect(pickerButton).toContainText("@nova-abc123");
  await expect(pickerButton).not.toContainText("SuperNova AI delegate");
  await expect(page.getByText("@nova-abc123 is ready.")).toBeVisible();
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
          id: "executed-comment-action",
          status: "executed",
          action_type: "draft_ai_comment",
          target_type: "proposal_ai_comment",
          target_id: "2177001",
        },
        summary: {
          action: "duplicate_ai_comment",
          proposal_id: 2177001,
          ai_actor_id: 177,
          existing_action_id: "executed-comment-action",
          duplicate_reason: "executed",
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
  await expect(page.locator(".proposal-author-inline-name").filter({ hasText: "smoke-human" }).first()).toBeVisible();
  await page.locator(".post-action-bar").last().getByRole("button", { name: /^0$/ }).click();
  await page.getByRole("button", { name: "Generate AI comment" }).click();
  await expect(page.getByText("AI comment")).toBeVisible();

  await page.getByRole("button", { name: /^Comment$/ }).click();

  await expect.poll(() => draftRequests).toBe(1);
  await expect(page.locator(".ai-delegate-notice").filter({ hasText: /already posted a standalone AI-authored comment/i })).toBeVisible();
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
