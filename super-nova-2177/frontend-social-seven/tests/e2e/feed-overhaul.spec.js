import { expect, test } from "@playwright/test";
import {
  normalizePublicRouteSegment,
  publicProfilePath,
} from "../../utils/publicRouteSegments.js";
import { profileMetadataForUsername } from "../../app/users/[username]/layout.js";

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

test("Unicode public profile segments preserve identity and encode only at URL construction", () => {
  const cases = [
    ["태하", "/users/%ED%83%9C%ED%95%98"],
    ["Güngör", "/users/G%C3%BCng%C3%B6r"],
    ["José", "/users/Jos%C3%A9"],
    ["Open Science DAO", "/users/Open%20Science%20DAO"],
  ];
  for (const [username, expectedPath] of cases) {
    expect(normalizePublicRouteSegment(username)).toBe(username);
    expect(publicProfilePath(username)).toBe(expectedPath);
  }
  expect(normalizePublicRouteSegment(" @태/하?x#y\\z\0 ")).toBe("태하xyz");
  expect(normalizePublicRouteSegment("태하")).not.toBe(normalizePublicRouteSegment("타하"));
  const metadata = profileMetadataForUsername("태하");
  expect(metadata.title).toBe("@태하 profile");
  expect(metadata.alternates.canonical).toBe("/users/%ED%83%9C%ED%95%98");
});

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

async function mockFeedBackend(
  page,
  posts,
  { singleProposals = {}, commentsByProposal = {}, onFeedRequest = null } = {}
) {
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

  await page.route("**/comments?**", async (route) => {
    const url = new URL(route.request().url());
    const proposalId = url.searchParams.get("proposal_id");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(commentsByProposal[proposalId] || []),
    });
  });

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

async function seedPasswordSession(page, { species = "human" } = {}) {
  await page.addInitScript((sessionSpecies) => {
    window.sessionStorage.setItem(
      "supernova_password_session",
      JSON.stringify({
        token: "e2e-local-token",
        id: "e2e-user",
        username: "e2e-human",
        email: "e2e@example.test",
        species: sessionSpecies,
      })
    );
  }, species);
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
  expect(homeFeedUrl).toContain("embedded_votes_limit=20");
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

test("opening an incomplete comment preview loads the full tombstone-preserving thread once", async ({ page }) => {
  const proposalId = 2178012;
  const tombstone = {
    ...fixtureComment(1, proposalId),
    id: "deleted-parent",
    user: "[deleted]",
    comment: "This comment was deleted.",
    deleted: true,
  };
  const reply = {
    ...fixtureComment(2, proposalId),
    id: "visible-reply",
    parent_comment_id: tombstone.id,
    comment: "Visible reply under deleted parent.",
  };
  const embeddedPeer = fixtureComment(3, proposalId);
  const laterComment = fixtureComment(4, proposalId);
  const post = feedPost({
    id: proposalId,
    text: "Incomplete comment preview fixture.",
    comments: [tombstone, reply, embeddedPeer],
    comment_count: 3,
    embedded_comment_count: 2,
    has_more_comments: true,
  });
  let commentsReadCount = 0;
  await mockFeedBackend(page, [post], {
    commentsByProposal: {
      [proposalId]: [tombstone, reply, embeddedPeer, laterComment, laterComment],
    },
  });
  await page.route("**/comments?**", async (route) => {
    commentsReadCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([tombstone, reply, embeddedPeer, laterComment, laterComment]),
    });
  });

  await page.goto("/");
  await page.locator(".post-action-bar").getByRole("button", { name: /^3$/ }).click();
  await expect(page.getByText("Visible reply under deleted parent.")).toBeVisible();
  await expect(page.getByText("Fixture comment number 4.")).toBeVisible();
  await expect(page.getByText("Fixture comment number 4.")).toHaveCount(1);
  await expect(page.getByText("This comment was deleted.")).toBeVisible();
  expect(commentsReadCount).toBe(1);
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

test("authoritative weighted summary stays coherent across card modal and vote changes", async ({ page }) => {
  const proposalId = 2178005;
  const humanYes = Array.from({ length: 25 }, (_, index) => ({
    voter: `human-yes-${index + 1}`,
    type: "human",
  }));
  const humanNo = Array.from({ length: 15 }, (_, index) => ({
    voter: `human-no-${index + 1}`,
    type: "human",
  }));
  const aiYes = Array.from({ length: 20 }, (_, index) => ({
    voter: `ai-yes-${index + 1}`,
    type: "ai",
  }));
  const companyNo = Array.from({ length: 20 }, (_, index) => ({
    voter: `company-no-${index + 1}`,
    type: "company",
  }));
  const voteSummary = {
    schema: "supernova.three_species_vote.v1",
    up: 45,
    down: 35,
    support: 45,
    oppose: 35,
    total: 80,
    approval_ratio: 0.5625,
    species_share_percent: 33.3333,
    weighted_support_percent: 54.1667,
    by_species: {
      human: {
        up: 25,
        down: 15,
        total: 40,
        internal_support_percent: 62.5,
        weighted_support_percent: 20.8333,
      },
      ai: {
        up: 20,
        down: 0,
        total: 20,
        internal_support_percent: 100,
        weighted_support_percent: 33.3333,
      },
      company: {
        up: 0,
        down: 20,
        total: 20,
        internal_support_percent: 0,
        weighted_support_percent: 0,
      },
    },
  };
  const post = feedPost({
    id: proposalId,
    text: "The card must use all eighty votes, not the capped preview.",
    likes: humanYes,
    dislikes: [],
    like_count: 45,
    dislike_count: 35,
    vote_summary: voteSummary,
  });
  const fullPost = {
    ...post,
    likes: [...humanYes, ...aiYes],
    dislikes: [...humanNo, ...companyNo],
  };
  let postVotes = 0;
  let deleteVotes = 0;
  let failNextPost = false;

  await seedPasswordSession(page, { species: "company" });
  await mockFeedBackend(page, [post], { singleProposals: { [proposalId]: fullPost } });
  await page.route("**/votes", async (route) => {
    postVotes += 1;
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (failNextPost) {
      failNextPost = false;
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ detail: "fixture failure" }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.route("**/votes?**", async (route) => {
    deleteVotes += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, removed: 1 }) });
  });

  await page.goto("/");
  const card = page.locator(`[data-proposal-id="${proposalId}"]`);
  await expect(card.getByText("54%", { exact: true })).toBeVisible();

  await card.getByRole("button", { name: "Show vote breakdown" }).click();
  const modal = page.locator("[data-vote-modal]");
  await expect(modal.getByText("54%", { exact: true })).toBeVisible();
  await expect(modal.getByText("80 total votes")).toBeVisible();
  await modal.getByRole("button", { name: "Close vote breakdown" }).click();

  await card.getByRole("button", { name: "Vote yes" }).evaluate((button) => {
    button.click();
    button.click();
  });
  await expect(card.getByText("56%", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Vote no" }).click();
  await expect(card.getByText("54%", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Vote no" }).click();
  await expect(card.getByText("54%", { exact: true })).toBeVisible();

  failNextPost = true;
  await card.getByRole("button", { name: "Vote yes" }).click();
  await expect(card.getByText("54%", { exact: true })).toBeVisible();

  expect(postVotes).toBe(3);
  expect(deleteVotes).toBe(1);
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

test("feed order stays frozen across composer focus, modal open, and follows arrival", async ({ page }) => {
  const posts = Array.from({ length: 10 }, (_, index) =>
    feedPost({
      id: 2178200 + index,
      userName: `author-${index}`,
      text: `Frozen order card ${index + 1}.`,
      like_count: (index * 7) % 10,
      comment_count: (index * 3) % 5,
      time: new Date(Date.now() - index * 3600_000).toISOString(),
    })
  );
  await seedPasswordSession(page);
  let releaseFollows;
  const followsGate = new Promise((resolve) => {
    releaseFollows = resolve;
  });
  await page.route("**/follows?user=**", async (route) => {
    await followsGate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ following: [{ username: "author-9" }] }),
    });
  });
  await mockFeedBackend(page, posts);

  await page.goto("/");
  await expect(page.getByText("Frozen order card 1.")).toBeVisible();
  const cards = page.locator("[data-proposal-card]");
  await expect(cards).toHaveCount(10);
  const initialOrder = await cards.evaluateAll((nodes) => nodes.map((node) => node.dataset.proposalId));

  await page.getByText("Post a signal, or ask AI...").click();
  await page.getByPlaceholder("Share your idea, update, or question").fill("order probe");
  await page.getByRole("button", { name: "Show vote breakdown" }).first().click();
  await page.getByRole("button", { name: "Close vote breakdown" }).click();
  releaseFollows();
  await page.waitForTimeout(400);

  const finalOrder = await cards.evaluateAll((nodes) => nodes.map((node) => node.dataset.proposalId));
  expect(finalOrder).toEqual(initialOrder);
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("expired system decision renders results mode instead of active voting", async ({ page }) => {
  await mockFeedBackend(page, [feedPost()]);
  await page.goto("/");

  const section = page.locator("section").filter({ hasText: "System Decision" }).first();
  await expect(section.getByText("Vote ended")).toBeVisible();
  await expect(section.getByText("Result")).toBeVisible();
  // Only the breakdown button remains; the active yes/no controls are gone.
  await expect(section.getByRole("button", { name: "Show species vote breakdown" })).toBeVisible();
  await expect(section.getByRole("button")).toHaveCount(1);
  await expect(page.locator("body")).not.toContainText(obviousRuntimeErrors);
});

test("voting_closed disables vote controls with a voting closed label", async ({ page }) => {
  const post = feedPost({
    id: 2178300,
    text: "This decision has closed voting.",
    likes: [{ voter: "closed-yes", type: "human" }],
    like_count: 1,
    voting_closed: true,
  });
  await mockFeedBackend(page, [post]);

  await page.goto("/");
  await expect(page.getByText("This decision has closed voting.")).toBeVisible();

  const card = page.locator("[data-proposal-card]").first();
  await expect(card.getByRole("button", { name: "Vote yes" })).toBeDisabled();
  await expect(card.getByRole("button", { name: "Vote no" })).toBeDisabled();
  await expect(card.getByText(/Voting closed/)).toBeVisible();
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
