import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const docPath = "docs/architecture/PA59_LLM_TOOL_WRITE_EFFECT_DECISION_FRAME.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";
const readme = readFileSync("README.md", "utf8");
const testing = readFileSync("TESTING.md", "utf8");
const memory = readFileSync("memory.md", "utf8");

describe("PA59 LLM tool/write-effect decision frame", () => {
  it("anchors the next tool frame as documentation-only and not runtime work", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA59 LLM Tool-/Write-Effect-Entscheidungsrahmen");
    expect(doc).toContain("Status: Entscheidungsvorlage und Vertragstest, keine neue Runtime-Implementierung");
    expect(doc).toContain("kein Deployment");
    expect(doc).toContain("keine Tool-Orchestrierung");
    expect(doc).toContain("keine neue API");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("keine Migration");
    expect(doc).toContain("keine echten Daten");
    expect(doc).toContain("keine Produktschreibwirkung");
  });

  it("uses PA26 and the existing sister frames as leading anchors", () => {
    for (const anchor of [
      "PA26 trennt `read`, `draft` und `write` als Tool-Effektklassen",
      "`writesProductObject: false` bleibt fuer die bisherigen Draft-Vertraege hart",
      "lokaler `synthetic_live`-Korridor erzeugt nur Draft-Outputs",
      "PA58 hat danach Human Approval und Operator-Handover geklaert",
      "Daten-, Auth-, Evidence-, Zielumgebungs- und Human-Approval-Schwesterrahmen"
    ]) {
      expect(doc).toContain(anchor);
    }
  });

  it("recommends keeping provider-capable draft paths read/draft-only and blocks write-effects", () => {
    for (const anchor of [
      "Option A:",
      "Option B:",
      "Option C:",
      "Minimale sichere Bedingungen fuer Option B:",
      "Klare Empfehlung:",
      "Option B in der kleinsten moeglichen Form",
      "read- und draft-only bleiben die einzige zulaessige Tool-Reichweite",
      "keine Write-Tools fuer Spec-Aenderung, Planerzeugung, Einkaufsliste, Antwortspeicherung, Archivierung oder Export-Freigabe",
      "`writesProductObject: false` bleibt fuehrende harte Grenze",
      "keine Tool-Orchestrierung mit Schreibwirkung"
    ]) {
      expect(doc).toContain(anchor);
    }
  });

  it("keeps the new frame discoverable from core references", () => {
    expect(readme).toContain(docPath);
    expect(testing).toContain(docPath);
    expect(testing).toContain("tests/pa59-llm-tool-write-effect-decision-frame.test.ts");
    expect(memory).toContain(docPath);
  });
});
