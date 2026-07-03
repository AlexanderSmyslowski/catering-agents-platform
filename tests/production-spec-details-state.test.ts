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
      contextLabel: "Spezifikation im Fokus",
      eventLabel: "Eventtyp: Lunch · Datum: 2026-06-12 · Terminfenster: Service 12:00–14:00",
      summaryLabel: "Teilnehmerzahl: 48 · Serviceform: Buffet · Readiness: teilweise vollständig",
      menuItems: [
        {
          key: "starter",
          label: "Vorspeise",
          detailLabel: "Klassisch · Eigenproduktion"
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
      contextLabel: "Spezifikation im Fokus",
      eventLabel: "Eventtyp: Konferenz · Terminfenster: noch zu bestätigen",
      summaryLabel: "Teilnehmerzahl: - · Serviceform: offen · Readiness: vollständig",
      menuItems: [
        {
          key: "component-1",
          label: "component-1",
          detailLabel: "Kategorie offen · Herstellungsart offen"
        }
      ]
    });
  });

  it("uses the operator readiness label when open questions make a complete spec review-required", () => {
    expect(
      buildProductionSpecDetailsState(
        {
          specId: "spec-review",
          event: { type: "conference", date: "2026-06-01" },
          attendees: { expected: 90 },
          servicePlan: { serviceForm: "buffet" },
          readiness: { status: "complete" },
          menuPlan: []
        },
        { readinessLabel: "Prüfung nötig" }
      )?.summaryLabel
    ).toBe("Teilnehmerzahl: 90 · Serviceform: Buffet · Readiness: Prüfung nötig");
  });
});
