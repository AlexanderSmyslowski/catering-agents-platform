import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const checklistPath = "docs/product/P5_B54_MANUELLE_BETA_TEST_CHECKLISTE.md";
const checklistDoc = existsSync(checklistPath) ? readFileSync(checklistPath, "utf8") : "";
const readmeDoc = readFileSync("README.md", "utf8");
const testingDoc = readFileSync("TESTING.md", "utf8");
const c8Doc = readFileSync("docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md", "utf8");
const b12Doc = readFileSync("docs/product/B12_LOCAL_DEMO_RESULT_NOTE.md", "utf8");

describe("P5-B54 manual beta checklist contract", () => {
  it("adds an Alexander-facing manual beta checklist without creating a new QA platform", () => {
    expect(existsSync(checklistPath)).toBe(true);
    expect(checklistDoc).toContain("P5-B54 Manuelle Beta-Test-Checkliste fuer Alexander");
    expect(checklistDoc).toContain("Scope: manueller interner Beta-Durchgang");
    expect(checklistDoc).toContain("keine neue QA-Plattform");
    expect(checklistDoc).toContain("keine neue Produktlogik");
    expect(checklistDoc).toContain("kein Deployment");
  });

  it("names URLs, order, expected visible markers, and result-note fields", () => {
    for (const requiredAnchor of [
      "http://127.0.0.1:3200/",
      "http://127.0.0.1:3200/angebot",
      "http://127.0.0.1:3200/produktion",
      "Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit",
      "Beta-Weg",
      "Angebots-HTML",
      "Produktionsblatt",
      "Einkaufsliste",
      "Audit-Spur",
      "Agent fragt · offen",
      "Agent fragt · beantwortet",
      "Synthetische Demo-Antwort",
      "Reibungspunkt",
      "B12-Ergebnisvermerk"
    ]) {
      expect(checklistDoc).toContain(requiredAnchor);
    }
  });

  it("keeps stop gates and non-release boundaries explicit", () => {
    for (const boundary of [
      "keine echten Daten",
      "keine Produktionsfreigabe",
      "keine externe Freigabe",
      "keine rechtssichere Audit-/Compliance-Aussage",
      "kein OAuth/Login/OIDC",
      "keine automatische Spec-Korrektur",
      "keine Rezept-/Allergenautomatik",
      "Sandbox/Worker/AV",
      "PII/Retention/Backup"
    ]) {
      expect(checklistDoc).toContain(boundary);
    }
  });

  it("keeps the checklist discoverable from README, TESTING, C8, and B12", () => {
    expect(readmeDoc).toContain("P5_B54_MANUELLE_BETA_TEST_CHECKLISTE.md");
    expect(testingDoc).toContain("tests/p5-b54-manual-beta-checklist-contract.test.ts");
    expect(testingDoc).toContain("P5-B54 Manuelle Beta-Test-Checkliste");
    expect(c8Doc).toContain("P5_B54_MANUELLE_BETA_TEST_CHECKLISTE.md");
    expect(b12Doc).toContain("P5_B54_MANUELLE_BETA_TEST_CHECKLISTE.md");
  });
});
