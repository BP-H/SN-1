import { expect, test } from "@playwright/test";
import { getYouTubeId, youTubeEmbedUrl, youTubeStartSeconds } from "../../utils/videoUrls.js";

test("YouTube links support query ordering, mobile, Shorts, live and privacy embeds", () => {
  for (const value of [
    "https://www.youtube.com/watch?si=shared&v=M7lc1UVf-VE&t=10",
    "https://m.youtube.com/watch?v=M7lc1UVf-VE",
    " https://youtu.be/M7lc1UVf-VE?si=shared ",
    "https://www.youtube.com/shorts/M7lc1UVf-VE",
    "https://www.youtube.com/live/M7lc1UVf-VE",
    "https://www.youtube-nocookie.com/embed/M7lc1UVf-VE",
    "www.youtube.com/watch?v=M7lc1UVf-VE",
  ]) expect(getYouTubeId(value)).toBe("M7lc1UVf-VE");
});

test("unrelated hosts and incomplete IDs never turn into YouTube players", () => {
  for (const value of [null, {}, "", "/uploads/movie.mp4", "https://notyoutube.com/watch?v=M7lc1UVf-VE", "https://youtube.com.evil.example/watch?v=M7lc1UVf-VE", "https://youtube.com/watch?v=short"]) {
    expect(getYouTubeId(value)).toBe("");
  }
});

test("playback URLs request inline muted playback from the first click and retain timestamps", () => {
  const url = new URL(youTubeEmbedUrl("https://youtu.be/M7lc1UVf-VE?t=1m23s", "https://www.2177.tech"));
  expect(url.origin).toBe("https://www.youtube.com");
  expect(url.searchParams.get("autoplay")).toBe("1");
  expect(url.searchParams.get("playsinline")).toBe("1");
  expect(url.searchParams.get("mute")).toBe("1");
  expect(url.searchParams.get("start")).toBe("83");
  expect(url.searchParams.get("origin")).toBe("https://www.2177.tech");
  expect(youTubeStartSeconds("https://youtube.com/watch?v=M7lc1UVf-VE#t=2m")).toBe(120);
});
