import { describe, expect, it } from "vitest";
import { formatSubmitErrorMessage } from "../backoffice-ui/src/submit-error-message.js";

describe("submit error message", () => {
  it("keeps explicit Error messages for operator feedback", () => {
    expect(formatSubmitErrorMessage(new Error("Upload passt nicht zum Angebot."), "Fallback")).toBe(
      "Upload passt nicht zum Angebot."
    );
  });

  it("uses the fallback for non-error thrown values", () => {
    expect(formatSubmitErrorMessage("timeout", "Dokument konnte nicht normalisiert werden.")).toBe(
      "Dokument konnte nicht normalisiert werden."
    );
    expect(formatSubmitErrorMessage(undefined, "Rezept konnte nicht hochgeladen werden.")).toBe(
      "Rezept konnte nicht hochgeladen werden."
    );
  });
});
