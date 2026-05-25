import { describe, expect, it } from "vitest";
import {
  canClearProductionWorkspace,
  countPurchaseListItems,
  formatActiveProductionContextLabel,
  formatProductionHandoffContextLabel,
  formatProductionHandoffExportLabel,
  formatProductionIntakeOriginLabel,
  formatPurchaseZoneStatusLabel,
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

  it("counts purchase list items from totals or item arrays", () => {
    expect(
      countPurchaseListItems([
        { totals: { itemCount: 3 }, items: [{}, {}] },
        { items: [{}, {}, {}] },
        { totals: { itemCount: "invalid" } }
      ])
    ).toBe(6);
  });

  it("formats purchase zone and handoff export labels", () => {
    expect(formatPurchaseZoneStatusLabel({ purchaseListCount: 0, itemCount: 0 })).toBe("noch keine Liste");
    expect(formatPurchaseZoneStatusLabel({ purchaseListCount: 1, itemCount: 4 })).toBe("1 Liste · 4 Positionen");
    expect(formatPurchaseZoneStatusLabel({ purchaseListCount: 2, itemCount: 9 })).toBe("2 Listen · 9 Positionen");

    expect(formatProductionHandoffExportLabel({ hasSelectedPlan: false, purchaseListCount: 0 })).toBe(
      "Produktionsblatt offen · Einkaufsliste offen"
    );
    expect(formatProductionHandoffExportLabel({ hasSelectedPlan: true, purchaseListCount: 1 })).toBe(
      "Produktionsblatt vorhanden · Einkaufsliste vorhanden"
    );
  });

  it("formats intake origin and handoff context labels", () => {
    expect(
      formatProductionIntakeOriginLabel({
        intakeRequestDetail: {
          requestId: "request-1",
          source: { channel: "text", receivedAt: "2026-05-26T01:00:00.000Z" }
        }
      })
    ).toBe("text · 2026-05-26T01:00:00.000Z · request-1");
    expect(formatProductionIntakeOriginLabel({ currentIntakeRequestId: "request-2" })).toBe(
      "Intake-Anfrage request-2"
    );
    expect(formatProductionIntakeOriginLabel({})).toBe("kein Intake-Ursprung verknüpft");

    expect(
      formatProductionHandoffContextLabel({
        selectedPlan: { planId: "plan-1", eventSpecId: "spec-1" },
        selectedPlanSpec: { specId: "spec-fallback" },
        purchaseLists: [{ purchaseListId: "purchase-1" }]
      })
    ).toBe("planId plan-1 · specId spec-1 · purchaseListId purchase-1");
    expect(
      formatProductionHandoffContextLabel({
        selectedPlan: { planId: "plan-2" },
        selectedPlanSpec: { specId: "spec-fallback" },
        purchaseLists: []
      })
    ).toBe("planId plan-2 · specId spec-fallback");
    expect(formatProductionHandoffContextLabel({ purchaseLists: [] })).toBeUndefined();
  });
});
