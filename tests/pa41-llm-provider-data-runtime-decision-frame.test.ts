import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const docPath = "docs/architecture/PA41_LLM_PROVIDER_DATA_RUNTIME_DECISION_FRAME.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";
const readme = readFileSync("README.md", "utf8");
const testing = readFileSync("TESTING.md", "utf8");
const memory = readFileSync("memory.md", "utf8");

describe("PA41 LLM provider/data/runtime decision frame", () => {
  it("anchors the decision frame as documentation-only and not runtime work", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA41 LLM Provider-/Daten-/Runtime-Entscheidungsrahmen");
    expect(doc).toContain("Status: Entscheidungsvorlage und Vertragstest, keine Runtime-Implementierung");
    expect(doc).toContain("kein Provider");
    expect(doc).toContain("keine Modellaufrufe");
    expect(doc).toContain("keine API");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("keine echten Daten");
    expect(doc).toContain("keine Schreibwirkung");
  });

  it("states that the providerless readiness corridor is complete through PA40", () => {
    for (const anchor of [
      "PA26 bis PA40 haben den providerlosen LLM-Readiness-Korridor geschlossen",
      "Model-Input/Output -> Eval-Fixture -> Draft-Registry -> Input-/Output-Validation -> Prompt-/Schema-Registry -> Fixture-ProviderAdapter -> AgentAudit -> Run-Result",
      "deterministischer interner Rehearsal-Kern mit browsernahen Smokes",
      "providerlose LLM-Readiness-Kette bis `Run-Result`"
    ]) {
      expect(doc).toContain(anchor);
    }
  });

  it("presents an explicit decision template with options, recommendation, consequence and safe default", () => {
    for (const anchor of [
      "Entscheidung noetig",
      "Warum jetzt?",
      "Option A:",
      "Option B:",
      "Option C:",
      "Empfehlung",
      "Konsequenz",
      "Sicherer Default"
    ]) {
      expect(doc).toContain(anchor);
    }
  });

  it("recommends a minimal synthetic-only provider slice and keeps broader runtime blocked", () => {
    for (const anchor of [
      "Option B in der minimalen sicheren Form",
      "nur synthetic/demo Daten",
      "kein Write-Tool",
      "kein automatisches Schreiben in `AcceptedEventSpec`, `ProductionPlan` oder `PurchaseList`",
      "Secrets nur ausserhalb des Repos",
      "explizites Kostenlimit und abschaltbarer Feature-Flag",
      "Option C",
      "Runtime-`ConversationSession`",
      "Write-Tool-Orchestrierung"
    ]) {
      expect(doc).toContain(anchor);
    }
  });

  it("keeps the decision frame discoverable from core references", () => {
    expect(readme).toContain(docPath);
    expect(testing).toContain(docPath);
    expect(testing).toContain("tests/pa41-llm-provider-data-runtime-decision-frame.test.ts");
    expect(memory).toContain(docPath);
  });
});
