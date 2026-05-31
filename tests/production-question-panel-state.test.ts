import { describe, expect, it } from "vitest";
import { buildProductionQuestionPanelState } from "../backoffice-ui/src/production-question-panel-state.js";
import type { ProductionQuestionPanelStateInput } from "../backoffice-ui/src/production-question-panel-state.js";

function input(
  overrides: Partial<ProductionQuestionPanelStateInput> = {}
): ProductionQuestionPanelStateInput {
  return {
    focusedProductionSpec: { specId: "spec-1" },
    focusedSpecReadinessLabel: "teilweise vollständig",
    selectedPlan: { planId: "plan-1" },
    selectedPlanReadinessLabel: "vollständig",
    currentSpecPurchaseLists: [{ purchaseListId: "purchase-1" }],
    productionQuestions: ["Bitte Pax bestätigen."],
    productionAssumptions: ["Brot als Zukauf."],
    productionConversationProjection: { sessionId: "session-spec-1", messages: [] },
    workbenchSpecFacts: [{ label: "Pax", value: "42" }],
    intakeRequestDetailError: "Detail konnte nicht geladen werden.",
    intakeRequestDetail: {
      requestId: "request-1",
      source: { channel: "pdf_upload", receivedAt: "2026-05-26T01:00:00.000Z" },
      rawInputs: []
    },
    filteredSpecs: [{ specId: "spec-1" }],
    documentPhase: "done",
    productionWorkspaceCleared: false,
    ...overrides
  };
}

describe("production question panel state", () => {
  it("passes through active question panel context while the workspace is current", () => {
    const state = buildProductionQuestionPanelState(input());

    expect(state.focusedProductionSpec).toEqual({ specId: "spec-1" });
    expect(state.selectedPlan).toEqual({ planId: "plan-1" });
    expect(state.currentSpecPurchaseLists).toEqual([{ purchaseListId: "purchase-1" }]);
    expect(state.productionQuestions).toEqual(["Bitte Pax bestätigen."]);
    expect(state.productionAssumptions).toEqual(["Brot als Zukauf."]);
    expect(state.productionConversationProjection.sessionId).toBe("session-spec-1");
    expect(state.workbenchSpecFacts).toEqual([{ label: "Pax", value: "42" }]);
    expect(state.intakeRequestDetail?.requestId).toBe("request-1");
    expect(state.intakeRequestDetailError).toBe("Detail konnte nicht geladen werden.");
    expect(state.filteredSpecs).toEqual([{ specId: "spec-1" }]);
    expect(state.documentPhase).toBe("done");
    expect(state.productionWorkspaceCleared).toBe(false);
  });

  it("masks stale intake detail and stale spec choices after a local workspace clear", () => {
    const state = buildProductionQuestionPanelState(input({ productionWorkspaceCleared: true }));

    expect(state.productionWorkspaceCleared).toBe(true);
    expect(state.intakeRequestDetail).toBeNull();
    expect(state.intakeRequestDetailError).toBeUndefined();
    expect(state.filteredSpecs).toEqual([]);
    expect(state.focusedProductionSpec).toEqual({ specId: "spec-1" });
    expect(state.productionQuestions).toEqual(["Bitte Pax bestätigen."]);
  });
});
