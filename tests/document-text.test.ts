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

  it("drops PDF extraction output that is dominated by control characters and falls back to printable text", async () => {
    vi.mocked(pdf).mockResolvedValue({
      text: "\u0000\u0001\u0002\u0003binary\u0004\u0005fragment\u0006\u0007\u0008"
    } as Awaited<ReturnType<typeof pdf>>);

    const text = await extractTextFromDocument({
      filename: "kaputtes-angebot.pdf",
      mimeType: "application/pdf",
      content: Buffer.from(
        "\u0000\u0001Conference Getraenke Kaffee Tee Saft Wasser Kekse Obst Welcome Coffee Lunch Buffet Tea Time Lunch Bags 10x Haehnchen Reis Falafel Tabouleh Gemuese Hummus Dessert Kuchen\u0000\u0001",
        "utf8"
      )
    });

    expect(text).toContain("Conference Getraenke Kaffee Tee Saft Wasser Kekse Obst");
    expect(text).not.toContain("binary");
    expect(text).not.toContain("fragment");
  });
});
