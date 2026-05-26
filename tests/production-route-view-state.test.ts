import { describe, expect, it } from "vitest";
import { buildProductionRouteViewState } from "../backoffice-ui/src/production-route-view-state.js";

describe("production route view state", () => {
  it("maps existing production route values into panel state objects without recomputing behavior", () => {
    const focusedSpec = { specId: "spec-1", eventType: "Lunch" };
    const selectedPlan = { planId: "plan-1", eventSpecId: "spec-1" };
    const currentPlan = { planId: "plan-current", eventSpecId: "spec-1" };
    const currentPurchaseList = { purchaseListId: "purchase-1", eventSpecId: "spec-1" };
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
});
