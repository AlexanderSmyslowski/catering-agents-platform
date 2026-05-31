import { describe, expect, it } from "vitest";
import {
  getProductionSourceDroppedFile,
  getProductionSourceSelectedFile
} from "../backoffice-ui/src/production-source-file-events.js";

describe("production source file events", () => {
  it("reads the first dropped file while preserving the File reference", () => {
    const file = new File(["angebot"], "angebot.pdf", { type: "application/pdf" });

    expect(
      getProductionSourceDroppedFile({
        dataTransfer: {
          files: [file]
        }
      })
    ).toBe(file);
  });

  it("keeps empty drop events inert", () => {
    expect(
      getProductionSourceDroppedFile({
        dataTransfer: {
          files: []
        }
      })
    ).toBeUndefined();
  });

  it("reads the first selected input file while preserving the File reference", () => {
    const file = new File(["text"], "angebot.txt", { type: "text/plain" });

    expect(
      getProductionSourceSelectedFile({
        target: {
          files: [file]
        }
      })
    ).toBe(file);
  });

  it("keeps empty file selections inert", () => {
    expect(
      getProductionSourceSelectedFile({
        target: {
          files: []
        }
      })
    ).toBeUndefined();
  });
});
