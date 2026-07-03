import { describe, expect, it } from "vitest";
import {
  buildProductionObjectsPanelState,
  formatProductionObjectsEta
} from "../backoffice-ui/src/production-objects-panel-state.js";

describe("production objects panel state", () => {
  it("maps planning progress into stable progress labels and clamps the percentage", () => {
    const state = buildProductionObjectsPanelState({
      progressState: {
        planPhase: "planning",
        planningSpecLabel: "Lunch · 42 Pax",
        planProgress: 140,
        planEtaSeconds: 9
      },
      objectsState: {
        focusedProductionSpec: {
          specId: "spec-1",
          event: { type: "lunch", date: "2026-06-18" },
          attendees: { expected: 42 }
        },
        productionWorkspaceCleared: false,
        currentSpecPlans: [],
        selectedPlan: undefined,
        selectedPlanSpec: undefined,
        selectedPlanComponentsById: new Map(),
        archivedPlans: [],
        specById: new Map()
      }
    });

    expect(state.showPlanningProgress).toBe(true);
    expect(state.showDoneProgress).toBe(false);
    expect(state.clampedPlanProgress).toBe(100);
    expect(state.currentRunTitle).toBe("Lunch · 42 Teilnehmer · 2026-06-18");
    expect(state.showCurrentPlans).toBe(true);
  });

  it("keeps the cleared workspace title and helper text explicit", () => {
    const state = buildProductionObjectsPanelState({
      progressState: {
        planPhase: "idle",
        planProgress: 0
      },
      objectsState: {
        focusedProductionSpec: undefined,
        productionWorkspaceCleared: true,
        currentSpecPlans: [],
        selectedPlan: { planId: "plan-stale" },
        selectedPlanSpec: undefined,
        selectedPlanComponentsById: new Map(),
        archivedPlans: [],
        specById: new Map()
      }
    });

    expect(state.currentRunTitle).toBe("Kein aktiver Vorgang");
    expect(state.currentRunHelperText).toContain("Die Ergebnisfelder wurden geleert.");
    expect(state.showCurrentPlans).toBe(false);
    expect(state.showSelectedPlanDetails).toBe(true);
    expect(state.showArchivedPlans).toBe(false);
  });

  it("keeps the fallback title explicit when no focused spec exists and the workspace is still active", () => {
    const state = buildProductionObjectsPanelState({
      progressState: {
        planPhase: "done",
        planningSpecLabel: "Buffet",
        planProgress: 100
      },
      objectsState: {
        focusedProductionSpec: undefined,
        productionWorkspaceCleared: false,
        currentSpecPlans: [],
        selectedPlan: undefined,
        selectedPlanSpec: undefined,
        selectedPlanComponentsById: new Map(),
        archivedPlans: [],
        specById: new Map()
      }
    });

    expect(state.showPlanningProgress).toBe(false);
    expect(state.showDoneProgress).toBe(true);
    expect(state.doneProgressHelperLabel).toBe(
      "Produktionsplan und Produktionsschritte wurden aktualisiert; Einkaufspositionen bleiben offen."
    );
    expect(state.currentRunTitle).toBe("Neuester Produktionslauf");
    expect(state.currentRunHelperText).toContain("Ältere geladene Läufe");
  });

  it("keeps the completed progress copy honest for empty and populated purchase lists", () => {
    expect(
      buildProductionObjectsPanelState({
        progressState: {
          planPhase: "done",
          planningSpecLabel: "Konferenz",
          planProgress: 100
        },
        purchaseStatusLabel: "1 Liste ohne Positionen",
        objectsState: {
          focusedProductionSpec: undefined,
          productionWorkspaceCleared: false,
          currentSpecPlans: [],
          selectedPlan: undefined,
          selectedPlanSpec: undefined,
          selectedPlanComponentsById: new Map(),
          archivedPlans: [],
          specById: new Map()
        }
      }).doneProgressHelperLabel
    ).toBe("Produktionsplan und Produktionsschritte wurden aktualisiert; Einkaufspositionen bleiben offen.");

    expect(
      buildProductionObjectsPanelState({
        progressState: {
          planPhase: "done",
          planningSpecLabel: "Konferenz",
          planProgress: 100
        },
        purchaseStatusLabel: "Einkaufslisten werden geladen",
        objectsState: {
          focusedProductionSpec: undefined,
          productionWorkspaceCleared: false,
          currentSpecPlans: [],
          selectedPlan: undefined,
          selectedPlanSpec: undefined,
          selectedPlanComponentsById: new Map(),
          archivedPlans: [],
          specById: new Map()
        }
      }).doneProgressHelperLabel
    ).toBe("Produktionsplan und Produktionsschritte wurden aktualisiert; Einkaufspositionen bleiben offen.");

    expect(
      buildProductionObjectsPanelState({
        progressState: {
          planPhase: "done",
          planningSpecLabel: "Konferenz",
          planProgress: 100
        },
        purchaseStatusLabel: "1 Liste · 4 Positionen",
        objectsState: {
          focusedProductionSpec: undefined,
          productionWorkspaceCleared: false,
          currentSpecPlans: [],
          selectedPlan: undefined,
          selectedPlanSpec: undefined,
          selectedPlanComponentsById: new Map(),
          archivedPlans: [],
          specById: new Map()
        }
      }).doneProgressHelperLabel
    ).toBe("Die Rezepte, Produktionsschritte und Einkaufspositionen wurden aktualisiert.");
  });
});

describe("formatProductionObjectsEta", () => {
  it("keeps the sub-second and regular eta labels stable", () => {
    expect(formatProductionObjectsEta(0)).toBe("weniger als 1 Sekunde");
    expect(formatProductionObjectsEta(7)).toBe("7 Sekunden");
  });
});
