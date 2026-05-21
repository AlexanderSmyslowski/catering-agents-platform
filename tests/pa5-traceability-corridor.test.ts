import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildProductionConversationProjection, createUploadSourceMetadata } from "@catering/shared-core";
import { renderProductionPlanHtml } from "@catering/print-export";

const acceptedSpec = {
  specId: "spec-pa5-1",
  readiness: { status: "ready", reasons: [] },
  event: { type: "conference", date: "2026-07-13" },
  attendees: { expected: 42 },
  servicePlan: { eventType: "conference", serviceForm: "buffet" },
  menuPlan: [],
  assumptions: [],
  missingFields: []
};

const productionPlan = {
  schemaVersion: "1.0.0",
  planId: "plan-pa5-1",
  eventSpecId: "spec-pa5-1",
  readiness: { status: "ready", reasons: [] },
  productionBatches: [],
  timeline: [],
  kitchenSheets: [],
  recipeSelections: [],
  unresolvedItems: []
};

const purchaseList = {
  purchaseListId: "purchase-pa5-1",
  eventSpecId: "spec-pa5-1",
  items: [],
  totals: { itemCount: 0 }
};

describe("PA5 read-only traceability corridor", () => {
  it("keeps upload metadata traceable through conversation anchors into the production export anchor", () => {
    const sourceMetadata = createUploadSourceMetadata({
      filename: "pa5-angebot.pdf",
      mimeType: "application/pdf; charset=utf-8",
      content: Buffer.from("PA5 corridor source document", "utf8"),
      uploadContext: "intake",
      ingestedAt: "2026-05-21T10:00:00.000Z"
    });

    const projection = buildProductionConversationProjection({
      spec: acceptedSpec,
      questions: [],
      assumptions: [],
      sourceInputs: [
        {
          kind: "pdf",
          content: "Rohinhalt darf nicht als Exportanker erscheinen.",
          documentId: "document-pa5-1",
          sourceMetadata
        }
      ],
      productionPlans: [productionPlan],
      purchaseLists: [purchaseList]
    });

    const conversationAnchor = projection.messages.find((message) => message.type === "source_provenance_anchor");
    const outputAnchor = projection.messages.find((message) => message.type === "production_output_anchor");
    const expectedSha256Short = sourceMetadata.sha256.slice(0, 12);

    expect(conversationAnchor?.sourceAnchors).toEqual([
      {
        documentId: "document-pa5-1",
        filename: "pa5-angebot.pdf",
        mimeType: "application/pdf",
        sizeBytes: sourceMetadata.sizeBytes,
        sha256Short: expectedSha256Short,
        ingestedAt: "2026-05-21T10:00:00.000Z",
        uploadContext: "intake"
      }
    ]);
    expect(outputAnchor).toMatchObject({
      planIds: ["plan-pa5-1"],
      purchaseListIds: ["purchase-pa5-1"],
      sourceAnchors: conversationAnchor?.sourceAnchors
    });

    const exportHtml = renderProductionPlanHtml({
      ...productionPlan,
      sourceAnchors: outputAnchor?.sourceAnchors
    } as never);

    expect(exportHtml).toContain("Quellenanker");
    expect(exportHtml).toContain(`pa5-angebot.pdf · application/pdf · ${sourceMetadata.sizeBytes} B · sha256:${expectedSha256Short} · intake`);
    expect(exportHtml).not.toContain("Rohinhalt");
  });

  it("documents the PA5 corridor as internal traceability, not as legal audit or completeness guarantee", () => {
    const gate = readFileSync("docs/architecture/PRODUCTION_AGENT_V1_ARCHITECTURE_GATE.md", "utf8");

    expect(gate).toContain("PA5 Nachvollziehbarkeitskorridor");
    expect(gate).toContain("intern nachvollziehbar");
    expect(gate).toContain("nicht rechtssicherer Audit");
    expect(gate).toContain("keine Vollständigkeitsgarantie für spätere LLM-/Rezept-/Allergen-Outputs");
  });
});
