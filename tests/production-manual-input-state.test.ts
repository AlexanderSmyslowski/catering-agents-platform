import { describe, expect, it } from "vitest";
import { buildProductionManualInputState } from "../backoffice-ui/src/production-manual-input-state.js";

describe("production manual input state", () => {
  it("maps the manual input fields without normalizing values", () => {
    const state = buildProductionManualInputState({
      eventType: " Lunch ",
      eventDate: " 2026-06-12 ",
      attendeeCount: " 42 ",
      serviceForm: " Buffet ",
      menuItems: " Hummus, Salat, ",
      customerName: " ACME ",
      venueName: " Loft ",
      notes: " Bitte frueh liefern "
    });

    expect(state).toEqual({
      eventType: " Lunch ",
      eventDate: " 2026-06-12 ",
      attendeeCount: " 42 ",
      serviceForm: " Buffet ",
      menuItems: " Hummus, Salat, ",
      customerName: " ACME ",
      venueName: " Loft ",
      notes: " Bitte frueh liefern "
    });
  });

  it("keeps empty form strings as empty form strings", () => {
    const state = buildProductionManualInputState({
      eventType: "",
      eventDate: "",
      attendeeCount: "",
      serviceForm: "",
      menuItems: "",
      customerName: "",
      venueName: "",
      notes: ""
    });

    expect(state).toEqual({
      eventType: "",
      eventDate: "",
      attendeeCount: "",
      serviceForm: "",
      menuItems: "",
      customerName: "",
      venueName: "",
      notes: ""
    });
  });
});
