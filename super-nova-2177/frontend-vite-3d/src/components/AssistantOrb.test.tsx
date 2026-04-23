import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import AssistantOrb from "./AssistantOrb";

describe("AssistantOrb menu interactions", () => {
  it("opens via click or keyboard and closes on outside click or Escape", async () => {
    const { getByRole, queryByRole } = render(<AssistantOrb />);

    const orb = getByRole("button", { name: /assistant orb/i });

    // Hover shouldn't open the menu
    fireEvent.mouseEnter(orb);
    expect(queryByRole("menu")).toBeNull();

    // Click opens the menu
    fireEvent.click(orb);
    await waitFor(() => expect(queryByRole("menu")).not.toBeNull());

    // Outside click closes the menu
    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(queryByRole("menu")).toBeNull());

    // Keyboard activation opens the menu
    fireEvent.keyDown(orb, { key: "Enter" });
    await waitFor(() => expect(queryByRole("menu")).not.toBeNull());

    // Escape closes the menu
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(queryByRole("menu")).toBeNull());
  });
});

