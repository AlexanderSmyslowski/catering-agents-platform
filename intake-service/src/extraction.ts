import pdf from "pdf-parse";
import { createEventRequestFromText, type DocumentInput } from "@catering/shared-core";

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
  channel: Parameters<typeof createEventRequestFromText>[0]["channel"];
  rawText: string;
  sourceRef?: string;
}) {
  return createEventRequestFromText(input);
}
