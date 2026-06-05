import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const docPath = "docs/architecture/PA56_LLM_RETENTION_EVIDENCE_DECISION_FRAME.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";
const readme = readFileSync("README.md", "utf8");
const testing = readFileSync("TESTING.md", "utf8");
const memory = readFileSync("memory.md", "utf8");

describe("PA56 LLM retention/evidence decision frame", () => {
  it("anchors the next retention/evidence frame as documentation-only and not runtime work", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA56 LLM Prompt-/Response-Retention- und Evidence-Entscheidungsrahmen");
    expect(doc).toContain("Status: Entscheidungsvorlage und Vertragstest, keine neue Runtime-Implementierung");
    expect(doc).toContain("kein Deployment");
    expect(doc).toContain("keine neuen APIs");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("keine Migration");
    expect(doc).toContain("keine echten Daten");
    expect(doc).toContain("keine Backup-Aktivierung");
    expect(doc).toContain("keine Produktschreibwirkung");
  });

  it("treats PA50-PA55 plus B13/B36 as the leading anchors for prompt/response evidence boundaries", () => {
    for (const anchor of [
      "PA54 hat den Datenrahmen oberhalb von `synthetic_live` getrennt",
      "PA55 hat die Schwesterfrage nach Trusted-Operator-/Auth-Kontext geklaert",
      "lokaler `synthetic_live`-Korridor mit `preflight`, `probe`, `probe:strict`",
      "lokales Operator-Runbook mit klarer Grenze gegen Raw Prompt-/Response-",
      "B13 bleibt fuehrendes Gate",
      "keine Gleichsetzung mit B36-Backup-Retention fuer Pilotartefakte"
    ]) {
      expect(doc).toContain(anchor);
    }
  });

  it("recommends structured defaults plus only tightly bounded local redacted review excerpts", () => {
    for (const anchor of [
      "Option A:",
      "Option B:",
      "Option C:",
      "Minimale sichere Bedingungen fuer Option B:",
      "Klare Empfehlung:",
      "Option B in der kleinsten moeglichen Form",
      "`AgentAudit`, `RunResult` und strukturierte Eval-Felder bleiben der",
      "nur bewusst begrenzte, redigierte und lokal verbleibende Ausschnitte",
      "keine Raw Prompt-/Response-Archive",
      "keine Repo-/PR-/Ticket-/Chat-Spiegelung",
      "Human Approval bleibt Pflicht"
    ]) {
      expect(doc).toContain(anchor);
    }
  });

  it("keeps the new frame discoverable from core references", () => {
    expect(readme).toContain(docPath);
    expect(testing).toContain(docPath);
    expect(testing).toContain("tests/pa56-llm-retention-evidence-decision-frame.test.ts");
    expect(memory).toContain(docPath);
  });
});
