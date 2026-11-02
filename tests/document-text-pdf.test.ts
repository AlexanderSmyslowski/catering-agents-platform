import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractTextFromDocument } from "../shared-core/src/document-text.js";

const extract = (content: Buffer) => extractTextFromDocument({
  filename: "recipe.pdf", mimeType: "application/pdf", content
});

function blankPdf(): Buffer {
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 4 0 R >>", "<< /Length 0 >>\nstream\n\nendstream"];
  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((object, index) => {
    const offset = Buffer.byteLength(pdf);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  return Buffer.from(pdf + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
}

describe("PDF document extraction", () => {
  it("extracts a valid text PDF including portions and quantities", async () => {
    const content = Buffer.from(readFileSync(new URL("./fixtures/synthetic-recipe.pdf.base64", import.meta.url), "utf8"), "base64");
    const text = await extract(content);
    expect(text).toContain("4 Portionen");
    expect(text).toContain("200 g Reis");
    expect(text).toContain("0,08 g Zimt");
    expect(text).not.toContain("%PDF");
  });

  it("returns empty for an unreadable PDF instead of exposing raw bytes", async () => {
    expect(await extract(Buffer.from("%PDF-1.4\nThis is not extractable PDF content\n%%EOF"))).toBe("");
  });

  it("does not expose raw PDF bytes when the MIME type is uppercase", async () => {
    const text = await extractTextFromDocument({ filename: "recipe.pdf", mimeType: "APPLICATION/PDF", content: Buffer.from("%PDF-1.4\nThis is not extractable PDF content\n%%EOF") });
    expect(text).toBe("");
  });

  it("returns empty for a valid PDF without a text layer", async () => {
    expect(await extract(blankPdf())).toBe("");
  });

  it("preserves normal text document extraction", async () => {
    expect(await extractTextFromDocument({ filename: "recipe.txt", mimeType: "text/plain", content: Buffer.from("4 Portionen\n200 g Reis") })).toBe("4 Portionen\n200 g Reis");
  });
});
