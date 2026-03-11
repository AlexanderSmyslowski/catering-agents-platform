import pdf from "pdf-parse";
import type { DocumentInput } from "./types.js";

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
