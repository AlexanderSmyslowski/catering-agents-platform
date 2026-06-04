import { describe, expect, it } from "vitest";
import { buildProductionSpecDetailsState } from "../backoffice-ui/src/production-spec-details-state.js";

describe("production spec details state", () => {
  it("returns undefined when no production spec is present", () => {
    expect(buildProductionSpecDetailsState()).toBeUndefined();
  });

  it("maps production spec fields into stable detail labels", () => {
    expect(
      buildProductionSpecDetailsState({
        specId: "spec-1",
        event: {
          type: "Lunch",
          date: "2026-06-12",
          schedule: [{ label: "Service", start: "12:00", end: "14:00" }]
        },
        attendees: { expected: 48 },
        servicePlan: { serviceForm: "buffet" },
        readiness: { status: "partial" },
        menuPlan: [
          {
            componentId: "starter",
            label: "Vorspeise",
            menuCategory: "classic",
            productionDecision: { mode: "scratch" }
          }
        ]
      })
    ).toEqual({
      specIdLabel: "specId: spec-1",
      eventLabel: "Eventtyp: Lunch · Datum: 2026-06-12 · Terminfenster: Service 12:00–14:00",
      summaryLabel: "Teilnehmerzahl: 48 · Serviceform: Buffet · Readiness: teilweise vollständig",
      menuItems: [
        {
          key: "starter",
          label: "Vorspeise",
          detailLabel: "klassisch · Eigenproduktion"
        }
      ]
    });
  });

  it("keeps fallback labels explicit when timing, attendee, or mode details are missing", () => {
    expect(
      buildProductionSpecDetailsState({
        specId: "spec-2",
        servicePlan: { eventType: "Konferenz", serviceForm: "" },
        readiness: { status: "complete" },
        menuPlan: [{ componentId: "component-1" }]
      })
    ).toEqual({
      specIdLabel: "specId: spec-2",
      eventLabel: "Eventtyp: Konferenz · Terminfenster: noch zu bestätigen",
      summaryLabel: "Teilnehmerzahl: - · Serviceform: offen · Readiness: vollständig",
      menuItems: [
        {
          key: "component-1",
          label: "component-1",
          detailLabel: "offen · offen"
        }
      ]
    });
  });
});
