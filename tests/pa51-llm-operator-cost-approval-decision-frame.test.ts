import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const docPath = "docs/architecture/PA51_LLM_OPERATOR_COST_APPROVAL_DECISION_FRAME.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";
const readme = readFileSync("README.md", "utf8");
const testing = readFileSync("TESTING.md", "utf8");
const memory = readFileSync("memory.md", "utf8");

describe("PA51 LLM operator/cost/approval decision frame", () => {
  it("anchors the next decision frame as documentation-only and not runtime work", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA51 LLM Operator-/Kosten-/Approval-Entscheidungsrahmen");
    expect(doc).toContain("Status: Entscheidungsvorlage und Vertragstest, keine neue Runtime-Implementierung");
    expect(doc).toContain("kein Deployment");
    expect(doc).toContain("keine neuen APIs");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("keine echten Daten");
    expect(doc).toContain("keine Schreibwirkung");
  });

  it("states that PA42-PA50 already implemented the local synthetic-live corridor", () => {
    for (const anchor of [
      "PA41 hat den ersten echten synthetic-only Provider-Slice entscheidungsreif",
      "PA42 bis PA50 haben diesen kleinsten Korridor jetzt lokal umgesetzt",
      "synthetic_live slice -> audit/run-result -> probe -> eval comparison -> strict probe -> preflight -> strict evidence corridor",
      "lokaler `synthetic_live`-Clarification-Draft hinter Feature-Flag",
      "`preflight`, `probe`, `probe:strict` und `check`"
    ]) {
      expect(doc).toContain(anchor);
    }
  });

  it("presents an explicit operator/cost/approval decision template with options and safe default", () => {
    for (const anchor of [
      "Entscheidung noetig",
      "Warum jetzt?",
      "Option A:",
      "Option B:",
      "Option C:",
      "Minimale sichere Bedingungen fuer Option B:",
      "Empfehlung",
      "Konsequenz",
      "Sicherer Default"
    ]) {
      expect(doc).toContain(anchor);
    }
  });

  it("recommends the smallest local operator corridor and keeps broader expansion blocked", () => {
    for (const anchor of [
      "Option B in der kleinsten lokalen Form",
      "nur benannte interne Operatoren",
      "nur lokale Ausfuehrung ueber `npm run llm:synthetic-live:check`",
      "explizites Monats- oder Testbudget",
      "Secrets ausschliesslich ausserhalb des Repos",
      "Human Approval bleibt Pflicht",
      "keine Write-Tools",
      "keine neue API",
      "keine Persistenz",
      "keine Runtime-`ConversationSession`",
      "Option C"
    ]) {
      expect(doc).toContain(anchor);
    }
  });

  it("keeps the new decision frame discoverable from core references", () => {
    expect(readme).toContain(docPath);
    expect(testing).toContain(docPath);
    expect(testing).toContain("tests/pa51-llm-operator-cost-approval-decision-frame.test.ts");
    expect(memory).toContain(docPath);
  });
});
