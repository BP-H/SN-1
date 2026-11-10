import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const nativeVideo = Buffer.from(readFileSync("tests/fixtures/video.webm.base64", "utf8").trim(), "base64");
const media = { images: [], image: "", video: "", link: "", file: "" };

function post(id, overrides = {}) {
  return {
    id, title: `Video ${id}`, text: `Video fixture ${id}`, userName: "video-human", author_type: "human",
    time: "2026-06-05T00:00:00Z", media, comments: [], likes: [], dislikes: [],
    like_count: 0, dislike_count: 0, comment_count: 0, ...overrides,
  };
}

async function mockFeed(page, posts) {
  await page.route("**/proposals?**", (route) => route.fulfill({ json: posts }));
  await page.route("**/system-vote**", (route) => route.fulfill({ json: { question: "Video fixture", deadline: "2099-01-01T00:00:00Z", likes: [], dislikes: [] } }));
  await page.route("**/notifications?**", (route) => route.fulfill({ json: [] }));
  await page.route("**/social-graph?**", (route) => route.fulfill({ json: { nodes: [], edges: [] } }));
  await page.route("**/uploads/video-fixture.webm", (route) => route.fulfill({ contentType: "video/webm", body: nativeVideo }));
  await page.route("https://i.ytimg.com/**", (route) => {
    // Missing max-resolution images can return a successful tiny placeholder.
    const width = route.request().url().includes("maxresdefault") ? 120 : 640;
    return route.fulfill({ contentType: "image/svg+xml", body: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="360"><rect width="100%" height="100%" fill="#ff4f8f"/></svg>` });
  });
  await page.route("https://www.youtube.com/embed/**", (route) => route.fulfill({ contentType: "text/html", body: "<button>Native YouTube controls</button>" }));
  await page.route("https://www.youtube.com/iframe_api", (route) => route.fulfill({
    contentType: "application/javascript",
    body: `window.__ytPlayers = []; window.YT = { Player: function(frame, config) {
      this.pauses = 0;
      this.pauseVideo = () => { this.pauses += 1; };
      window.__ytPlayers.push(this);
      queueMicrotask(() => { config.events.onReady({ target: this }); config.events.onStateChange({ target: this, data: 1 }); });
    }}; window.onYouTubeIframeAPIReady();`,
  }));
}

test("one tap opens a visible inline YouTube player without replacing it with a second poster", async ({ page }) => {
  await mockFeed(page, [post(1, { media: { ...media, link: "https://www.youtube.com/watch?si=shared&v=M7lc1UVf-VE&t=83" } })]);
  await page.goto("/");
  const play = page.getByRole("button", { name: "Play video: Video 1", exact: true });
  await expect(play).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(play.locator("img")).toHaveAttribute("src", /sddefault\.jpg$/);
  await play.click();
  const frame = page.locator('iframe[title="Video 1"]');
  await expect(frame).toBeVisible();
  await expect(frame).toHaveAttribute("src", /autoplay=1/);
  await expect(frame).toHaveAttribute("src", /playsinline=1/);
  await expect(frame).toHaveAttribute("src", /start=83/);
  await expect(play).toHaveCount(0);
  await expect(page.getByText("Video fixture 1", { exact: true })).toBeVisible();
});

test("an opened YouTube video pauses when it scrolls out of view", async ({ page }) => {
  await mockFeed(page, [post(1, { media: { ...media, video: "https://youtu.be/M7lc1UVf-VE" } }), ...Array.from({ length: 10 }, (_, i) => post(10 + i))]);
  await page.goto("/");
  await page.getByRole("button", { name: "Play video: Video 1", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__ytPlayers?.length || 0)).toBe(1);
  const before = await page.evaluate(() => window.__ytPlayers[0].pauses);
  await page.getByText("Video fixture 19", { exact: true }).scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => window.__ytPlayers[0].pauses)).toBeGreaterThan(before);
});

test("native feed videos have inline controls, autoplay muted, and pause offscreen", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await mockFeed(page, [post(1, { media: { ...media, video: "/uploads/video-fixture.webm" } }), ...Array.from({ length: 10 }, (_, i) => post(10 + i))]);
  await page.goto("/");
  const video = page.locator("video").first();
  await video.scrollIntoViewIfNeeded();
  await expect(video).toHaveJSProperty("muted", true);
  await expect(video).toHaveJSProperty("playsInline", true);
  await expect(video).toHaveJSProperty("controls", true);
  await expect.poll(() => video.evaluate((element) => element.paused)).toBe(false);
  await page.getByText("Video fixture 19", { exact: true }).scrollIntoViewIfNeeded();
  await expect(video).toHaveJSProperty("paused", true);
});

test("starting another video pauses the first, and manual pause survives rerenders", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 1300 });
  await mockFeed(page, [post(1, { media: { ...media, video: "/uploads/video-fixture.webm" } }), post(2, { media: { ...media, video: "/uploads/video-fixture.webm" } }), ...Array.from({ length: 10 }, (_, i) => post(10 + i))]);
  await page.goto("/");
  const videos = page.locator("video");
  await expect(videos).toHaveCount(2);
  await videos.first().evaluate((element) => element.play());
  await expect(videos.first()).toHaveJSProperty("paused", false);
  await videos.nth(1).evaluate((element) => element.play());
  await expect(videos.first()).toHaveJSProperty("paused", true);
  await expect(videos.nth(1)).toHaveJSProperty("paused", false);
  await videos.nth(1).evaluate((element) => element.pause());
  await expect(videos.nth(1)).toHaveJSProperty("paused", true);
  await page.getByText("Video fixture 19", { exact: true }).scrollIntoViewIfNeeded();
  await videos.nth(1).scrollIntoViewIfNeeded();
  await expect(videos.nth(1)).toHaveJSProperty("paused", true);
});

test("reduced-motion preference keeps native autoplay off but allows manual playback", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockFeed(page, [post(1, { media: { ...media, video: "/uploads/video-fixture.webm" } })]);
  await page.goto("/");
  const video = page.locator("video").first();
  await video.scrollIntoViewIfNeeded();
  await expect.poll(() => video.evaluate((element) => element.readyState)).toBeGreaterThan(0);
  await expect(video).toHaveJSProperty("paused", true);
  await video.evaluate((element) => element.play());
  await expect(video).toHaveJSProperty("paused", false);
});

test("a blocked YouTube API leaves controls available and unloads the iframe offscreen", async ({ page }) => {
  await mockFeed(page, [post(1, { media: { ...media, video: "https://youtu.be/M7lc1UVf-VE" } }), ...Array.from({ length: 10 }, (_, i) => post(10 + i))]);
  await page.route("https://www.youtube.com/iframe_api", (route) => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Play video: Video 1", exact: true }).click();
  await expect(page.locator('iframe[title="Video 1"]')).toBeVisible();
  await page.getByText("Video fixture 19", { exact: true }).scrollIntoViewIfNeeded();
  await expect(page.locator('iframe[title="Video 1"]')).toHaveCount(0);
});

test("mobile portrait videos fit the feed and the page has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockFeed(page, [post(1, { media: { ...media, video: "https://www.youtube.com/shorts/M7lc1UVf-VE" } })]);
  await page.goto("/");
  const play = page.getByRole("button", { name: "Play video: Video 1", exact: true });
  await play.scrollIntoViewIfNeeded();
  await expect(page.locator(".feed-video-frame--portrait")).toBeVisible();
  await play.click();
  await expect(page.locator('iframe[title="Video 1"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/video-mobile.png", fullPage: true });
});
