import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import PortalOrb from "./PortalOrb";
import bus from "../lib/bus";

describe("PortalOrb compose action", () => {
  it("emits compose event when selecting compose", async () => {
    const emitSpy = vi.spyOn(bus, "emit");
    const { getByRole, findByTitle } = render(
      <PortalOrb onAnalyzeImage={() => {}} />
    );
    const orb = getByRole("button", { name: /ai portal/i });
    fireEvent.keyDown(orb, { key: "Enter" });
    const composeBtn = await findByTitle("Compose");
    fireEvent.click(composeBtn);
    expect(emitSpy).toHaveBeenCalledWith("compose");
    emitSpy.mockRestore();
  });
});
