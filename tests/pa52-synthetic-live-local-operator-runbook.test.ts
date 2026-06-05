import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const docPath = "docs/architecture/PA52_SYNTHETIC_LIVE_LOCAL_OPERATOR_RUNBOOK.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";
const readme = readFileSync("README.md", "utf8");
const testing = readFileSync("TESTING.md", "utf8");
const memory = readFileSync("memory.md", "utf8");

describe("PA52 synthetic-live local operator runbook", () => {
  it("keeps the runbook documentation-only and bounded to the existing local corridor", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA52 Synthetic-Live Local Operator Runbook");
    expect(doc).toContain("Status: Doku-/Vertragstest-only Operator-Runbook, keine neue Runtime-Implementierung");
    expect(doc).toContain("kein Deployment");
    expect(doc).toContain("keine neuen APIs");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("keine echten Daten");
    expect(doc).toContain("keine Schreibwirkung");
  });

  it("operationalizes PA51 option B as the smallest local operator frame", () => {
    for (const anchor of [
      "PA51 empfiehlt Option B in der kleinsten lokalen Form",
      "benannte interne Operatoren",
      "lokale Ausfuehrung auf einer eigenen Workstation oder in einem bewusst",
      "synthetische oder Demo-Fixtures",
      "produktfreie Clarification-Drafts",
      "bestehenden Repo-Korridor aus `preflight`, `probe`, `probe:strict` und",
      "Raw Prompt-/Response-Sammlungen in Repo, PR, Ticket oder Chat"
    ]) {
      expect(doc).toContain(anchor);
    }
  });

  it("documents the local prerequisites, run commands, and stop criteria", () => {
    for (const anchor of [
      "`CATERING_SYNTHETIC_LLM_SLICE=1`",
      "`OPENAI_API_KEY` nur lokal ausserhalb des Repos gesetzt",
      "`CATERING_SYNTHETIC_LLM_MODEL` bewusst lokal gesetzt",
      "nur ein vorab freigegebenes Low-Cost-Modell pro Operatorfenster",
      "expliziter Test- oder Monatskostenrahmen",
      "npm run llm:synthetic-live:preflight",
      "npm run llm:synthetic-live:check",
      "npm run llm:synthetic-live:probe",
      "probe:strict",
      "Eval-Drift",
      "nicht-lokales Zielsystem"
    ]) {
      expect(doc).toContain(anchor);
    }
  });

  it("keeps human approval, no-write boundaries, and discoverability explicit", () => {
    for (const anchor of [
      "Human Approval bleibt Pflicht",
      "Selbstfreigabe-Signal fuer Produktobjekte",
      "keine automatische Uebernahme",
      "keine Produktschreibwirkung",
      "keine Runtime-Ausweitung ohne neue Alexander-Entscheidung"
    ]) {
      expect(doc).toContain(anchor);
    }

    expect(readme).toContain(docPath);
    expect(testing).toContain(docPath);
    expect(testing).toContain("tests/pa52-synthetic-live-local-operator-runbook.test.ts");
    expect(memory).toContain(docPath);
  });
});
