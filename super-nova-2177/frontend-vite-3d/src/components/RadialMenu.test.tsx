import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import RadialMenu from "./RadialMenu";

describe("RadialMenu keyboard navigation", () => {
  const noop = () => {};

  it("cycles through dynamic emoji counts", async () => {
    const { getByRole, getAllByRole } = render(
      <RadialMenu
        center={{ x: 0, y: 0 }}
        onClose={noop}
        onChat={noop}
        onReact={noop}
        onComment={noop}
        onRemix={noop}
        onShare={noop}
        onProfile={noop}
        avatarUrl="/avatar.png"
        emojis={["😀", "😃", "😄"]}
      />
    );

    const menu = getByRole("menu");

    fireEvent.keyDown(menu, { key: "ArrowRight" }); // focus React
    fireEvent.keyDown(menu, { key: "Enter" }); // open react submenu

    const submenu = getAllByRole("menu").find((el) =>
      el.querySelector("#assistant-menu-item-emoji-0")
    )!;

    await waitFor(() =>
      expect(submenu.getAttribute("aria-activedescendant")).toBe(
        "assistant-menu-item-emoji-0"
      )
    );

    fireEvent.keyDown(submenu, { key: "ArrowRight" });
    await waitFor(() =>
      expect(submenu.getAttribute("aria-activedescendant")).toBe(
        "assistant-menu-item-emoji-1"
      )
    );

    fireEvent.keyDown(submenu, { key: "ArrowRight" });
    await waitFor(() =>
      expect(submenu.getAttribute("aria-activedescendant")).toBe(
        "assistant-menu-item-emoji-2"
      )
    );

    fireEvent.keyDown(submenu, { key: "ArrowRight" });
    await waitFor(() =>
      expect(submenu.getAttribute("aria-activedescendant")).toBe(
        "assistant-menu-item-back"
      )
    );

    fireEvent.keyDown(submenu, { key: "ArrowRight" });
    await waitFor(() =>
      expect(submenu.getAttribute("aria-activedescendant")).toBe(
        "assistant-menu-item-emoji-0"
      )
    );
  });

  it("allows navigating to the center control", async () => {
    const onClose = vi.fn();
    const { getAllByRole } = render(
      <RadialMenu
        center={{ x: 0, y: 0 }}
        onClose={onClose}
        onChat={noop}
        onReact={noop}
        onComment={noop}
        onRemix={noop}
        onShare={noop}
        onProfile={noop}
        avatarUrl="/avatar.png"
        emojis={[]}
      />
    );

    const menus = getAllByRole("menu");
    const menu = menus[menus.length - 1];

    // cycle through the four root items to focus the close control
    fireEvent.keyDown(menu, { key: "ArrowRight" });
    fireEvent.keyDown(menu, { key: "ArrowRight" });
    fireEvent.keyDown(menu, { key: "ArrowRight" });
    fireEvent.keyDown(menu, { key: "ArrowRight" });

    await waitFor(() =>
      expect(menu.getAttribute("aria-activedescendant")).toBe(
        "assistant-menu-item-close"
      )
    );

    fireEvent.keyDown(menu, { key: "Enter" });

    expect(onClose).toHaveBeenCalled();
  });
});

