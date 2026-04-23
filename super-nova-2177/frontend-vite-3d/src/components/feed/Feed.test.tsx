// src/components/feed/Feed.test.tsx
import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import Feed from "./Feed";
import { useFeedStore } from "../../lib/feedStore";
import type { Post } from "../../types";

const samplePosts: Post[] = [
  { id: 1, author: "@user", images: ["/a.jpg"] } as any,
  { id: 2, author: "@user2", images: ["/b.jpg"] } as any,
];

describe("Feed", () => {
  beforeEach(() => {
    useFeedStore.getState().setPosts(samplePosts);
  });

  it("loads posts from store without warnings", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: any) => {
      return setTimeout(cb, 0) as unknown as number;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id: any) => {
      clearTimeout(id);
    });

    const { container, unmount } = render(<Feed />);
    expect(container.querySelectorAll(".pc").length).toBe(samplePosts.length);
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();

    unmount();
    warn.mockRestore();
    error.mockRestore();
    (window.requestAnimationFrame as any).mockRestore?.();
    (window.cancelAnimationFrame as any).mockRestore?.();
  });
});
