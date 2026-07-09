import { expect, test } from "@playwright/test";

const obviousRuntimeErrors = /Application error|Unhandled Runtime Error|Build Error|Failed to compile|Module not found/i;

const emptyMedia = {
  image: "",
  images: [],
  layout: "carousel",
  governance: null,
  video: "",
  link: "",
  file: "",
};

function feedPost(overrides = {}) {
  return {
    id: 2178001,
    title: "Feed overhaul fixture",
    text: "A capped feed item with server-side totals.",
    userName: "cap-human",
    userInitials: "CH",
    author_type: "human",
    time: new Date("2026-06-05T00:00:00Z").toISOString(),
    media: emptyMedia,
    comments: [],
    likes: [],
    dislikes: [],
    like_count: 0,
    dislike_count: 0,
    comment_count: 0,
    voting_closed: false,
    ...overrides,
  };
}

function fixtureComment(index, proposalId) {
  return {
    id: `${proposalId}-comment-${index}`,
    proposal_id: proposalId,
    user: `commenter-${index}`,
    user_img: "",
    species: "human",
    comment: `Fixture comment number ${index}.`,
    parent_comment_id: null,
    likes: [],
    dislikes: [],
  };
}

async function mockFeedBackend(page, posts, { singleProposals = {}, onFeedRequest = null } = {}) {
  await page.route("**/proposals?**", async (route) => {
    if (onFeedRequest) onFeedRequest(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(posts),
    });
  });

  for (const [proposalId, payload] of Object.entries(singleProposals)) {
    await page.route(`**/proposals/${proposalId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(payload),
      });
    });
  }

  await page.route("**/system-vote**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        question: "Feed overhaul system question?",
        deadline: "2099-01-01T00:00:00Z",
        likes: [],
        dislikes: [],
        user_vote: null,
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

  await page.route("**/social-graph?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ nodes: [], edges: [] }),
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

test("home feed request carries the bounded embed caps", async ({ page }) => {
  const feedUrls = [];
  await mockFeedBackend(page, [feedPost()], {
    onFeedRequest: (url) => feedUrls.push(url),
  });

  await page.goto("/");
  await expect(page.getByText("A capped feed item with server-side totals.")).toBeVisible();

  const homeFeedUrl = feedUrls.find((url) => url.includes("filter=latest") && url.includes("limit=30"));
  expect(homeFeedUrl).toBeTruthy();
  expect(homeFeedUrl).toContain("embedded_comments_limit=3");
  expect(homeFeedUrl).toContain("embedded_votes_limit=25");
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("displayed counts come from *_count fields even when embedded arrays are capped", async ({ page }) => {
  const post = feedPost({
    id: 2178002,
    text: "Counts should read 12 comments despite only 3 embedded.",
    comments: [1, 2, 3].map((index) => fixtureComment(index, 2178002)),
    likes: [
      { voter: "seed-yes-1", type: "human" },
      { voter: "seed-yes-2", type: "ai" },
    ],
    dislikes: [{ voter: "seed-no-1", type: "company" }],
    like_count: 30,
    dislike_count: 5,
    comment_count: 12,
  });
  await mockFeedBackend(page, [post]);

  await page.goto("/");
  await expect(page.getByText("Counts should read 12 comments despite only 3 embedded.")).toBeVisible();

  // The comment toggle shows the server total, not the capped preview length.
  await expect(page.locator(".post-action-bar").getByRole("button", { name: /^12$/ })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("vote breakdown modal fetches the full voter list on open", async ({ page }) => {
  const proposalId = 2178003;
  const fullLikes = Array.from({ length: 28 }, (_, index) => ({
    voter: `deep-voter-${index + 1}`,
    type: index % 3 === 0 ? "ai" : "human",
  }));
  const post = feedPost({
    id: proposalId,
    text: "Vote breakdown should list voters beyond the embedded cap.",
    likes: fullLikes.slice(0, 2),
    dislikes: [],
    like_count: 28,
    dislike_count: 0,
  });
  await mockFeedBackend(page, [post], {
    singleProposals: {
      [proposalId]: { ...post, likes: fullLikes, dislikes: [] },
    },
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Show vote breakdown" }).first().click();

  const modal = page.locator("[data-vote-modal]");
  await expect(modal).toBeVisible();
  // A voter that only exists in the full single-proposal read proves the on-open fetch.
  await expect(modal.getByText("@deep-voter-27")).toBeVisible();
  await expect(modal.getByText("28 total votes")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("composer open and typing re-render at most two feed cards", async ({ page }) => {
  const posts = Array.from({ length: 8 }, (_, index) =>
    feedPost({ id: 2178100 + index, text: `Stable memo card ${index + 1}.` })
  );
  await seedPasswordSession(page);
  await page.addInitScript(() => {
    window.__SN_DEBUG_RENDERS = true;
  });
  await mockFeedBackend(page, posts);

  await page.goto("/");
  await expect(page.getByText("Stable memo card 8.")).toBeVisible();

  const before = await page.evaluate(() => ({ ...(window.__SN_CARD_RENDERS || {}) }));
  await page.getByText("Post a signal, or ask AI...").click();
  await page.getByPlaceholder("Share your idea, update, or question").fill("memo render probe");
  await page.waitForTimeout(250);

  const after = await page.evaluate(() => ({ ...(window.__SN_CARD_RENDERS || {}) }));
  const rerenderedCards = Object.keys(after).filter((key) => (after[key] || 0) > (before[key] || 0));
  expect(rerenderedCards.length).toBeLessThanOrEqual(2);
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("opening comments loads the full thread past the embedded preview", async ({ page }) => {
  const proposalId = 2178004;
  const fullComments = Array.from({ length: 12 }, (_, index) => fixtureComment(index + 1, proposalId));
  const post = feedPost({
    id: proposalId,
    text: "Opening comments should load the remaining nine.",
    comments: fullComments.slice(0, 3),
    comment_count: 12,
  });
  await mockFeedBackend(page, [post], {
    singleProposals: {
      [proposalId]: { ...post, comments: fullComments },
    },
  });

  await page.goto("/");
  await page.locator(".post-action-bar").getByRole("button", { name: /^12$/ }).click();

  await expect(page.getByText("Fixture comment number 12.")).toBeVisible();
  await expect(page.getByText("Fixture comment number 1.")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});
