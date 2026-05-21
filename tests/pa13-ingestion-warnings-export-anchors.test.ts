import { describe, expect, it } from "vitest";
import { buildProductionConversationProjection, createUploadSourceMetadata } from "@catering/shared-core";
import { renderProductionPlanHtml } from "@catering/print-export";

const acceptedSpec = {
  specId: "spec-pa13-1",
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
  planId: "plan-pa13-1",
  eventSpecId: "spec-pa13-1",
  readiness: { status: "ready", reasons: [] },
  productionBatches: [],
  timeline: [],
  kitchenSheets: [],
  recipeSelections: [],
  unresolvedItems: []
};

const purchaseList = {
  purchaseListId: "purchase-pa13-1",
  eventSpecId: "spec-pa13-1",
  items: [],
  totals: { itemCount: 0 }
};

describe("PA13 ingestion warnings in export anchors", () => {
  it("carries fallback ingestion warnings into production output and print export anchors without raw text", () => {
    const sourceMetadata = createUploadSourceMetadata({
      filename: "pa13-angebot.pdf",
      mimeType: "application/pdf",
      content: Buffer.from("PA13 source bytes", "utf8"),
      uploadContext: "intake",
      ingestedAt: "2026-05-21T12:00:00.000Z"
    });

    const projection = buildProductionConversationProjection({
      spec: acceptedSpec,
      questions: [],
      sourceInputs: [
        {
          kind: "pdf",
          content: "%PDF Rohtext darf nicht im Output- oder Exportanker erscheinen.",
          documentId: "document-pa13-fallback-1",
          sourceMetadata,
          documentIngestion: {
            status: "fallback",
            warnings: ["document_text_extraction_fallback"]
          }
        }
      ],
      productionPlans: [productionPlan],
      purchaseLists: [purchaseList]
    });

    const outputAnchor = projection.messages.find((message) => message.type === "production_output_anchor");

    expect(outputAnchor?.text).toContain(
      "Ingestion-Warnung: pa13-angebot.pdf · Status: fallback · Warnungen: document_text_extraction_fallback"
    );
    expect(outputAnchor?.text).not.toContain("Rohtext");
    expect(outputAnchor?.sourceAnchors).toEqual([
      expect.objectContaining({
        documentId: "document-pa13-fallback-1",
        filename: "pa13-angebot.pdf",
        ingestionStatus: "fallback",
        ingestionWarnings: ["document_text_extraction_fallback"]
      })
    ]);

    const exportHtml = renderProductionPlanHtml({
      ...productionPlan,
      sourceAnchors: outputAnchor?.sourceAnchors,
      extractedText: "%PDF Rohtext darf nicht im Export erscheinen."
    } as never);

    expect(exportHtml).toContain("Ingestion-Warnungen");
    expect(exportHtml).toContain(
      "pa13-angebot.pdf · Status: fallback · Warnungen: document_text_extraction_fallback"
    );
    expect(exportHtml).not.toContain("Rohtext");
    expect(exportHtml).not.toContain("%PDF");
  });

  it("keeps extracted ok sources quiet in production output and print export anchors", () => {
    const sourceMetadata = createUploadSourceMetadata({
      filename: "pa13-ok.txt",
      mimeType: "text/plain",
      content: Buffer.from("Extrahierter Text", "utf8"),
      uploadContext: "intake",
      ingestedAt: "2026-05-21T12:30:00.000Z"
    });

    const projection = buildProductionConversationProjection({
      spec: acceptedSpec,
      questions: [],
      sourceInputs: [
        {
          kind: "text",
          content: "Extrahierter Rohtext darf keinen Warnanker erzeugen.",
          documentId: "document-pa13-ok-1",
          sourceMetadata,
          documentIngestion: {
            status: "extracted",
            warnings: []
          }
        }
      ],
      productionPlans: [productionPlan],
      purchaseLists: [purchaseList]
    });

    const outputAnchor = projection.messages.find((message) => message.type === "production_output_anchor");
    const exportHtml = renderProductionPlanHtml({
      ...productionPlan,
      sourceAnchors: outputAnchor?.sourceAnchors
    } as never);

    expect(outputAnchor?.text).not.toContain("Ingestion-Warnung");
    expect(outputAnchor?.sourceAnchors?.[0]).not.toHaveProperty("ingestionStatus");
    expect(outputAnchor?.sourceAnchors?.[0]).not.toHaveProperty("ingestionWarnings");
    expect(exportHtml).not.toContain("Ingestion-Warnungen");
    expect(exportHtml).not.toContain("Extrahierter Rohtext");
  });
});
