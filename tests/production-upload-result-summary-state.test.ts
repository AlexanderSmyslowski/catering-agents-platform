import { describe, expect, it } from "vitest";
import { buildProductionUploadResultSummaryState } from "../backoffice-ui/src/production-upload-result-summary-state.js";

describe("production upload result summary state", () => {
  it("maps an accepted spec into visible production data for the upload result", () => {
    expect(
      buildProductionUploadResultSummaryState({
        event: {
          type: "conference",
          date: "2026-09-03",
          schedule: [{ label: "Service", start: "12:00", end: "14:00" }]
        },
        attendees: { expected: 90 },
        servicePlan: { serviceForm: "buffet" },
        readiness: { status: "partial" },
        menuPlan: [
          {
            componentId: "tarte",
            label: "Tortilla-Tarte",
            menuCategory: "vegetarian"
          }
        ],
        uncertainties: [
          {
            field: "event.schedule",
            suggestedQuestion: "Wie lautet das verbindliche Zeitfenster?"
          }
        ],
        assumptions: [
          {
            message: "Serviceform aus dem Anfragetext abgeleitet: Buffet."
          }
        ]
      })
    ).toEqual({
      eventLabel: "Konferenz · Datum: 2026-09-03 · Terminfenster: Service 12:00–14:00 · 90 Personen · Buffet",
      statusLabel: "Readiness: teilweise vollständig",
      menuItems: [
        {
          key: "tarte",
          label: "Tortilla-Tarte",
          detailLabel: "Vegetarisch"
        }
      ],
      questionLabels: ["Wie lautet das verbindliche Zeitfenster?"],
      assumptionLabels: ["Serviceform aus dem Anfragetext abgeleitet: Buffet."],
      artifactStatusLabels: [
        "1 Speisenkomponente erkannt",
        "Mengenkalkulation: wartet auf Berechnung",
        "Rezeptkarten: warten auf Rezeptzuordnung",
        "Einkaufsliste: wartet auf Berechnung"
      ],
      nextStepLabel: "Nächster Schritt: Rückfragen beantworten, dann Berechnung starten."
    });
  });

  it("keeps the next step actionable when no open question remains", () => {
    expect(
      buildProductionUploadResultSummaryState({
        event: { type: "meeting", date: "2026-09-03" },
        attendees: { expected: 35 },
        servicePlan: { serviceForm: "coffee_break" },
        readiness: { status: "complete" },
        menuPlan: []
      })?.nextStepLabel
    ).toBe("Nächster Schritt: Produktionsplan berechnen.");
  });
});
