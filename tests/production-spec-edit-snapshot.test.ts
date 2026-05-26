import { describe, expect, it } from "vitest";
import {
  normalizedSpecEditSnapshot,
  specEditSnapshotFromSpec
} from "../backoffice-ui/src/production-spec-edit-snapshot.js";

describe("production spec edit snapshot", () => {
  it("builds editor state from accepted production specs", () => {
    const snapshot = specEditSnapshotFromSpec({
      event: {
        type: "Lunch",
        date: "2026-06-12",
        serviceForm: "Buffet"
      },
      attendees: {
        expected: 42
      },
      menuPlan: [
        {
          componentId: "component-hummus",
          label: "Hummus mit Rohkost",
          menuCategory: "vegan",
          recipeOverrideId: "recipe-hummus",
          productionDecision: {
            mode: "scratch",
            purchasedElements: ["Baguette", "Gemuesesticks"],
            notes: "Baguette beim Baecker zukaufen"
          }
        }
      ]
    });

    expect(snapshot).toEqual({
      eventType: "Lunch",
      eventDate: "2026-06-12",
      attendeeCount: "42",
      serviceForm: "Buffet",
      menuItems: "Hummus mit Rohkost",
      components: [
        [
          "component-hummus",
          {
            menuCategory: "vegan",
            productionMode: "scratch",
            purchasedElements: "Baguette, Gemuesesticks",
            recipeOverrideId: "recipe-hummus",
            notes: "Baguette beim Baecker zukaufen"
          }
        ]
      ]
    });
  });

  it("normalizes whitespace and component order before change detection", () => {
    const left = normalizedSpecEditSnapshot({
      eventType: " Lunch ",
      eventDate: " 2026-06-12 ",
      attendeeCount: " 42 ",
      serviceForm: " Buffet ",
      menuItems: " Hummus, Salat ",
      components: [
        [
          "component-salat",
          {
            menuCategory: " vegetarian ",
            productionMode: " scratch ",
            purchasedElements: " Brot ",
            recipeOverrideId: " recipe-salat ",
            notes: " Mise en place "
          }
        ],
        [
          "component-hummus",
          {
            menuCategory: " vegan ",
            productionMode: " scratch ",
            purchasedElements: " Baguette ",
            recipeOverrideId: " recipe-hummus ",
            notes: " Baecker-Zukauf "
          }
        ]
      ]
    });
    const right = normalizedSpecEditSnapshot({
      eventType: "Lunch",
      eventDate: "2026-06-12",
      attendeeCount: "42",
      serviceForm: "Buffet",
      menuItems: "Hummus, Salat",
      components: [
        [
          "component-hummus",
          {
            menuCategory: "vegan",
            productionMode: "scratch",
            purchasedElements: "Baguette",
            recipeOverrideId: "recipe-hummus",
            notes: "Baecker-Zukauf"
          }
        ],
        [
          "component-salat",
          {
            menuCategory: "vegetarian",
            productionMode: "scratch",
            purchasedElements: "Brot",
            recipeOverrideId: "recipe-salat",
            notes: "Mise en place"
          }
        ]
      ]
    });

    expect(left).toBe(right);
  });
});
