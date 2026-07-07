import { test, expect } from "@playwright/test";
import { absoluteApiUrl, API_BASE_URL } from "../../utils/apiBase.js";

// Pure URL-joining assertions (no browser/page): media values serialized by
// the backend must resolve against the API origin, and already-absolute
// values must pass through untouched. Guards the /uploads-fallback contract
// introduced with the feed read overhaul (M2.3).
test.describe("apiBase media URL joining", () => {
  test("rooted backend media paths join onto the API base", () => {
    expect(absoluteApiUrl("/uploads/abc.jpg")).toBe(`${API_BASE_URL}/uploads/abc.jpg`);
    expect(absoluteApiUrl("/uploads-fallback/12/0")).toBe(
      `${API_BASE_URL}/uploads-fallback/12/0`
    );
  });

  test("absolute, data, and blob URLs pass through untouched", () => {
    expect(absoluteApiUrl("https://cdn.example/x.jpg")).toBe("https://cdn.example/x.jpg");
    expect(absoluteApiUrl("http://cdn.example/y.jpg")).toBe("http://cdn.example/y.jpg");
    expect(absoluteApiUrl("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
    expect(absoluteApiUrl("blob:https://app.example/object")).toBe(
      "blob:https://app.example/object"
    );
  });
});
