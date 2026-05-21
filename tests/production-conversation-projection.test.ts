import { describe, expect, it } from "vitest";
import { buildProductionConversationProjection } from "@catering/shared-core";

const acceptedSpec = {
  specId: "spec-pa1-1",
  readiness: { status: "partial", reasons: ["Teilnehmerzahl noch nicht verbindlich."] },
  event: { type: "conference", date: "2026-07-13" },
  attendees: { expected: 36 },
  servicePlan: { eventType: "conference", serviceForm: "buffet" },
  menuPlan: [
    {
      componentId: "component-bread",
      label: "Brot-Baguette",
      menuCategory: "classic"
    }
  ],
  assumptions: [
    {
      code: "service_form_defaulted",
      message: "Service form inferred as buffet.",
      applied: true
    }
  ],
  missingFields: ["attendees.expected"]
};

const productionPlan = {
  planId: "plan-pa1-1",
  eventSpecId: "spec-pa1-1",
  readiness: { status: "partial", reasons: [] },
  productionBatches: [],
  kitchenSheets: [],
  recipeSelections: [],
  unresolvedItems: ["Teilnehmerzahl final bestaetigen."],
  fallbackReason: "Teilnehmerzahl final bestaetigen."
};

const purchaseList = {
  purchaseListId: "purchase-pa1-1",
  eventSpecId: "spec-pa1-1",
  items: [{ displayName: "Baguette", purchaseQty: 12, purchaseUnit: "Stück" }],
  totals: { itemCount: 1 }
};

describe("production conversation projection", () => {
  it("maps existing spec, questions, answers and outputs into an ordered session projection", () => {
    const projection = buildProductionConversationProjection({
      spec: acceptedSpec,
      questions: ["Mit welcher verbindlichen Teilnehmerzahl soll kalkuliert und produziert werden?"],
      assumptions: ["Serviceform als Buffet abgeleitet."],
      answerSummary: "Teilnehmerzahl: 36 Personen · Serviceform: Buffet",
      productionPlans: [productionPlan],
      purchaseLists: [purchaseList]
    });

    expect(projection.sessionId).toBe("production-session-spec-pa1-1");
    expect(projection.sourceSpecId).toBe("spec-pa1-1");
    expect(projection.messages.map((message) => message.type)).toEqual([
      "system_agent_hint",
      "structured_agent_question",
      "user_structured_answer",
      "production_output_anchor"
    ]);
    expect(projection.messages[0]).toMatchObject({
      role: "system",
      title: "Session-Grundlage",
      text: "Strukturierte Veranstaltungsdaten bleiben führend. Kein freier LLM-Chat."
    });
    expect(projection.messages[1]).toMatchObject({
      role: "agent",
      questionIndex: 1,
      text: "Mit welcher verbindlichen Teilnehmerzahl soll kalkuliert und produziert werden?"
    });
    expect(projection.messages[2]).toMatchObject({
      role: "user",
      text: "Teilnehmerzahl: 36 Personen · Serviceform: Buffet"
    });
    expect(projection.messages[3]).toMatchObject({
      role: "agent",
      planIds: ["plan-pa1-1"],
      purchaseListIds: ["purchase-pa1-1"]
    });
  });

  it("adds a safe read-only provenance anchor when upload source metadata is present", () => {
    const projection = buildProductionConversationProjection({
      spec: acceptedSpec,
      questions: [],
      assumptions: [],
      sourceInputs: [
        {
          kind: "pdf",
          content: "Interner Langtext darf nicht im Quellenanker erscheinen.",
          documentId: "document-pa3-1",
          sourceMetadata: {
            filename: "angebot-pa3.pdf",
            mimeType: "application/pdf",
            sizeBytes: 24816,
            sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            ingestedAt: "2026-05-21T08:30:00.000Z",
            uploadContext: "intake"
          }
        }
      ],
      productionPlans: [],
      purchaseLists: []
    });

    expect(projection.messages.map((message) => message.type)).toEqual([
      "system_agent_hint",
      "source_provenance_anchor"
    ]);
    expect(projection.messages[1]).toMatchObject({
      role: "system",
      title: "Quellenanker",
      text: "angebot-pa3.pdf · application/pdf · 24.2 KB · sha256:0123456789ab · intake · 2026-05-21T08:30:00.000Z"
    });
    expect(projection.messages[1].sourceAnchors).toEqual([
      {
        documentId: "document-pa3-1",
        filename: "angebot-pa3.pdf",
        mimeType: "application/pdf",
        sizeBytes: 24816,
        sha256Short: "0123456789ab",
        ingestedAt: "2026-05-21T08:30:00.000Z",
        uploadContext: "intake"
      }
    ]);
    expect(projection.messages[1].text).not.toContain("Interner Langtext");
  });

  it("keeps an empty production context as a non-LLM system hint without creating fake answers or provenance", () => {
    const projection = buildProductionConversationProjection({
      spec: undefined,
      questions: ["Bitte ziehe zuerst ein Angebot hinein oder lade eine Datei hoch."],
      assumptions: [],
      sourceInputs: [
        {
          kind: "text",
          content: "Text ohne sourceMetadata"
        }
      ],
      productionPlans: [],
      purchaseLists: []
    });

    expect(projection.sessionId).toBe("production-session-draft");
    expect(projection.messages.map((message) => message.type)).toEqual([
      "system_agent_hint",
      "structured_agent_question"
    ]);
    expect(projection.messages.some((message) => message.type === "user_structured_answer")).toBe(false);
    expect(projection.messages.some((message) => message.type === "production_output_anchor")).toBe(false);
    expect(projection.messages.some((message) => message.type === "source_provenance_anchor")).toBe(false);
  });
});
