import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const gapMapPath = "docs/product/P6_B56_BETA_ONBOARDING_ISTSTAND_LUECKENKARTE.md";
const gapMapDoc = existsSync(gapMapPath) ? readFileSync(gapMapPath, "utf8") : "";
const readmeDoc = readFileSync("README.md", "utf8");
const testingDoc = readFileSync("TESTING.md", "utf8");
const c8Doc = readFileSync("docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md", "utf8");
const checklistDoc = readFileSync("docs/product/P5_B54_MANUELLE_BETA_TEST_CHECKLISTE.md", "utf8");

const requiredSections = [
  "Schon klar",
  "Verstreute Start-/Test-/Stop-Schritte",
  "Wahrscheinliche Reibung fuer interne Nutzer",
  "Lueckenkarte",
  "Starten -> Durchlaufen -> Reibung notieren -> Stop-Gates"
];

const requiredBoundaries = [
  "intern testbar",
  "nur synthetisch",
  "blockiert",
  "verboten",
  "keine echten Daten",
  "kein Deployment",
  "keine SSH-Verbindung",
  "keine Secrets",
  "keine neue Persistenz",
  "kein OAuth/Login/OIDC",
  "keine automatische Spec-Korrektur",
  "keine Rezept-/Allergenautomatik"
];

describe("P6-B56 beta onboarding gap map contract", () => {
  it("anchors the beta onboarding path and gap map for Plan 6", () => {
    expect(existsSync(gapMapPath)).toBe(true);
    expect(gapMapDoc).toContain("P6-B56 Beta-Onboarding-Iststand und Lueckenkarte");
    expect(gapMapDoc).toContain("Starten -> Durchlaufen -> Reibung notieren -> Stop-Gates");

    for (const section of requiredSections) {
      expect(gapMapDoc).toContain(section);
    }
  });

  it("keeps the allowed and blocked beta states explicit", () => {
    for (const boundary of requiredBoundaries) {
      expect(gapMapDoc).toContain(boundary);
    }
  });

  it("keeps the onboarding gap map discoverable from existing runbook anchors", () => {
    expect(readmeDoc).toContain("P6_B56_BETA_ONBOARDING_ISTSTAND_LUECKENKARTE.md");
    expect(testingDoc).toContain("tests/p6-b56-beta-onboarding-gap-map-contract.test.ts");
    expect(testingDoc).toContain("P6-B56 Beta-Onboarding-Iststand und Lueckenkarte");
    expect(c8Doc).toContain("P6_B56_BETA_ONBOARDING_ISTSTAND_LUECKENKARTE.md");
    expect(checklistDoc).toContain("P6_B56_BETA_ONBOARDING_ISTSTAND_LUECKENKARTE.md");
  });
});
