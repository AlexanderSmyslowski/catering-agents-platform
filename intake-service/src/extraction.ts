import pdf from "pdf-parse";
import type { DocumentInput, EventRequest } from "@catering/shared-core";
import { SCHEMA_VERSION } from "@catering/shared-core";

function decodeText(buffer: Buffer): string {
  return buffer.toString("utf8").replace(/\0/g, "").trim();
}

export async function extractTextFromDocument(document: DocumentInput): Promise<string> {
  if (document.mimeType.includes("pdf")) {
    try {
      const result = await pdf(document.content);
      if (result.text.trim()) {
        return result.text.trim();
      }
    } catch {
      return decodeText(document.content);
    }
  }

  return decodeText(document.content);
}

export function buildEventRequestFromText(input: {
  requestId: string;
  channel: EventRequest["source"]["channel"];
  rawText: string;
  sourceRef?: string;
}): EventRequest {
  return {
    schemaVersion: SCHEMA_VERSION,
    requestId: input.requestId,
    source: {
      channel: input.channel,
      receivedAt: new Date().toISOString(),
      sourceRef: input.sourceRef
    },
    rawInputs: [
      {
        kind: input.channel === "email" ? "email" : input.channel === "pdf_upload" ? "pdf" : "text",
        content: input.rawText
      }
    ]
  };
}

