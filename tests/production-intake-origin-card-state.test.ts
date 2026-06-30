import { describe, expect, it } from "vitest";
import {
  buildProductionIntakeOriginCardState,
  formatDocumentIngestionSummary
} from "../backoffice-ui/src/production-intake-origin-card-state.js";

describe("production intake origin card state", () => {
  it("maps intake request detail into stable summary and raw input labels", () => {
    expect(
      buildProductionIntakeOriginCardState({
        requestId: "request-1",
        source: {
          channel: "pdf_upload",
          receivedAt: "2026-06-05T08:30:00.000Z"
        },
        rawInputs: [
          {
            kind: "document",
            mimeType: "application/pdf",
            documentId: "document-1",
            documentIngestion: {
              status: "fallback",
              warnings: ["document_text_extraction_fallback"]
            },
            sourceMetadata: {
              filename: "angebot.pdf",
              mimeType: "application/pdf",
              sizeBytes: 2048,
              sha256: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
              ingestedAt: "2026-06-05T08:31:00.000Z",
              uploadContext: "intake"
            }
          }
        ]
      })
    ).toEqual({
      requestSummaryLabel: "Intake-Ursprung: Dateiupload · erhalten 2026-06-05T08:30:00.000Z",
      rawInputs: [
        {
          key: "document-1-0",
          kindLabel: "document",
          mimeTypeLabel: " · application/pdf",
          documentIngestionSummary: "Status fallback · Warnkey document_text_extraction_fallback",
          sourceMetadataSummary:
            "angebot.pdf · application/pdf · 2.0 KB · sha256:1234567890ab · intake · 2026-06-05T08:31:00.000Z"
        }
      ]
    });
  });

  it("keeps empty fallback values explicit and skips incomplete metadata summaries", () => {
    expect(
      buildProductionIntakeOriginCardState({
        requestId: "request-2",
        rawInputs: [{ kind: "", mimeType: "", sourceMetadata: { filename: "angebot.pdf" } }]
      })
    ).toEqual({
      requestSummaryLabel: "Intake-Ursprung: - · erhalten -",
      rawInputs: [
        {
          key: "--0",
          kindLabel: "-",
          mimeTypeLabel: undefined,
          documentIngestionSummary: undefined,
          sourceMetadataSummary: undefined
        }
      ]
    });
  });

  it("suppresses extracted ingestion summaries without warnings", () => {
    expect(
      formatDocumentIngestionSummary({
        documentIngestion: {
          status: "extracted",
          warnings: []
        }
      })
    ).toBeUndefined();
  });

  it("includes extracted ingestion summaries once warnings are present", () => {
    expect(
      formatDocumentIngestionSummary({
        documentIngestion: {
          status: "extracted",
          warnings: ["low_confidence"]
        }
      })
    ).toBe("Status extracted · Warnkey low_confidence");
  });
});
