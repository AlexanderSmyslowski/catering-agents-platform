import { describe, expect, it } from "vitest";
import { buildProductionRouteViewState } from "../backoffice-ui/src/production-route-view-state.js";

describe("production route view state", () => {
  it("maps existing production route values into panel state objects without recomputing behavior", () => {
    const focusedSpec = { specId: "spec-1", eventType: "Lunch" };
    const selectedPlan = {
      planId: "plan-1",
      eventSpecId: "spec-1",
      productionBatches: [{ batchId: "batch-1" }],
      kitchenSheets: [{ title: "Küchenblatt 1" }, { title: "Küchenblatt 2" }],
      recipeSelections: [{ recipeId: "recipe-1" }]
    };
    const currentPlan = { planId: "plan-current", eventSpecId: "spec-1" };
    const currentPurchaseList = { purchaseListId: "purchase-1", eventSpecId: "spec-1", items: [{ sku: "metro-1" }] };
    const specById = new Map([["spec-1", focusedSpec]]);
    const selectedPlanComponentsById = new Map([["component-1", { componentId: "component-1" }]]);

    const viewState = buildProductionRouteViewState({
      activeProductionContextLabel: "Lunch · 42 Pax",
      focusedSpecReadinessLabel: "vollständig",
      productionPlanStatusLabel: "Plan bereit",
      purchaseZoneStatusLabel: "1 Liste",
      productionQuestions: ["Pax bestätigen?"],
      clarificationStatusCounts: { answered: 1, unanswered: 0 },
      currentSpecPlans: [currentPlan],
      productionObjectStatusLabel: "1 Plan",
      currentSpecPurchaseLists: [currentPurchaseList],
      productionNextStep: { title: "Plan prüfen", description: "Ergebnisse kontrollieren." },
      focusedProductionSpec: focusedSpec,
      selectedPlan,
      selectedPlanReadinessLabel: "vollständig",
      productionAssumptions: ["Brot als Zukauf"],
      productionConversationProjection: { sessionId: "session-spec-1", messages: [] },
      workbenchSpecFacts: [{ label: "Pax", value: "42" }],
      intakeRequestDetailError: undefined,
      intakeRequestDetail: null,
      filteredSpecs: [focusedSpec],
      documentPhase: "done",
      productionWorkspaceCleared: false,
      planPhase: "done",
      planningSpecLabel: "Lunch · 42 Pax",
      planProgress: 100,
      planEtaSeconds: 0,
      selectedPlanSpec: focusedSpec,
      selectedPlanComponentsById,
      archivedPlans: [{ planId: "plan-old" }],
      specById,
      archivedPurchaseLists: [{ purchaseListId: "purchase-old" }],
      productionIntakeOriginLabel: "PDF-Upload",
      productionAuditTrailLabel: "Audit geladen",
      productionHandoffExportLabel: "Plan und Einkaufsliste",
      productionHandoffContextLabel: "planId plan-1",
      recipeReviewStatusLabel: "1 zu prüfen",
      recipeUsageStatusLabel: "Freigegebene Rezepte bleiben verwendbar",
      recipeReviewCounts: { approved: 2, reviewRequired: 1, rejected: 0 },
      recipeCount: 3,
      recipeName: "Neues Rezept",
      recipeFile: null,
      filteredRecipes: [{ recipeId: "recipe-1" }]
    });

    expect(viewState.workbenchSummary).toEqual({
      activeSpecLabel: "Lunch · 42 Pax",
      activeTechnicalContextLabel: undefined,
      specFacts: [{ label: "Pax", value: "42" }],
      assuranceFacts: [
        { label: "Herkunft", value: "PDF-Upload" },
        { label: "Freigabe", value: "nicht erteilt" }
      ],
      dossierMetrics: {
        answeredQuestionCount: 1,
        questionPreview: "Pax bestätigen?",
        assumptionCount: 1,
        assumptionPreview: "Brot als Zukauf",
        productionBatchCount: 1,
        kitchenSheetCount: 2,
        recipeSelectionCount: 1,
        purchaseItemCount: 1,
        exportStatusLabel: "Plan und Einkaufsliste"
      },
      readinessLabel: "vollständig",
      planStatusLabel: "Plan bereit",
      purchaseStatusLabel: "1 Liste",
      questionCount: 1,
      answeredQuestionCount: 1,
      unansweredQuestionCount: 0,
      productionObjectCount: 1,
      productionObjectStatusLabel: "1 Plan",
      purchaseListCount: 1
    });
    expect(viewState.workbenchNextStep.title).toBe("Plan prüfen");
    expect(viewState.questionState.focusedProductionSpec).toBe(focusedSpec);
    expect(viewState.questionState.currentSpecPurchaseLists).toBe(viewState.purchaseListState.currentPurchaseLists);
    expect(viewState.objectPanelState.selectedPlanComponentsById).toBe(selectedPlanComponentsById);
    expect(viewState.objectPanelState.specById).toBe(specById);
    expect(viewState.purchaseListState.statusLabel).toBe("1 Liste");
    expect(viewState.handoffState.contextLabel).toBe("planId plan-1");
    expect(viewState.recipeStatus.recipeReviewCounts.reviewRequired).toBe(1);
    expect(viewState.recipeUpload.recipeName).toBe("Neues Rezept");
    expect(viewState.recipeLibrary.filteredRecipes).toEqual([{ recipeId: "recipe-1" }]);
  });

  it("does not pass stale intake detail into the question panel after workspace clear", () => {
    const stalePlan = { planId: "plan-stale", eventSpecId: "spec-stale" };
    const stalePurchaseList = { purchaseListId: "purchase-stale", eventSpecId: "spec-stale" };
    const staleComponentMap = new Map([["component-stale", { componentId: "component-stale" }]]);
    const viewState = buildProductionRouteViewState({
      activeProductionContextLabel: "Kein aktiver Vorgang",
      focusedSpecReadinessLabel: "-",
      productionPlanStatusLabel: "offen",
      purchaseZoneStatusLabel: "noch keine Liste",
      productionQuestions: [],
      clarificationStatusCounts: { answered: 0, unanswered: 0 },
      currentSpecPlans: [stalePlan],
      productionObjectStatusLabel: "noch kein Plan",
      currentSpecPurchaseLists: [stalePurchaseList],
      productionNextStep: {
        title: "Auftrag einfügen oder Datei ablegen",
        description: "Neuen Produktionskontext starten."
      },
      selectedPlan: stalePlan,
      selectedPlanSpec: { specId: "spec-stale" },
      productionAssumptions: [],
      productionConversationProjection: { sessionId: "session-cleared", messages: [] },
      workbenchSpecFacts: [],
      intakeRequestDetailError: "stale detail should not leak",
      intakeRequestDetail: {
        requestId: "request-stale",
        source: { channel: "pdf_upload", receivedAt: "2026-05-26T01:00:00.000Z" },
        rawInputs: []
      },
      filteredSpecs: [{ specId: "spec-stale" }],
      documentPhase: "done",
      productionWorkspaceCleared: true,
      planPhase: "idle",
      planProgress: 0,
      selectedPlanComponentsById: staleComponentMap,
      archivedPlans: [{ planId: "plan-archived-stale" }],
      specById: new Map(),
      archivedPurchaseLists: [{ purchaseListId: "purchase-archived-stale" }],
      productionIntakeOriginLabel: "kein Intake-Ursprung verknüpft",
      productionAuditTrailLabel: "keine Audit-Ereignisse geladen",
      productionHandoffExportLabel: "Produktionsblatt offen · Einkaufsliste offen",
      recipeReviewStatusLabel: "keine offene Prüfung",
      recipeUsageStatusLabel: "Noch keine freigegebenen Rezepte im Bestand",
      recipeReviewCounts: { approved: 0, reviewRequired: 0, rejected: 0 },
      recipeCount: 0,
      recipeName: "",
      recipeFile: null,
      filteredRecipes: []
    });

    expect(viewState.questionState.productionWorkspaceCleared).toBe(true);
    expect(viewState.questionState.focusedProductionSpec).toBeUndefined();
    expect(viewState.questionState.selectedPlan).toBeUndefined();
    expect(viewState.questionState.currentSpecPurchaseLists).toEqual([]);
    expect(viewState.questionState.intakeRequestDetail).toBeNull();
    expect(viewState.questionState.intakeRequestDetailError).toBeUndefined();
    expect(viewState.questionState.filteredSpecs).toEqual([]);
    expect(viewState.workbenchSummary.productionObjectCount).toBe(0);
    expect(viewState.workbenchSummary.purchaseListCount).toBe(0);
    expect(viewState.objectPanelState.currentSpecPlans).toEqual([]);
    expect(viewState.objectPanelState.selectedPlan).toBeUndefined();
    expect(viewState.objectPanelState.selectedPlanSpec).toBeUndefined();
    expect(viewState.objectPanelState.selectedPlanComponentsById.size).toBe(0);
    expect(viewState.objectPanelState.archivedPlans).toEqual([]);
    expect(viewState.purchaseListState.currentPurchaseLists).toEqual([]);
    expect(viewState.purchaseListState.archivedPurchaseLists).toEqual([]);
    expect(viewState.handoffState.intakeOriginLabel).toBe("kein Intake-Ursprung verknüpft");
  });
});
