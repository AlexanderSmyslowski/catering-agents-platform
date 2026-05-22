import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const b12Path = "docs/product/B12_LOCAL_DEMO_RESULT_NOTE.md";
const b12Doc = existsSync(b12Path) ? readFileSync(b12Path, "utf8") : "";
const b11Doc = readFileSync("docs/product/B11_LOCAL_DEMO_PILOT_ACCEPTANCE_RUN.md", "utf8");
const c8Doc = readFileSync("docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md", "utf8");
const testingDoc = readFileSync("TESTING.md", "utf8");

const requiredProofs = [
  "`npm run local:status`",
  "`npm run local:check`",
  "tests/backoffice-route-smoke.test.ts",
  "tests/backoffice-production-acceptance-smoke.test.ts",
  "tests/backoffice-internal-usage-smoke.test.ts",
  "tests/pa8-read-path-auth.test.ts",
  "tests/pa14-document-ingestion-corridor-readiness.test.ts",
  "`npm test`",
  "`npm run build`",
  "`npm audit --omit=dev`",
  "`git diff --check`"
];

describe("B12 local demo result note contract", () => {
  it("adds a concrete local result-note anchor without introducing runtime or deployment scope", () => {
    expect(existsSync(b12Path)).toBe(true);
    expect(b12Doc).toContain("B12 Lokaler Demo-Ergebnisvermerk");
    expect(b12Doc).toContain("Stand: 2026-05-22");
    expect(b12Doc).toContain("Scope: lokaler interner Demo-Durchlauf");
    expect(b12Doc).toContain("keine neue Produktlogik");
    expect(b12Doc).toContain("keine neue API");
    expect(b12Doc).toContain("keine neue Persistenz");
    expect(b12Doc).toContain("kein Deployment-Code");
  });

  it("names the actual local proofs and the artifact sources that may carry the result without secrets or PII", () => {
    for (const requiredProof of requiredProofs) {
      expect(b12Doc).toContain(requiredProof);
    }

    for (const requiredSource of [
      "Befehlsergebnisse im lokalen Terminal",
      "Repo-Tests und Vitest-Ausgaben",
      "Build- und Audit-Ausgaben",
      "read-only Export-/Arbeitsbelege",
      "Demo-Start-/Auditbeleg",
      "keine Secrets",
      "keine personenbezogenen Daten",
      "keine echten Kunden-/Pilotdaten"
    ]) {
      expect(b12Doc).toContain(requiredSource);
    }
  });

  it("requires an explicit result state and blocks overclaiming from local green checks", () => {
    for (const stateAnchor of ["`go`", "`blocked`", "`not assessed`", "Ergebniszustand"]) {
      expect(b12Doc).toContain(stateAnchor);
    }

    expect(b12Doc).toContain("interne Demo-Abnahmefaehigkeit");
    expect(b12Doc).toContain("kein produktionsnaher Pilot");
    expect(b12Doc).toContain("keine externe Freigabe");
    expect(b12Doc).toContain("keine rechtssichere Compliance-/Audit-Aussage");
    expect(b12Doc).toContain("darf daraus gerade NICHT abgeleitet werden");
  });

  it("keeps the unresolved production-like gates blocked or not assessed and names Alexander's next decision", () => {
    for (const unresolvedGate of [
      "konkrete Zielumgebung",
      "B10-Preflight-Ausfuellung",
      "PII/Retention/Backup",
      "Sandbox/Worker/AV",
      "blocked/not assessed"
    ]) {
      expect(b12Doc).toContain(unresolvedGate);
    }

    expect(b12Doc).toContain("Naechste Entscheidung fuer Alexander");
    expect(b12Doc).toContain("konkrete Zielumgebung benannt wird");
    expect(b12Doc).toContain("PII/Retention/Backup");
    expect(b12Doc).toContain("Sandbox/AV");
  });

  it("keeps B12 discoverable from B11, C8, and TESTING", () => {
    expect(b11Doc).toContain("B12_LOCAL_DEMO_RESULT_NOTE.md");
    expect(c8Doc).toContain("B12_LOCAL_DEMO_RESULT_NOTE.md");
    expect(testingDoc).toContain("tests/b12-local-demo-result-note-contract.test.ts");
    expect(testingDoc).toContain("B12 Lokaler Demo-Ergebnisvermerk");
  });
});
