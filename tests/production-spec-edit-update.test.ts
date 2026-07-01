import { describe, expect, it } from "vitest";
import { buildSpecEditUpdateInput } from "../backoffice-ui/src/production-spec-edit-update.js";

describe("production spec edit update input", () => {
  it("builds the accepted spec update payload from editor state", () => {
    expect(
      buildSpecEditUpdateInput({
        eventType: " Lunch ",
        eventDate: " 2026-06-12 ",
        eventSchedule: " Service 12:00–14:00 ",
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
      schedule: [{ label: "Servicefenster", start: "Service 12:00–14:00" }],
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
        eventSchedule: " ",
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
      schedule: undefined,
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
