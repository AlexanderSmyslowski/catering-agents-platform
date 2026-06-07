import { describe, expect, it } from "vitest";
import { buildMiniPilotStorageHintState } from "../backoffice-ui/src/mini-pilot-storage-hint-state.js";

describe("mini pilot storage hint state", () => {
  it("returns no label when there is no stored result", () => {
    expect(
      buildMiniPilotStorageHintState({
        rawResult: "   ",
        loadedFromStorage: false
      })
    ).toEqual({
      label: undefined,
      isCarryover: false,
      isStale: false
    });
  });

  it("marks a freshly stored local result without a stale hint", () => {
    const state = buildMiniPilotStorageHintState({
      rawResult: '{"ok":true}',
      loadedFromStorage: false,
      updatedAt: "2026-06-07T16:00:00.000Z",
      now: new Date("2026-06-07T16:20:00.000Z")
    });

    expect(state.isCarryover).toBe(false);
    expect(state.isStale).toBe(false);
    expect(state.label).toContain("Lokal gespeichert");
    expect(state.label).not.toContain("älter als 30 Minuten");
  });

  it("keeps a recent carried-over result readable without stale wording", () => {
    const state = buildMiniPilotStorageHintState({
      rawResult: '{"ok":true}',
      loadedFromStorage: true,
      updatedAt: "2026-06-07T16:00:00.000Z",
      now: new Date("2026-06-07T16:20:00.000Z")
    });

    expect(state.isCarryover).toBe(true);
    expect(state.isStale).toBe(false);
    expect(state.label).toContain("Lokaler Stand übernommen");
    expect(state.label).not.toContain("älter als 30 Minuten");
  });

  it("marks an older carried-over result as stale", () => {
    const state = buildMiniPilotStorageHintState({
      rawResult: '{"ok":true}',
      loadedFromStorage: true,
      updatedAt: "2026-06-07T16:00:00.000Z",
      now: new Date("2026-06-07T16:45:00.000Z")
    });

    expect(state.isCarryover).toBe(true);
    expect(state.isStale).toBe(true);
    expect(state.label).toContain("Lokaler Stand übernommen");
    expect(state.label).toContain("älter als 30 Minuten");
  });
});
