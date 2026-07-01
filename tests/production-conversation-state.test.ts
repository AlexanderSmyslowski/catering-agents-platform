import { describe, expect, it } from "vitest";
import { buildProductionConversationState } from "../backoffice-ui/src/production-conversation-state.js";

describe("production conversation state", () => {
  const focusedProductionSpec = {
    specId: "spec-conversation",
    readiness: { status: "partial" },
    event: { type: "lunch", date: "2026-06-01" },
    attendees: {},
    servicePlan: { serviceForm: "buffet" },
    menuPlan: [
      {
        componentId: "component-main",
        label: "Hauptgang",
        productionDecision: { mode: "scratch" }
      }
    ],
    assumptions: [
      {
        code: "service_form_defaulted",
        message: "Serviceform aus dem Anfragetext abgeleitet: Buffet.",
        applied: true
      }
    ],
    missingFields: ["attendees.expected"]
  };
  const productionPlan = {
    planId: "plan-conversation",
    eventSpecId: "spec-conversation"
  };
  const purchaseList = {
    purchaseListId: "purchase-conversation",
    eventSpecId: "spec-conversation",
    items: [{ displayName: "Brot" }]
  };

  it("builds questions, assumptions, projection and workbench facts together", () => {
    const state = buildProductionConversationState({
      focusedProductionSpec,
      focusedProductionSpecRecord: focusedProductionSpec,
      intakeRequestDetail: {
        requestId: "request-conversation",
        rawInputs: [
          {
            kind: "pdf",
            documentId: "document-conversation",
            sourceMetadata: {
              filename: "angebot-conversation.pdf",
              mimeType: "application/pdf",
              sizeBytes: 2048,
              sha256: "aaaaaaaaaaaabbbbbbbbbbbbccccccccccccddddddddddddeeeeeeeeeeeeffffffff",
              ingestedAt: "2026-05-21T09:00:00.000Z",
              uploadContext: "intake"
            }
          }
        ]
      },
      currentSpecPlans: [productionPlan],
      currentSpecPurchaseLists: [purchaseList]
    });

    expect(state.productionQuestions).toContain(
      "Mit welcher verbindlichen Teilnehmerzahl soll kalkuliert und produziert werden?"
    );
    expect(state.productionAssumptions).toEqual(["Serviceform als Buffet abgeleitet."]);
    expect(state.productionConversationProjection).toMatchObject({
      sourceSpecId: "spec-conversation"
    });
    expect(
      state.productionConversationProjection.messages.some(
        (message) => message.type === "source_provenance_anchor"
      )
    ).toBe(true);
    expect(
      state.productionConversationProjection.messages.find(
        (message) => message.type === "production_output_anchor"
      )
    ).toMatchObject({
      planIds: ["plan-conversation"],
      purchaseListIds: ["purchase-conversation"]
    });
    expect(state.clarificationStatusCounts.unanswered).toBeGreaterThan(0);
    expect(state.workbenchSpecFacts).toContainEqual({
      label: "Status",
      value: "teilweise vollständig"
    });
  });

  it("shows review required in workbench facts when open questions remain on a complete spec", () => {
    const completeButUnreviewedSpec = {
      specId: "spec-complete-open-questions",
      readiness: { status: "complete" },
      event: { type: "conference", date: "2026-06-01" },
      attendees: { expected: 90 },
      servicePlan: { serviceForm: "buffet" },
      menuPlan: [
        {
          componentId: "component-lunch",
          label: "Lunchbuffet",
          productionDecision: { mode: "scratch" }
        }
      ]
    };

    const state = buildProductionConversationState({
      focusedProductionSpec: completeButUnreviewedSpec,
      focusedProductionSpecRecord: completeButUnreviewedSpec,
      currentSpecPlans: [],
      currentSpecPurchaseLists: []
    });

    expect(state.productionQuestions).toContain(
      "Lunchbuffet: Kategorie fehlt. Bitte klassisch, vegetarisch oder vegan festlegen."
    );
    expect(state.workbenchSpecFacts).toContainEqual({
      label: "Status",
      value: "Prüfung nötig"
    });
  });

  it("keeps empty production focus from creating local UI questions", () => {
    const state = buildProductionConversationState({
      currentSpecPlans: [],
      currentSpecPurchaseLists: []
    });

    expect(state.productionQuestions).toEqual([]);
    expect(state.productionAssumptions).toEqual([]);
    expect(state.clarificationStatusCounts).toEqual({ answered: 0, unanswered: 0 });
    expect(state.workbenchSpecFacts).toEqual([]);
  });
});
