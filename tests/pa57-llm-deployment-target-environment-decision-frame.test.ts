import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const docPath = "docs/architecture/PA57_LLM_DEPLOYMENT_TARGET_ENVIRONMENT_DECISION_FRAME.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";
const readme = readFileSync("README.md", "utf8");
const testing = readFileSync("TESTING.md", "utf8");
const memory = readFileSync("memory.md", "utf8");

describe("PA57 LLM deployment/target environment decision frame", () => {
  it("anchors the next deployment frame as documentation-only and not runtime work", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA57 LLM Deployment-/Zielumgebungs-Entscheidungsrahmen");
    expect(doc).toContain("Status: Entscheidungsvorlage und Vertragstest, keine neue Runtime-Implementierung");
    expect(doc).toContain("kein Deployment");
    expect(doc).toContain("keine Serveraenderung");
    expect(doc).toContain("keine SSH-Verbindung");
    expect(doc).toContain("keine Secret-Erstellung");
    expect(doc).toContain("keine neue API");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("keine Migration");
    expect(doc).toContain("keine echten Daten");
    expect(doc).toContain("keine Produktschreibwirkung");
  });

  it("uses PA54-PA56 and B25-B37/PA9 as leading anchors above the local corridor", () => {
    for (const anchor of [
      "PA54 hat den Datenrahmen oberhalb von `synthetic_live` getrennt",
      "PA55 hat die Trusted-Operator-/Auth-Frage nachgezogen",
      "PA56 hat danach den Prompt-/Response-Retention- und Evidence-Rahmen geschaerft",
      "Hetzner-/Deployment-Anker B25-B37 als nicht-sensitive Zielumgebungs- und Vorbereitungsgrenzen",
      "lokaler `synthetic_live`-Korridor mit `preflight`, `probe`, `probe:strict` und `check`"
    ]) {
      expect(doc).toContain(anchor);
    }
  });

  it("recommends only a deployment-gated non-local frame and forbids reading local green signals as deployment go", () => {
    for (const anchor of [
      "Option A:",
      "Option B:",
      "Option C:",
      "Minimale sichere Bedingungen fuer Option B:",
      "Klare Empfehlung:",
      "Option B in der kleinsten moeglichen Form",
      "kein nicht-lokaler Draft-Pfad ohne B25-B37- und PA9-/B9-konformen Zielumgebungsrahmen",
      "keine lokalen Probe-, Preflight- oder Strict-Check-Erfolge als Deployment-Go",
      "Alexanders Hetzner-Zielumgebung bleibt nur ein vorbereiteter Entscheidungsanker",
      "keine neue API, keine Persistenz, keine Produktschreibwirkung"
    ]) {
      expect(doc).toContain(anchor);
    }
  });

  it("keeps the new frame discoverable from core references", () => {
    expect(readme).toContain(docPath);
    expect(testing).toContain(docPath);
    expect(testing).toContain("tests/pa57-llm-deployment-target-environment-decision-frame.test.ts");
    expect(memory).toContain(docPath);
  });
});
