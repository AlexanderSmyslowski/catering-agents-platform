import pdf from "pdf-parse";
import type { DocumentInput } from "./types.js";

const PDF_PARSE_TIMEOUT_MS = 3000;

function decodeText(buffer: Buffer): string {
  return buffer.toString("utf8").replace(/\0/g, "").trim();
}

function decodePrintableSegments(buffer: Buffer): string {
  const latin1 = buffer.toString("latin1");
  const matches = latin1.match(/[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9 ,.:;!?()/%+\-_'"&\n]{3,}/g);
  if (!matches) {
    return "";
  }

  return matches
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function fallbackDocumentText(buffer: Buffer): string {
  const utf8 = decodeText(buffer);
  if (utf8.length >= 24) {
    return utf8;
  }

  const printable = decodePrintableSegments(buffer);
  if (printable.length >= 24) {
    return printable;
  }

  return utf8 || printable;
}

async function parsePdfWithTimeout(buffer: Buffer): Promise<string> {
  return await Promise.race([
    pdf(buffer).then((result) => result.text.trim()),
    new Promise<string>((resolve) => {
      setTimeout(() => resolve(""), PDF_PARSE_TIMEOUT_MS);
    })
  ]);
}

export async function extractTextFromDocument(document: DocumentInput): Promise<string> {
  if (document.mimeType.includes("pdf")) {
    try {
      const text = await parsePdfWithTimeout(document.content);
      if (text) {
        return text;
      }
    } catch {
      return fallbackDocumentText(document.content);
    }

    return fallbackDocumentText(document.content);
  }

  return fallbackDocumentText(document.content);
}
