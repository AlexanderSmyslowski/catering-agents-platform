import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const docPath = "docs/architecture/PA58_LLM_HUMAN_APPROVAL_OPERATOR_HANDOVER_DECISION_FRAME.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";
const readme = readFileSync("README.md", "utf8");
const testing = readFileSync("TESTING.md", "utf8");
const memory = readFileSync("memory.md", "utf8");

describe("PA58 LLM human approval/operator handover decision frame", () => {
  it("anchors the next human-approval frame as documentation-only and not runtime work", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA58 LLM Human-Approval-/Operator-Handover-Entscheidungsrahmen");
    expect(doc).toContain("Status: Entscheidungsvorlage und Vertragstest, keine neue Runtime-Implementierung");
    expect(doc).toContain("kein Deployment");
    expect(doc).toContain("keine neue Approval-Engine");
    expect(doc).toContain("keine neue API");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("keine Migration");
    expect(doc).toContain("keine echten Daten");
    expect(doc).toContain("keine Produktschreibwirkung");
  });

  it("uses PA51/PA55/PA56/PA57 plus existing approval truth as leading anchors", () => {
    for (const anchor of [
      "`humanApprovalRequired` ist im LLM-Readiness-Vertrag ein fuehrender Pflichtmarker",
      "lokaler `synthetic_live`-Korridor mit benannten Operatoren",
      "repo-weit bleibt `ApprovalRequestRecord` die fuehrende Freigabewahrheit",
      "PA55 hat die Trusted-Operator-/Auth-Frage nachgezogen",
      "PA56 hat den Prompt-/Response-Retention- und Evidence-Rahmen geschaerft",
      "PA57 hat danach den Deployment-/Zielumgebungsrahmen"
    ]) {
      expect(doc).toContain(anchor);
    }
  });

  it("recommends a strict human-in-the-loop handover and rejects silent self-approval", () => {
    for (const anchor of [
      "Option A:",
      "Option B:",
      "Option C:",
      "Minimale sichere Bedingungen fuer Option B:",
      "Klare Empfehlung:",
      "Option B in der kleinsten moeglichen Form",
      "kein stilles Self-Approval ohne klaren Review-/Handover-Rahmen",
      "bestehende `ApprovalRequestRecord`-Wahrheit nicht umgehen",
      "Human Approval nie durch Eval-Match, Probe-Gruen, Trusted-Header oder Zielumgebungs-Go ersetzen",
      "keine neue API, keine Persistenz, keine Produktschreibwirkung"
    ]) {
      expect(doc).toContain(anchor);
    }
  });

  it("keeps the new frame discoverable from core references", () => {
    expect(readme).toContain(docPath);
    expect(testing).toContain(docPath);
    expect(testing).toContain("tests/pa58-llm-human-approval-operator-handover-decision-frame.test.ts");
    expect(memory).toContain(docPath);
  });
});
