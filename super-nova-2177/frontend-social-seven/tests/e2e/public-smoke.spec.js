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
  ]
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
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });
}

async function seedPasswordSession(page) {
  await page.addInitScript(() => {
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
  });
}

async function mockAiActionQueue(page) {
  await page.route("**/connector/actions?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        actions: [
          {
            id: "draft-review-smoke",
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
          },
        ],
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
  await mockAiActionQueue(page);

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
  await expect(page.getByRole("button", { name: /^Approve$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Cancel$/ })).toBeVisible();
  await expect(page.locator('[title="Cancel prevents publication."]')).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/autonomous publishing/i);
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});
