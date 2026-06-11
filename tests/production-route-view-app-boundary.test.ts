import { describe, expect, it } from "vitest";
import {
  buildProductionRouteViewAppBoundary,
  type ProductionRouteViewAppBoundaryInput
} from "../backoffice-ui/src/production-route-view-app-boundary.js";

function input(
  overrides: Partial<ProductionRouteViewAppBoundaryInput> = {}
): ProductionRouteViewAppBoundaryInput {
  return {
    currentSpecPlans: [],
    currentSpecPurchaseLists: [],
    productionQuestions: [],
    filteredAuditEvents: [],
    productionWorkspaceCleared: false,
    clarificationStatusCounts: { answered: 0, unanswered: 0 },
    productionAssumptions: [],
    productionConversationProjection: { sessionId: "session-empty", messages: [] },
    workbenchSpecFacts: [],
    intakeRequestDetail: null,
    filteredSpecs: [],
    documentPhase: "idle",
    planPhase: "idle",
    planProgress: 0,
    selectedPlanComponentsById: new Map(),
    archivedPlans: [],
    specById: new Map(),
    archivedPurchaseLists: [],
    recipeReviewStatusLabel: "keine offene Prüfung",
    recipeUsageStatusLabel: "Noch keine freigegebenen Rezepte im Bestand",
    recipeReviewCounts: { approved: 0, reviewRequired: 0, rejected: 0 },
    recipeCount: 0,
    recipeName: "",
    recipeFile: null,
    filteredRecipes: [],
    ...overrides
  };
}

describe("production route view app boundary", () => {
  it("builds status summary and route view from one App-visible production state boundary", () => {
    const focusedSpec = {
      specId: "spec-1",
      readiness: { status: "partial" },
      event: { type: "lunch", date: "2026-06-01" },
      attendees: { expected: 80 }
    };
    const selectedPlan = {
      planId: "plan-1",
      eventSpecId: "spec-1",
      readiness: { status: "complete" }
    };
    const currentPurchaseList = {
      purchaseListId: "purchase-1",
      eventSpecId: "spec-1",
      totals: { itemCount: 7 }
    };
    const boundary = buildProductionRouteViewAppBoundary(
      input({
        focusedProductionSpec: focusedSpec,
        selectedPlan,
        selectedPlanSpec: focusedSpec,
        currentSpecPlans: [selectedPlan],
        currentSpecPurchaseLists: [currentPurchaseList],
        productionQuestions: ["Teilnehmerzahl bestätigen"],
        clarificationStatusCounts: { answered: 1, unanswered: 0 },
        filteredAuditEvents: [
          {
            auditId: "audit-1",
            at: "2026-05-21T10:00:00.000Z",
            action: "production.plan.created",
            summary: "Produktionsplan erstellt",
            actor: { name: "Küche" }
          }
        ],
        intakeRequestDetail: {
          requestId: "request-1",
          source: { channel: "text", receivedAt: "2026-05-26T01:00:00.000Z" }
        },
        currentIntakeRequestId: "request-fallback",
        productionConversationProjection: { sessionId: "session-spec-1", messages: [] },
        workbenchSpecFacts: [{ label: "Pax", value: "80" }],
        filteredSpecs: [focusedSpec],
        documentPhase: "done",
        planPhase: "done",
        planningSpecLabel: "Lunch · 80 Pax",
        planProgress: 100,
        planEtaSeconds: 0,
        selectedPlanComponentsById: new Map([["component-1", { componentId: "component-1" }]]),
        archivedPlans: [{ planId: "plan-old", eventSpecId: "spec-1" }],
        specById: new Map([["spec-1", focusedSpec]]),
        archivedPurchaseLists: [{ purchaseListId: "purchase-old", eventSpecId: "spec-1" }],
        recipeReviewStatusLabel: "1 zu prüfen",
        recipeUsageStatusLabel: "Freigegebene Rezepte bleiben verwendbar",
        recipeReviewCounts: { approved: 2, reviewRequired: 1, rejected: 0 },
        recipeCount: 3,
        recipeName: "Neues Rezept",
        filteredRecipes: [{ recipeId: "recipe-1" }]
      })
    );

    expect(boundary.productionStatusSummary).toMatchObject({
      activeProductionContextLabel: "Lunch · 80 Teilnehmer · 2026-06-01",
      focusedSpecReadinessLabel: "teilweise vollständig",
      selectedPlanReadinessLabel: "vollständig",
      productionPlanStatusLabel: "vollständig",
      productionObjectStatusLabel: "1 Plan · vollständig",
      purchaseZoneStatusLabel: "1 Liste · 7 Positionen",
      productionIntakeOriginLabel: "text · 2026-05-26T01:00:00.000Z · request-1",
      productionHandoffContextLabel: "planId plan-1 · specId spec-1 · purchaseListId purchase-1"
    });
    expect(boundary.productionRouteViewState.workbenchSummary).toMatchObject({
      activeSpecLabel: "Lunch · 80 Teilnehmer · 2026-06-01",
      readinessLabel: "teilweise vollständig",
      planStatusLabel: "vollständig",
      purchaseStatusLabel: "1 Liste · 7 Positionen",
      questionCount: 1,
      answeredQuestionCount: 1,
      unansweredQuestionCount: 0
    });
    expect(boundary.productionRouteViewState.workbenchNextStep.title).toBe("Rückfragen beantworten");
    expect(boundary.productionRouteViewState.handoffState.contextLabel).toBe(
      boundary.productionStatusSummary.productionHandoffContextLabel
    );
    expect(boundary.productionRouteViewState.recipeStatus.recipeReviewCounts.reviewRequired).toBe(1);
  });

  it("keeps cleared workspaces free from stale intake and handoff state", () => {
    const boundary = buildProductionRouteViewAppBoundary(
      input({
        productionWorkspaceCleared: true,
        intakeRequestDetail: {
          requestId: "request-stale",
          source: { channel: "pdf_upload", receivedAt: "2026-05-26T01:00:00.000Z" },
          rawInputs: []
        },
        currentIntakeRequestId: "request-stale",
        filteredSpecs: [{ specId: "spec-stale" }],
        intakeRequestDetailError: "stale detail should not leak"
      })
    );

    expect(boundary.productionStatusSummary).toMatchObject({
      activeProductionContextLabel: "Kein aktiver Vorgang",
      productionIntakeOriginLabel: "kein Intake-Ursprung verknüpft",
      productionHandoffContextLabel: undefined
    });
    expect(boundary.productionRouteViewState.questionState.focusedProductionSpec).toBeUndefined();
    expect(boundary.productionRouteViewState.questionState.intakeRequestDetail).toBeNull();
    expect(boundary.productionRouteViewState.questionState.intakeRequestDetailError).toBeUndefined();
    expect(boundary.productionRouteViewState.questionState.filteredSpecs).toEqual([]);
    expect(boundary.productionRouteViewState.handoffState.intakeOriginLabel).toBe(
      "kein Intake-Ursprung verknüpft"
    );
  });
});
