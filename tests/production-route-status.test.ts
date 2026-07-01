import { describe, expect, it } from "vitest";
import { buildWorkbenchSpecFacts } from "../backoffice-ui/src/production-route-status.js";

describe("production route status", () => {
  it("builds the current workbench facts from the focused spec", () => {
    expect(
      buildWorkbenchSpecFacts({
        readiness: { status: "complete" },
        event: {
          date: "2026-06-12",
          schedule: [{ label: "Service", start: "12:00", end: "14:00" }]
        },
        attendees: { expected: 48 },
        servicePlan: { serviceForm: "buffet" },
        menuPlan: [
          { componentId: "starter", label: "Vitello Tonnato" },
          { componentId: "main", label: "Tortilla-Tarte" }
        ]
      })
    ).toEqual([
      { label: "Status", value: "vollständig" },
      { label: "Zeit", value: "Datum: 2026-06-12 · Terminfenster: Service 12:00–14:00" },
      { label: "Gäste", value: "48 Personen" },
      { label: "Service", value: "Buffet" },
      { label: "Menü", value: "2 Komponenten" },
      { label: "Speisen", value: "Vitello Tonnato, Tortilla-Tarte" }
    ]);
  });

  it("keeps the production result summary compact when many components are recognized", () => {
    expect(
      buildWorkbenchSpecFacts({
        readiness: { status: "partial" },
        event: { type: "conference" },
        menuPlan: [
          { label: "Vitello Tonnato" },
          { label: "Grüner Spargel" },
          { label: "Tortilla-Tarte" },
          { label: "Rotgarnelen" },
          { label: "Roastbeef" }
        ]
      })
    ).toContainEqual({
      label: "Speisen",
      value: "Vitello Tonnato, Grüner Spargel, Tortilla-Tarte, Rotgarnelen + 1 weitere"
    });
  });
});
