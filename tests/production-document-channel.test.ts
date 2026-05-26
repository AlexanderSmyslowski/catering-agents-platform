import { describe, expect, it } from "vitest";
import { channelForFile } from "../backoffice-ui/src/production-document-channel.js";

describe("production document channel", () => {
  it.each([
    ["angebot.pdf", "pdf_upload"],
    ["ANGEBOT.PDF", "pdf_upload"],
    ["kundennachricht.eml", "email"],
    ["KUNDENNACHRICHT.EML", "email"],
    ["angebot.txt", "text"],
    ["angebot.docx", "text"],
    ["angebot", "text"]
  ] as const)("maps %s to %s", (name, expectedChannel) => {
    expect(channelForFile({ name })).toBe(expectedChannel);
  });
});
