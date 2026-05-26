import { describe, expect, it } from "vitest";
import { buildManualSpecInput } from "../backoffice-ui/src/production-manual-spec-input.js";

describe("production manual spec input", () => {
  it("normalizes manual production spec form values for intake creation", () => {
    expect(
      buildManualSpecInput({
        eventType: " Lunch ",
        eventDate: " 2026-06-12 ",
        attendeeCount: " 42 ",
        serviceForm: " Buffet ",
        menuItems: " Hummus, Salat, ",
        customerName: " ACME ",
        venueName: " Loft ",
        notes: " Bitte frueh liefern "
      })
    ).toEqual({
      eventType: "Lunch",
      eventDate: "2026-06-12",
      attendeeCount: 42,
      serviceForm: "Buffet",
      menuItems: ["Hummus", "Salat"],
      customerName: "ACME",
      venueName: "Loft",
      notes: "Bitte frueh liefern"
    });
  });

  it("keeps empty optional fields undefined while preserving an empty menu item list", () => {
    expect(
      buildManualSpecInput({
        eventType: " ",
        eventDate: "",
        attendeeCount: "",
        serviceForm: " ",
        menuItems: " , ",
        customerName: " ",
        venueName: "",
        notes: " "
      })
    ).toEqual({
      eventType: undefined,
      eventDate: undefined,
      attendeeCount: undefined,
      serviceForm: undefined,
      menuItems: [],
      customerName: undefined,
      venueName: undefined,
      notes: undefined
    });
  });
});
