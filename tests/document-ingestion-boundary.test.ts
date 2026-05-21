import { describe, expect, it } from "vitest";
import {
  buildProductionConversationProjection,
  createUploadSourceMetadata,
  ingestDocument
} from "@catering/shared-core";

describe("DocumentIngestion boundary", () => {
  it("wraps an allowed text document into a deterministic ingestion result", async () => {
    const content = Buffer.from("Lunch am 2026-05-14 fuer 42 Personen mit Buffet.", "utf8");
    const sourceMetadata = createUploadSourceMetadata({
      filename: "angebot.txt",
      mimeType: "text/plain; charset=utf-8",
      content,
      uploadContext: "intake",
      ingestedAt: "2026-05-21T10:00:00.000Z"
    });

    const result = await ingestDocument({
      document: {
        filename: "angebot.txt",
        mimeType: "text/plain; charset=utf-8",
        content,
        sourceMetadata
      },
      context: "intake"
    });

    expect(result).toEqual({
      context: "intake",
      status: "extracted",
      sourceMetadata,
      extractedText: "Lunch am 2026-05-14 fuer 42 Personen mit Buffet.",
      extractedTextLength: 48,
      warnings: [],
      ingestedAt: "2026-05-21T10:00:00.000Z"
    });
  });

  it("reports fallback with a warning for a pdf-like document without reliable extracted text", async () => {
    const content = Buffer.from("%PDF-1.4\n%%EOF", "utf8");
    const sourceMetadata = createUploadSourceMetadata({
      filename: "angebot.pdf",
      mimeType: "application/pdf",
      content,
      uploadContext: "production",
      ingestedAt: "2026-05-21T11:00:00.000Z"
    });

    const result = await ingestDocument({
      document: {
        filename: "angebot.pdf",
        mimeType: "application/pdf",
        content,
        sourceMetadata
      },
      context: "production"
    });

    expect(result.status).toBe("fallback");
    expect(result.sourceMetadata).toEqual(sourceMetadata);
    expect(result.ingestedAt).toBe("2026-05-21T11:00:00.000Z");
    expect(result.warnings).toContain("document_text_extraction_fallback");
    expect(result.extractedText).toBeUndefined();
    expect(result.extractedTextLength).toBe(0);
  });

  it("keeps raw extracted text out of conversation and export provenance anchors", async () => {
    const content = Buffer.from("Vertrauliche Angebotsdetails fuer 42 Personen", "utf8");
    const sourceMetadata = createUploadSourceMetadata({
      filename: "angebot.txt",
      mimeType: "text/plain",
      content,
      uploadContext: "intake",
      ingestedAt: "2026-05-21T12:00:00.000Z"
    });

    const result = await ingestDocument({
      document: {
        filename: "angebot.txt",
        mimeType: "text/plain",
        content,
        sourceMetadata
      },
      context: "intake"
    });

    const projection = buildProductionConversationProjection({
      questions: [],
      sourceInputs: [
        {
          kind: "text",
          content: result.extractedText ?? "",
          sourceMetadata: result.sourceMetadata
        }
      ]
    });

    const serializedProjection = JSON.stringify(projection);
    expect(serializedProjection).toContain("angebot.txt");
    expect(serializedProjection).toContain(sourceMetadata.sha256.slice(0, 12));
    expect(serializedProjection).not.toContain("Vertrauliche Angebotsdetails");
  });
});
