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
        hasSourceWarnings: true,
        hasSelectedPlan: true,
        purchaseListCount: 1
      })
    ).toEqual({
      title: "Quellenprüfung bestätigen",
      description: "Die Quelle wurde nur unsicher verarbeitet. Bitte Lesbarkeit und erkannte Daten prüfen."
    });

    expect(
      selectProductionNextStep({
        hasFocusedProductionSpec: true,
        questionCount: 2,
        hasSourceWarnings: true,
        hasSelectedPlan: false,
        purchaseListCount: 0
      })
    ).toEqual({
      title: "Quellenprüfung und Rückfragen klären",
      description: "Die Quelle wurde nur unsicher verarbeitet. Bitte Quelle prüfen und offene Rückfragen beantworten."
    });

    expect(
      selectProductionNextStep({
        hasFocusedProductionSpec: true,
        questionCount: 0,
        hasSelectedPlan: true,
        purchaseListCount: 1
      })
    ).toEqual({
      title: "Produktionsarbeit prüfen",
      description: "Produktionsplan und Einkaufsliste liegen vor. Bitte Mengen, Rezeptquellen und Freigabegrenzen prüfen."
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
