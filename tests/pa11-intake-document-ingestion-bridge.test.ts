import { describe, expect, it } from "vitest";
import { buildIntakeApp } from "../intake-service/src/app.js";
import { buildProductionConversationProjection } from "@catering/shared-core";
import { renderProductionPlanHtml } from "@catering/print-export";

function createDataRoot(): string {
  return `${process.cwd()}/tmp/pa11-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

describe("PA11 intake DocumentIngestion bridge", () => {
  it("transports safe ingestion status for the JSON/base64 text document path", async () => {
    const app = buildIntakeApp({ rootDir: createDataRoot() });

    const response = await app.inject({
      method: "POST",
      url: "/v1/intake/documents",
      payload: {
        requestId: "pa11-json-text",
        channel: "text",
        documents: [
          {
            filename: "angebot.txt",
            mimeType: "text/plain",
            contentBase64: Buffer.from(
              "Lunch am 2026-05-14 fuer 42 Teilnehmer mit Buffet und Dessert.",
              "utf8"
            ).toString("base64")
          }
        ]
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.acceptedEventSpec.attendees.expected).toBe(42);
    expect(body.documentIngestion.documents).toHaveLength(1);
    expect(body.documentIngestion.documents[0]).toMatchObject({
      documentId: "pa11-json-text-1",
      ingestionStatus: "extracted",
      warnings: [],
      sourceMetadata: {
        filename: "angebot.txt",
        mimeType: "text/plain",
        uploadContext: "intake"
      }
    });
    expect(body.documentIngestion.documents[0].sourceMetadata.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(body.documentIngestion)).not.toContain("Lunch am 2026-05-14");

    await app.close();
  });

  it("returns an ingestion warning for PDF fallback instead of claiming extracted success", async () => {
    const app = buildIntakeApp({ rootDir: createDataRoot() });

    const response = await app.inject({
      method: "POST",
      url: "/v1/intake/documents",
      payload: {
        requestId: "pa11-pdf-fallback",
        channel: "pdf_upload",
        documents: [
          {
            filename: "angebot.pdf",
            mimeType: "application/pdf",
            contentBase64: Buffer.from("%PDF-1.7\n%%EOF", "utf8").toString("base64")
          }
        ]
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.documentIngestion.documents[0]).toMatchObject({
      documentId: "pa11-pdf-fallback-1",
      ingestionStatus: "fallback",
      warnings: ["document_text_extraction_fallback"],
      sourceMetadata: {
        filename: "angebot.pdf",
        mimeType: "application/pdf",
        uploadContext: "intake"
      }
    });
    expect(body.acceptedEventSpec.readiness.status).not.toBe("complete");
    expect(JSON.stringify(body.documentIngestion)).not.toContain("%PDF");

    await app.close();
  });

  it("keeps raw extracted text out of conversation and export provenance anchors", async () => {
    const app = buildIntakeApp({ rootDir: createDataRoot() });
    const rawText = "Geheimer PA11 Rohtext: Lunch am 2026-05-14 fuer 33 Teilnehmer.";

    const response = await app.inject({
      method: "POST",
      url: "/v1/intake/documents",
      payload: {
        requestId: "pa11-anchor-safety",
        channel: "text",
        documents: [
          {
            filename: "anchor.txt",
            mimeType: "text/plain",
            contentBase64: Buffer.from(rawText, "utf8").toString("base64")
          }
        ]
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    const projection = buildProductionConversationProjection({
      spec: body.acceptedEventSpec,
      questions: [],
      sourceInputs: body.eventRequest.rawInputs,
      productionPlans: [
        {
          planId: "plan-pa11",
          specId: body.acceptedEventSpec.specId
        }
      ],
      purchaseLists: [
        {
          purchaseListId: "purchase-pa11",
          planId: "plan-pa11"
        }
      ]
    });
    const exportHtml = renderProductionPlanHtml({
      schemaVersion: "1.0.0",
      planId: "plan-pa11",
      eventSpecId: body.acceptedEventSpec.specId,
      readiness: { status: "draft", reasons: [] },
      productionBatches: [],
      timeline: [],
      kitchenSheets: [],
      recipeSelections: [],
      unresolvedItems: [],
      sourceAnchors: projection.messages.find((message) => message.type === "production_output_anchor")?.sourceAnchors
    } as never);

    expect(JSON.stringify(projection.messages.filter((message: { type: string }) => message.type.includes("anchor")))).not.toContain(rawText);
    expect(exportHtml).not.toContain(rawText);
    expect(JSON.stringify(body.documentIngestion)).not.toContain(rawText);

    await app.close();
  });
});
