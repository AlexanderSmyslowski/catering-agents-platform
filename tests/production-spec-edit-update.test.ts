import { describe, expect, it } from "vitest";
import { specEditSnapshotFromSpec } from "../backoffice-ui/src/production-spec-edit-snapshot.js";
import { buildSpecEditUpdateInput } from "../backoffice-ui/src/production-spec-edit-update.js";

describe("production spec edit update input", () => {
  it("builds the accepted spec update payload from editor state", () => {
    expect(
      buildSpecEditUpdateInput({
        eventType: " Lunch ",
        eventDate: " 2026-06-12 ",
        eventSchedule: " 16:30-23:00 ",
        attendeeCount: " 42 ",
        serviceForm: " Buffet ",
        menuItems: " Hummus, Salat, ",
        componentStates: {
          "component-hummus": {
            menuCategory: "vegan",
            productionMode: "scratch",
            purchasedElements: " Baguette, Gemuesesticks ",
            recipeOverrideId: " recipe-hummus ",
            notes: " Baguette beim Baecker zukaufen "
          }
        }
      })
    ).toEqual({
      eventType: "Lunch",
      eventDate: "2026-06-12",
      eventSchedule: [{ label: "Service", start: "16:30", end: "23:00" }],
      attendeeCount: 42,
      serviceForm: "Buffet",
      menuItems: ["Hummus", "Salat"],
      componentUpdates: [
        {
          componentId: "component-hummus",
          menuCategory: "vegan",
          productionMode: "scratch",
          purchasedElements: ["Baguette", "Gemuesesticks"],
          recipeOverrideId: "recipe-hummus",
          notes: "Baguette beim Baecker zukaufen"
        }
      ]
    });
  });

  it("keeps invalid select values undefined while preserving explicit empty recipe overrides", () => {
    expect(
      buildSpecEditUpdateInput({
        eventType: " ",
        eventDate: "",
        eventSchedule: "",
        attendeeCount: "",
        serviceForm: " ",
        menuItems: " , ",
        componentStates: {
          "component-risk": {
            menuCategory: "unknown",
            productionMode: "manual_review",
            purchasedElements: " ",
            recipeOverrideId: " ",
            notes: " "
          }
        }
      })
    ).toEqual({
      eventType: undefined,
      eventDate: undefined,
      eventSchedule: undefined,
      attendeeCount: undefined,
      serviceForm: undefined,
      menuItems: [],
      componentUpdates: [
        {
          componentId: "component-risk",
          menuCategory: undefined,
          productionMode: undefined,
          purchasedElements: [],
          recipeOverrideId: "",
          notes: undefined
        }
      ]
    });
  });
});


describe("lossless manufacturing schedule edits", () => {
  function roundTrip(schedule: Array<{ label: string; start?: string; end?: string }>) {
    const snapshot = specEditSnapshotFromSpec({ event: { schedule }, menuPlan: [] });
    return buildSpecEditUpdateInput({ ...snapshot, componentStates: {} }).eventSchedule;
  }
  it.each([
    ["Z1 Service", [{ label: "Service", start: "09:00", end: "12:00" }]],
    ["Z2 multiple periods", [{ label: "Aufbau", start: "08:00", end: "09:00" }, { label: "Service", start: "09:00", end: "12:00" }]],
    ["Z3 Station 2", [{ label: "Station 2", start: "09:00", end: "12:00" }]],
    ["unstructured existing source", [{ label: "Nach Absprache, voraussichtlich morgens" }]]
  ])("preserves %s through repeated reopening", (_name, schedule) => {
    expect(roundTrip(schedule)).toEqual(schedule);
    expect(roundTrip(roundTrip(schedule)!)).toEqual(schedule);
  });
  it.each(["Station 2", "09:75-12:00", "09:00-12:00, 13:00-15:00", "09:00-12:00 oder 13:00", "12:00-09:00", ""]) (
    "rejects changed ambiguous or unsupported schedule %s", (eventSchedule) => {
      const snapshot = specEditSnapshotFromSpec({ event: { schedule: [{ label: "Service", start: "09:00", end: "12:00" }] }, menuPlan: [] });
      expect(() => buildSpecEditUpdateInput({ ...snapshot, eventSchedule, componentStates: {} })).toThrow(/Zeitfenster/);
    });
  it("accepts one explicit labelled interval without parsing its label number", () => {
    const snapshot = specEditSnapshotFromSpec({ menuPlan: [] });
    expect(buildSpecEditUpdateInput({ ...snapshot, eventSchedule: "Station 2 09:00–12:00", componentStates: {} }).eventSchedule)
      .toEqual([{ label: "Station 2", start: "09:00", end: "12:00" }]);
  });
});
