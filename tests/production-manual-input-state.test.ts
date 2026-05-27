import { describe, expect, it } from "vitest";
import {
  buildProductionManualInputActions,
  buildProductionManualInputStateFromForm,
  buildProductionManualInputState
} from "../backoffice-ui/src/production-manual-input-state.js";

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

  it("maps manual hook field names to manual input values", () => {
    expect(
      buildProductionManualInputStateFromForm({
        manualEventType: "conference",
        manualEventDate: "2026-07-20",
        manualAttendeeCount: "80",
        manualServiceForm: "buffet",
        manualMenuItems: "Tomaten Mozzarella Spiesse",
        manualCustomerName: "ACME",
        manualVenueName: "Atrium",
        manualNotes: "Vegetarisch kennzeichnen"
      })
    ).toEqual({
      eventType: "conference",
      eventDate: "2026-07-20",
      attendeeCount: "80",
      serviceForm: "buffet",
      menuItems: "Tomaten Mozzarella Spiesse",
      customerName: "ACME",
      venueName: "Atrium",
      notes: "Vegetarisch kennzeichnen"
    });
  });

  it("maps manual input action references from hook field names without wrapping callbacks", () => {
    const actions = {
      setManualEventType: (_value: string) => undefined,
      setManualEventDate: (_value: string) => undefined,
      setManualAttendeeCount: (_value: string) => undefined,
      setManualServiceForm: (_value: string) => undefined,
      setManualMenuItems: (_value: string) => undefined,
      setManualCustomerName: (_value: string) => undefined,
      setManualVenueName: (_value: string) => undefined,
      setManualNotes: (_value: string) => undefined,
      submitManualSpec: async () => undefined
    };

    expect(buildProductionManualInputActions(actions)).toEqual({
      setEventType: actions.setManualEventType,
      setEventDate: actions.setManualEventDate,
      setAttendeeCount: actions.setManualAttendeeCount,
      setServiceForm: actions.setManualServiceForm,
      setMenuItems: actions.setManualMenuItems,
      setCustomerName: actions.setManualCustomerName,
      setVenueName: actions.setManualVenueName,
      setNotes: actions.setManualNotes,
      submitManualSpec: actions.submitManualSpec
    });
  });
});
