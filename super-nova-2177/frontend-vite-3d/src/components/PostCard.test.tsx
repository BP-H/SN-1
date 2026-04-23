import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import PostCard from "./PostCard";

vi.mock("../lib/bus", () => ({
  default: { on: () => () => {}, emit: () => {} }
}));

vi.mock("../lib/ensureModelViewer", () => ({
  ensureModelViewer: () => Promise.resolve()
}));

vi.mock("./AmbientWorld", () => ({
  default: () => <div />
}));

describe("PostCard emoji accessibility", () => {
  it("emoji buttons are focusable", () => {
    const post = { id: 1 } as any;
    const { container } = render(<PostCard post={post} />);
    const bar = container.querySelector(".pc-emoji-bar")!;
    const buttons = Array.from(bar.querySelectorAll("button"));
    expect(buttons.length).toBeGreaterThan(0);
    const first = buttons[0] as HTMLButtonElement;
    first.focus();
    expect(document.activeElement).toBe(first);
  });
});

