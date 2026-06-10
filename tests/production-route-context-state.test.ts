import { describe, expect, it } from "vitest";
import {
  formatActiveProductionContextLabel,
  formatProductionTechnicalContextLabel,
  selectProductionNextStep
} from "../backoffice-ui/src/production-route-context-state.js";

describe("production route context state", () => {
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

  it("builds the active plan context label when no focused spec is present", () => {
    expect(
      formatActiveProductionContextLabel({
        selectedPlan: { planId: "plan-1", eventSpecId: "spec-1" },
        productionWorkspaceCleared: false
      })
    ).toBe("Produktionsplan aus gespeicherter Spezifikation");
    expect(
      formatProductionTechnicalContextLabel({
        selectedPlan: { planId: "plan-1", eventSpecId: "spec-1" },
        productionWorkspaceCleared: false
      })
    ).toBe("Plan plan-1 · Spezifikation spec-1");
  });
});
