import { describe, expect, it } from "vitest";
import {
  canClearProductionWorkspace,
  formatActiveProductionContextLabel,
  selectArchivedProductionItems,
  selectCurrentProductionItems,
  selectFocusedProductionSpec,
  selectProductionNextStep
} from "../backoffice-ui/src/production-route-state.js";

describe("production route state", () => {
  const acceptedSpecs = [
    { specId: "spec-old", label: "old" },
    { specId: "spec-current", label: "current" },
    { specId: "spec-other", label: "other" }
  ];

  it("clears the focused production spec when the workspace is cleared", () => {
    expect(
      selectFocusedProductionSpec({
        acceptedSpecs,
        filteredSpecs: acceptedSpecs,
        focusedProductionSpecId: "spec-current",
        productionWorkspaceCleared: true,
        route: "production",
        searchText: ""
      })
    ).toBeUndefined();
  });

  it("keeps active production search constrained to filtered specs", () => {
    const filteredSpecs = [{ specId: "spec-current", label: "current" }];

    expect(
      selectFocusedProductionSpec({
        acceptedSpecs,
        filteredSpecs,
        focusedProductionSpecId: "spec-other",
        productionWorkspaceCleared: false,
        route: "production",
        searchText: "current"
      })
    ).toBe(filteredSpecs[0]);
  });

  it("falls back to the latest accepted spec when production search is not active", () => {
    expect(
      selectFocusedProductionSpec({
        acceptedSpecs,
        filteredSpecs: [],
        productionWorkspaceCleared: false,
        route: "home",
        searchText: ""
      })
    ).toBe(acceptedSpecs[2]);
  });

  it("splits current and archived production items by focused spec", () => {
    const items = [
      { id: "plan-a", eventSpecId: "spec-current" },
      { id: "plan-b", eventSpecId: "spec-other" },
      { id: "plan-c", eventSpecId: "spec-current" }
    ];

    expect(
      selectCurrentProductionItems({
        currentProductionSpecId: "spec-current",
        items,
        productionWorkspaceCleared: false
      }).map((item) => item.id)
    ).toEqual(["plan-a", "plan-c"]);
    expect(
      selectArchivedProductionItems({
        currentProductionSpecId: "spec-current",
        items,
        productionWorkspaceCleared: false
      }).map((item) => item.id)
    ).toEqual(["plan-b"]);
  });

  it("keeps production item selectors empty when the workspace is cleared", () => {
    const items = [{ id: "plan-a", eventSpecId: "spec-current" }];

    expect(
      selectCurrentProductionItems({
        currentProductionSpecId: "spec-current",
        items,
        productionWorkspaceCleared: true
      })
    ).toEqual([]);
    expect(
      selectArchivedProductionItems({
        currentProductionSpecId: "spec-current",
        items,
        productionWorkspaceCleared: true
      })
    ).toEqual([]);
  });

  it("keeps the previous unscoped production item fallback when no spec is focused", () => {
    const items = [
      { id: "plan-a", eventSpecId: "spec-current" },
      { id: "plan-b", eventSpecId: "spec-other" }
    ];

    expect(
      selectCurrentProductionItems({
        currentProductionSpecId: "",
        items,
        productionWorkspaceCleared: false
      })
    ).toBe(items);
    expect(
      selectArchivedProductionItems({
        currentProductionSpecId: "",
        items,
        productionWorkspaceCleared: false
      })
    ).toEqual([]);
  });

  it("selects the existing production next-step sequence", () => {
    expect(
      selectProductionNextStep({
        hasFocusedProductionSpec: false,
        questionCount: 0,
        hasSelectedPlan: false,
        purchaseListCount: 0
      }).title
    ).toBe("Auftrag einfügen oder Datei ablegen");
    expect(
      selectProductionNextStep({
        hasFocusedProductionSpec: true,
        questionCount: 2,
        hasSelectedPlan: false,
        purchaseListCount: 0
      }).title
    ).toBe("Rückfragen beantworten");
    expect(
      selectProductionNextStep({
        hasFocusedProductionSpec: true,
        questionCount: 0,
        hasSelectedPlan: false,
        purchaseListCount: 0
      }).title
    ).toBe("Produktionsplan berechnen");
    expect(
      selectProductionNextStep({
        hasFocusedProductionSpec: true,
        questionCount: 0,
        hasSelectedPlan: true,
        purchaseListCount: 0
      }).title
    ).toBe("Einkaufsliste noch offen");
    expect(
      selectProductionNextStep({
        hasFocusedProductionSpec: true,
        questionCount: 0,
        hasSelectedPlan: true,
        purchaseListCount: 1
      }).title
    ).toBe("Produktionsobjekte und Downloads prüfen");
  });

  it("formats the existing active production context labels", () => {
    expect(
      formatActiveProductionContextLabel({
        focusedProductionSpecLabel: "Lunch · 80 Teilnehmer · 2026-03-04",
        productionWorkspaceCleared: false
      })
    ).toBe("Lunch · 80 Teilnehmer · 2026-03-04");
    expect(
      formatActiveProductionContextLabel({
        selectedPlan: { planId: "plan-123" },
        productionWorkspaceCleared: false
      })
    ).toBe("Plan-Kontext geladen: plan-123 · Spezifikation noch nicht im Fokus");
    expect(
      formatActiveProductionContextLabel({
        productionWorkspaceCleared: true
      })
    ).toBe("Kein aktiver Vorgang");
    expect(
      formatActiveProductionContextLabel({
        productionWorkspaceCleared: false
      })
    ).toBe("Noch kein aktiver Vorgang");
  });

  it("keeps the existing clear-workspace affordance conditions", () => {
    const idleInput = {
      hasFocusedProductionSpec: false,
      hasSelectedPlan: false,
      hasIntakeFile: false,
      hasActiveDocumentName: false,
      documentPhase: "idle",
      planPhase: "idle",
      hasFocusedProductionSpecId: false,
      hasSelectedPlanId: false
    };

    expect(canClearProductionWorkspace(idleInput)).toBe(false);
    expect(canClearProductionWorkspace({ ...idleInput, hasFocusedProductionSpec: true })).toBe(true);
    expect(canClearProductionWorkspace({ ...idleInput, hasSelectedPlan: true })).toBe(true);
    expect(canClearProductionWorkspace({ ...idleInput, hasIntakeFile: true })).toBe(true);
    expect(canClearProductionWorkspace({ ...idleInput, hasActiveDocumentName: true })).toBe(true);
    expect(canClearProductionWorkspace({ ...idleInput, documentPhase: "analysing" })).toBe(true);
    expect(canClearProductionWorkspace({ ...idleInput, planPhase: "planning" })).toBe(true);
    expect(canClearProductionWorkspace({ ...idleInput, hasFocusedProductionSpecId: true })).toBe(true);
    expect(canClearProductionWorkspace({ ...idleInput, hasSelectedPlanId: true })).toBe(true);
  });
});
