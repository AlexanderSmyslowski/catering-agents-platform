import { describe, expect, it } from "vitest";
import { planningComponentErrorReason } from "../production-service/src/rules/planning-component-error-reason.js";

describe("planning component error reason", () => {
  it("keeps invalid planning response copy unwrapped", () => {
    const reason = planningComponentErrorReason(
      "Tomatensuppe",
      new Error("Ungültige Planungsantwort für Tomatensuppe: recipeId fehlt.")
    );

    expect(reason).toBe("Ungültige Planungsantwort für Tomatensuppe: recipeId fehlt.");
  });

  it("wraps technical errors with the affected component label", () => {
    const reason = planningComponentErrorReason("Tomatensuppe", new Error("simulated timeout"));

    expect(reason).toBe(
      "Technischer Fehler in der Produktionsplanung für Tomatensuppe: simulated timeout"
    );
  });

  it("keeps non-error failures deterministic", () => {
    const reason = planningComponentErrorReason("Mystery Bowl", "timeout");

    expect(reason).toBe(
      "Technischer Fehler in der Produktionsplanung für Mystery Bowl: Unbekannter Fehler"
    );
  });
});
