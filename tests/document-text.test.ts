import { describe, expect, it, vi } from "vitest";
import pdf from "pdf-parse";
import { extractTextFromDocument } from "../shared-core/src/document-text.js";

vi.mock("pdf-parse", () => ({
  default: vi.fn()
}));

describe("document text extraction", () => {
  it("falls back instead of hanging forever on problematic PDFs", async () => {
    vi.mocked(pdf).mockImplementation(
      () =>
        new Promise(() => {
          // unresolved on purpose
        }) as ReturnType<typeof pdf>
    );

    const startedAt = Date.now();
    const text = await extractTextFromDocument({
      filename: "problematic.pdf",
      mimeType: "application/pdf",
      content: Buffer.from("Lunch Buffet Tomatensuppe Kaffee Heidelberg 120 Personen", "utf8")
    });
    const elapsed = Date.now() - startedAt;

    expect(elapsed).toBeLessThan(7000);
    expect(text).toContain("Lunch Buffet");
  });
});
