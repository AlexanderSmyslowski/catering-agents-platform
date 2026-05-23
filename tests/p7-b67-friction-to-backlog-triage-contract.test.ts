import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const triagePath = "docs/product/P7_B67_REIBUNG_ZU_BACKLOG_TRIAGE.md";
const triageDoc = existsSync(triagePath) ? readFileSync(triagePath, "utf8") : "";
const readmeDoc = readFileSync("README.md", "utf8");
const testingDoc = readFileSync("TESTING.md", "utf8");
const frictionLogDoc = readFileSync("docs/product/P6_B58_BETA_REIBUNGSLOG_VORLAGE.md", "utf8");
const managementBriefDoc = readFileSync("docs/product/P6_B61_BETA_MANAGEMENT_ENTSCHEIDUNGSVORLAGE.md", "utf8");
const evidencePackDoc = readFileSync("docs/product/P7_B65_EXPORT_AUDIT_ROUTE_EVIDENZPAKET.md", "utf8");

const requiredTriageAnchors = [
  "P7-B67 Reibung-zu-Backlog-Triage",
  "Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit",
  "P6_B58_BETA_REIBUNGSLOG_VORLAGE.md",
  "P6_B61_BETA_MANAGEMENT_ENTSCHEIDUNGSVORLAGE.md",
  "P7_B65_EXPORT_AUDIT_ROUTE_EVIDENZPAKET.md",
  "sofort kleiner Fix",
  "spaeter",
  "Entscheidung noetig",
  "out of scope/verboten"
];

const requiredDecisionAnchors = [
  "Beobachtung",
  "Route",
  "Schweregrad",
  "Beleg",
  "naechste kleinste sichere Produktwertblock",
  "keine unsortierte Wunschliste",
  "keine Produktlogik",
  "keine neue API",
  "keine neue Persistenz",
  "keine echten Daten",
  "kein Deployment",
  "kein OAuth/Login/OIDC",
  "keine automatische Spec-Korrektur",
  "keine Rezept-/Allergenautomatik"
];

describe("P7-B67 friction to backlog triage contract", () => {
  it("anchors a small triage matrix for observed beta rehearsal friction", () => {
    expect(existsSync(triagePath)).toBe(true);

    for (const anchor of requiredTriageAnchors) {
      expect(triageDoc).toContain(anchor);
    }
  });

  it("keeps triage tied to evidence, guardrails, and the next smallest safe product-value block", () => {
    for (const anchor of requiredDecisionAnchors) {
      expect(triageDoc).toContain(anchor);
    }

    expect(triageDoc).toContain("blocked wegen Gate");
    expect(triageDoc).toContain("Alexander-Entscheidung noetig");
    expect(triageDoc).toContain("weiter beobachten");
  });

  it("keeps the triage anchor discoverable from existing rehearsal documents", () => {
    for (const doc of [readmeDoc, testingDoc, frictionLogDoc, managementBriefDoc, evidencePackDoc]) {
      expect(doc).toContain("P7_B67_REIBUNG_ZU_BACKLOG_TRIAGE.md");
    }

    expect(testingDoc).toContain("tests/p7-b67-friction-to-backlog-triage-contract.test.ts");
    expect(readmeDoc).toContain("P7-B67");
  });
});
