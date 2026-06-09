import { describe, expect, it } from "vitest";
import { shouldShowMiniPilotPanel } from "../backoffice-ui/src/mini-pilot-panel-gate.js";

describe("mini pilot panel gate", () => {
  it("hides the dev panel by default", () => {
    expect(shouldShowMiniPilotPanel({})).toBe(false);
  });

  it("shows the dev panel only with the explicit Vite flag", () => {
    expect(shouldShowMiniPilotPanel({ VITE_SHOW_MINI_PILOT_PANEL: "1" })).toBe(true);
    expect(shouldShowMiniPilotPanel({ VITE_SHOW_MINI_PILOT_PANEL: "true" })).toBe(false);
  });
});
