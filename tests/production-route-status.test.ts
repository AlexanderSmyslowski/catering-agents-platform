import { describe, expect, it } from "vitest";
import {
  buildWorkbenchSpecFacts,
  formatActiveProductionContextLabel,
  selectProductionNextStep
} from "../backoffice-ui/src/production-route-status.js";

describe("production route status", () => {
  it("keeps the existing next-step priority for empty, open, and ready production states", () => {
    expect(
      selectProductionNextStep({
        hasFocusedProductionSpec: false,
        questionCount: 0,
        hasSelectedPlan: false,
        purchaseListCount: 0
      })
    ).toEqual({
      title: "Auftrag einfügen oder Datei ablegen",
      description: "Starte mit Angebot, E-Mail, Text oder manuellen Veranstaltungsdaten."
    });

    expect(
      selectProductionNextStep({
        hasFocusedProductionSpec: true,
        questionCount: 0,
        hasSelectedPlan: true,
        purchaseListCount: 1
      })
    ).toEqual({
      title: "Produktionsobjekte und Downloads prüfen",
      description: "Plan, Einkaufsliste und Exporte sind als prüfbare Ergebniszonen verfügbar."
    });
  });

  it("builds the current production context and workbench facts from the focused spec", () => {
    expect(
      formatActiveProductionContextLabel({
        selectedPlan: { planId: "plan-1", eventSpecId: "spec-1" },
        productionWorkspaceCleared: false
      })
    ).toBe("Plan-Kontext geladen: plan-1 · Spezifikation: spec-1");

    expect(
      buildWorkbenchSpecFacts({
        readiness: { status: "complete" },
        event: {
          date: "2026-06-12",
          schedule: [{ label: "Service", start: "12:00", end: "14:00" }]
        },
        attendees: { expected: 48 },
        servicePlan: { serviceForm: "buffet" },
        menuPlan: [{ componentId: "starter" }, { componentId: "main" }]
      })
    ).toEqual([
      { label: "Status", value: "vollständig" },
      { label: "Zeit", value: "Datum: 2026-06-12 · Terminfenster: Service 12:00–14:00" },
      { label: "Gäste", value: "48 Personen" },
      { label: "Service", value: "Buffet" },
      { label: "Menü", value: "2 Komponenten" }
    ]);
  });

  it("prefers the cleared workspace label over stale focused or selected plan context", () => {
    expect(
      formatActiveProductionContextLabel({
        focusedProductionSpecLabel: "Lunch · 80 Teilnehmer · 2026-06-01",
        selectedPlan: { planId: "plan-stale", eventSpecId: "spec-stale" },
        selectedPlanSpecLabel: "Lunch · 80 Teilnehmer · 2026-06-01",
        productionWorkspaceCleared: true
      })
    ).toBe("Kein aktiver Vorgang");
  });
});
