// src/components/feed/PostCard.test.tsx
import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import PostCard from "./PostCard";
import type { Post } from "../../types";

describe("PostCard image grid", () => {
  const post: Post = {
    id: 1,
    author: "@user",
    images: ["/a.jpg", "/b.jpg", "/c.jpg"],
  };

  it("renders multiple images", () => {
    const { container } = render(<PostCard post={post} />);
    const gallery = container.querySelector(".pc-carousel") as HTMLElement;
    const imgs = Array.from(gallery.querySelectorAll("img")) as HTMLImageElement[];
    expect(imgs.length).toBe(3);
    expect(imgs[0].getAttribute("src")).toBe("/a.jpg");
  });
});

