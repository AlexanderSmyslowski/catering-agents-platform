import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const briefPath = "docs/product/P6_B61_BETA_MANAGEMENT_ENTSCHEIDUNGSVORLAGE.md";
const briefDoc = existsSync(briefPath) ? readFileSync(briefPath, "utf8") : "";
const readmeDoc = readFileSync("README.md", "utf8");
const testingDoc = readFileSync("TESTING.md", "utf8");
const c8Doc = readFileSync("docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md", "utf8");
const checklistDoc = readFileSync("docs/product/P5_B54_MANUELLE_BETA_TEST_CHECKLISTE.md", "utf8");
const gapMapDoc = readFileSync("docs/product/P6_B56_BETA_ONBOARDING_ISTSTAND_LUECKENKARTE.md", "utf8");
const startStatusDoc = readFileSync("docs/product/P6_B57_LOKALER_START_STATUS_KORRIDOR.md", "utf8");
const frictionLogDoc = readFileSync("docs/product/P6_B58_BETA_REIBUNGSLOG_VORLAGE.md", "utf8");

const requiredSections = [
  "Sofort manuell testbar",
  "Stop-Gates",
  "No-go",
  "Naechster enger Produktwertblock nach Feedback",
  "Entscheidung fuer Alexander"
];

const requiredPlan6Anchors = [
  "P6-B56",
  "P6-B57",
  "P6-B58",
  "P6-B59",
  "P6-B60"
];

describe("P6-B61 beta management decision brief contract", () => {
  it("anchors a concise management decision brief for the beta walkthrough", () => {
    expect(existsSync(briefPath)).toBe(true);
    expect(briefDoc).toContain("P6-B61 Beta-Durchlauf als Management-Entscheidungsvorlage");
    expect(briefDoc).toContain("Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit");

    for (const section of requiredSections) {
      expect(briefDoc).toContain(section);
    }

    for (const anchor of requiredPlan6Anchors) {
      expect(briefDoc).toContain(anchor);
    }
  });

  it("separates testable beta scope from blocked and forbidden scope", () => {
    for (const expected of [
      "sofort testbar",
      "nur mit Demo-/Seed-/synthetischen Daten",
      "keine echten Daten",
      "kein Deployment",
      "keine SSH-Verbindung",
      "keine Secrets",
      "keine neue API",
      "keine neue Persistenz",
      "kein OAuth/Login/OIDC",
      "keine automatische Spec-Korrektur",
      "keine Rezept-/Allergenautomatik",
      "keine Produktionsfreigabe",
      "keine externe Freigabe",
      "keine rechtssichere Audit-/Compliance-Aussage"
    ]) {
      expect(briefDoc).toContain(expected);
    }
  });

  it("recommends feedback-led next work instead of more micro-expansion", () => {
    expect(briefDoc).toContain("kein weiterer Mikroausbau ohne beobachtete Reibung");
    expect(briefDoc).toContain("erst Reibungslog ausfuellen");
    expect(briefDoc).toContain("naechster kleiner UI-/Doku-/Smoke-Slice nur aus einem konkreten Reibungspunkt");
    expect(briefDoc).toContain("Wenn keine echte Reibung beobachtet wird: stoppen und P6-B62 Full Gates/Lage vorbereiten");
  });

  it("keeps the decision brief discoverable from existing beta onboarding anchors", () => {
    for (const doc of [readmeDoc, testingDoc, c8Doc, checklistDoc, gapMapDoc, startStatusDoc, frictionLogDoc]) {
      expect(doc).toContain("P6_B61_BETA_MANAGEMENT_ENTSCHEIDUNGSVORLAGE.md");
    }

    expect(testingDoc).toContain("tests/p6-b61-beta-management-decision-brief-contract.test.ts");
    expect(readmeDoc).toContain("P6-B61");
  });
});
