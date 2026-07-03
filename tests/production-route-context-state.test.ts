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
        selectedPlanReadinessLabel: "vollständig",
        purchaseListCount: 1
      })
    ).toEqual({
      title: "Produktionsarbeit prüfen",
      description: "Produktionsplan und Einkaufsliste liegen vor. Bitte Mengen, Rezeptquellen und Freigabegrenzen prüfen."
    });
  });

  it("does not claim production work is ready when plan or purchase data is still insufficient", () => {
    expect(
      selectProductionNextStep({
        hasFocusedProductionSpec: true,
        questionCount: 0,
        hasSelectedPlan: true,
        selectedPlanReadinessLabel: "unzureichend",
        purchaseListCount: 1,
        purchaseItemCount: 0
      })
    ).toEqual({
      title: "Produktionsplan nacharbeiten",
      description: "Der Produktionsplan ist unzureichend. Bitte offene Punkte, Rezeptquellen und Mengen klären."
    });

    expect(
      selectProductionNextStep({
        hasFocusedProductionSpec: true,
        questionCount: 0,
        hasSelectedPlan: true,
        selectedPlanReadinessLabel: "vollständig",
        purchaseListCount: 1,
        purchaseItemCount: 0
      })
    ).toEqual({
      title: "Einkaufspositionen klären",
      description: "Einkaufsliste ist vorhanden, enthält aber noch keine Positionen für die Produktion."
    });
  });

  it("prioritizes visible artifact blockers over remaining questions once a plan exists", () => {
    expect(
      selectProductionNextStep({
        hasFocusedProductionSpec: true,
        questionCount: 1,
        hasSelectedPlan: true,
        selectedPlanReadinessLabel: "vollständig",
        purchaseListCount: 1,
        purchaseItemCount: 0
      })
    ).toEqual({
      title: "Einkaufspositionen klären",
      description: "Einkaufsliste ist vorhanden, enthält aber noch keine Positionen für die Produktion."
    });

    expect(
      selectProductionNextStep({
        hasFocusedProductionSpec: true,
        questionCount: 1,
        hasSelectedPlan: true,
        selectedPlanReadinessLabel: "vollständig",
        purchaseListCount: 1,
        purchaseItemCount: 3
      })
    ).toEqual({
      title: "Rückfragen beantworten",
      description: "Die Produktion braucht noch strukturierte Antworten, bevor Ergebnisse belastbar sind."
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
