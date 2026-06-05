import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const docPath = "docs/architecture/PA54_LLM_DATA_PII_DECISION_FRAME.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";
const readme = readFileSync("README.md", "utf8");
const testing = readFileSync("TESTING.md", "utf8");
const memory = readFileSync("memory.md", "utf8");

describe("PA54 LLM data/PII decision frame", () => {
  it("anchors the next LLM data frame as documentation-only and not runtime work", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA54 LLM Daten-/PII-Entscheidungsrahmen");
    expect(doc).toContain("Status: Entscheidungsvorlage und Vertragstest, keine neue Runtime-Implementierung");
    expect(doc).toContain("kein Deployment");
    expect(doc).toContain("keine neuen APIs");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("keine Migration");
    expect(doc).toContain("keine echten Daten");
    expect(doc).toContain("keine Produktschreibwirkung");
  });

  it("treats PA42-PA53 as the existing local corridor and uses B13/P11/P12 as leading data gates", () => {
    for (const anchor of [
      "PA42 bis PA53 haben den kleinsten lokalen `synthetic_live`-Korridor",
      "PA51 nicht nur die Operator-/Kosten-/Approval-Frage offen",
      "B13 fuer PII/Retention/Backup",
      "P11-N2 fuer anonymisiert/synthetisch vs. pseudonymisiert/echt",
      "P12-N2 fuer den nicht-sensitiven Management-Go/No-Go-Rahmen"
    ]) {
      expect(doc).toContain(anchor);
    }
  });

  it("presents explicit options and recommends only anonymized reduced draft inputs as the smallest next step", () => {
    for (const anchor of [
      "Option A:",
      "Option B:",
      "Option C:",
      "Minimale sichere Bedingungen fuer Option B:",
      "Klare Empfehlung:",
      "Option B in der kleinsten moeglichen Form",
      "nur nachweisbar anonymisierte und bewusst reduzierte Draft-Inputs",
      "keine pseudonymisierten echten Daten",
      "keine Rohdokumente",
      "keine vollstaendigen `AcceptedEventSpec`-Objekte als Provider-Input",
      "kein Raw Prompt-/Response-Logging",
      "Human Approval bleibt Pflicht"
    ]) {
      expect(doc).toContain(anchor);
    }
  });

  it("keeps pseudonymized or real inputs blocked and remains discoverable from core references", () => {
    for (const anchor of [
      "Pseudonymisierte oder echte operative Daten duerfen in einen",
      "Sicherer Default",
      "kein nicht-synthetischer Provider-Input",
      "keine pseudonymisierten oder echten Daten"
    ]) {
      expect(doc).toContain(anchor);
    }

    expect(readme).toContain(docPath);
    expect(testing).toContain(docPath);
    expect(testing).toContain("tests/pa54-llm-data-pii-decision-frame.test.ts");
    expect(memory).toContain(docPath);
  });
});
