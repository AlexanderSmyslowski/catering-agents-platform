import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildProductionConversationProjection, createUploadSourceMetadata } from "@catering/shared-core";
import { renderProductionPlanHtml } from "@catering/print-export";

const acceptedSpec = {
  specId: "spec-pa14-1",
  readiness: { status: "ready", reasons: [] },
  event: { type: "conference", date: "2026-07-14" },
  attendees: { expected: 42 },
  servicePlan: { eventType: "conference", serviceForm: "buffet" },
  menuPlan: [],
  assumptions: [],
  missingFields: []
};

const productionPlan = {
  schemaVersion: "1.0.0",
  planId: "plan-pa14-1",
  eventSpecId: "spec-pa14-1",
  readiness: { status: "ready", reasons: [] },
  productionBatches: [],
  timeline: [],
  kitchenSheets: [],
  recipeSelections: [],
  unresolvedItems: []
};

const purchaseList = {
  purchaseListId: "purchase-pa14-1",
  eventSpecId: "spec-pa14-1",
  items: [],
  totals: { itemCount: 0 }
};

describe("PA14 document ingestion corridor readiness anchor", () => {
  it("anchors source, ingestion status, warning visibility and export safety without raw text", () => {
    const sourceMetadata = createUploadSourceMetadata({
      filename: "pa14-abnahme-angebot.pdf",
      mimeType: "application/pdf",
      content: Buffer.from("PA14 source bytes", "utf8"),
      uploadContext: "intake",
      ingestedAt: "2026-05-21T14:00:00.000Z"
    });

    const projection = buildProductionConversationProjection({
      spec: acceptedSpec,
      questions: [],
      sourceInputs: [
        {
          kind: "pdf",
          content: "%PDF PA14 Rohtext darf nicht in Abnahme- oder Exportankern erscheinen.",
          documentId: "document-pa14-fallback-1",
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

    const sourceAnchor = projection.messages.find((message) => message.type === "source_provenance_anchor");
    const warningAnchor = projection.messages.find((message) => message.type === "ingestion_warning_anchor");
    const outputAnchor = projection.messages.find((message) => message.type === "production_output_anchor");

    expect(sourceAnchor?.text).toContain("pa14-abnahme-angebot.pdf");
    expect(sourceAnchor?.text).toContain("sha256:");
    expect(warningAnchor?.text).toBe(
      "Quelle unsicher/fallback: pa14-abnahme-angebot.pdf · Status: fallback · Warnungen: document_text_extraction_fallback"
    );
    expect(outputAnchor?.sourceAnchors).toEqual([
      expect.objectContaining({
        documentId: "document-pa14-fallback-1",
        filename: "pa14-abnahme-angebot.pdf",
        ingestionStatus: "fallback",
        ingestionWarnings: ["document_text_extraction_fallback"]
      })
    ]);
    expect(outputAnchor?.text).toContain("Ingestion-Warnung");
    expect(JSON.stringify(projection.messages)).not.toContain("PA14 Rohtext");

    const exportHtml = renderProductionPlanHtml({
      ...productionPlan,
      sourceAnchors: outputAnchor?.sourceAnchors,
      extractedText: "%PDF PA14 Rohtext darf nicht im Export erscheinen."
    } as never);

    expect(exportHtml).toContain("Ingestion-Warnungen");
    expect(exportHtml).toContain(
      "pa14-abnahme-angebot.pdf · Status: fallback · Warnungen: document_text_extraction_fallback"
    );
    expect(exportHtml).not.toContain("PA14 Rohtext");
    expect(exportHtml).not.toContain("%PDF");
  });

  it("documents the read-only PA14 acceptance anchor in the repo testing guide", () => {
    const testingGuide = readFileSync(new URL("../TESTING.md", import.meta.url), "utf8");
    const c8DemoPath = readFileSync(
      new URL("../docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md", import.meta.url),
      "utf8"
    );

    expect(testingGuide).toContain("PA14 DocumentIngestion-Korridor");
    expect(testingGuide).toContain("Quelle vorhanden -> Ingestion-Status sichtbar -> Warnungen sichtbar -> Exportanker sicher");
    expect(testingGuide).toContain("keine Rohtextspiegelung");
    expect(testingGuide).toContain("Backoffice-Demo-Marker: `Ingestion-Warnung: Status fallback · Warnkey document_text_extraction_fallback`");
    expect(testingGuide).toContain("Quellenmetadaten (gekürzt)");
    expect(testingGuide).toContain("keine vollen SHA-256-Hashes");
    expect(c8DemoPath).toContain("Warnstatus und Warnkey, zum Beispiel `Ingestion-Warnung: Status fallback · Warnkey document_text_extraction_fallback`");
    expect(c8DemoPath).toContain("keine vollen SHA-256-Hashes");
  });
});
