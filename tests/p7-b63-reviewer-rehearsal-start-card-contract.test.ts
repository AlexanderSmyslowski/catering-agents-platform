import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const startCardPath = "docs/product/P7_B63_REVIEWER_REHEARSAL_STARTKARTE.md";
const startCardDoc = existsSync(startCardPath) ? readFileSync(startCardPath, "utf8") : "";
const readmeDoc = readFileSync("README.md", "utf8");
const testingDoc = readFileSync("TESTING.md", "utf8");
const checklistDoc = readFileSync("docs/product/P5_B54_MANUELLE_BETA_TEST_CHECKLISTE.md", "utf8");
const managementBriefDoc = readFileSync("docs/product/P6_B61_BETA_MANAGEMENT_ENTSCHEIDUNGSVORLAGE.md", "utf8");

const requiredReviewerAnchors = [
  "Reviewer-Rehearsal-Startkarte",
  "interner Reviewer",
  "fiktive Testrolle",
  "synthetisches Ziel",
  "Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit",
  "Demo-/Seed-/synthetischen Daten",
  "http://127.0.0.1:3200/",
  "http://127.0.0.1:3200/angebot",
  "http://127.0.0.1:3200/produktion"
];

const requiredStateBoundaries = [
  "synthetisch/testbar",
  "blockiert",
  "verboten",
  "keine echten Daten",
  "kein Deployment",
  "keine SSH-Verbindung",
  "keine Secrets",
  "keine neue Persistenz",
  "kein OAuth/Login/OIDC",
  "keine automatische Spec-Korrektur",
  "keine Rezept-/Allergenautomatik",
  "keine Produktionsfreigabe"
];

describe("P7-B63 reviewer rehearsal start card contract", () => {
  it("anchors a concise start card for the first manual beta rehearsal", () => {
    expect(existsSync(startCardPath)).toBe(true);

    for (const anchor of requiredReviewerAnchors) {
      expect(startCardDoc).toContain(anchor);
    }
  });

  it("separates synthetic test scope from blocked and forbidden scope", () => {
    for (const boundary of requiredStateBoundaries) {
      expect(startCardDoc).toContain(boundary);
    }

    expect(startCardDoc).toContain("keine Kunden-, Mitarbeiter-, Einsatz-, Schicht-, Abrechnungs- oder produktionsnahen Pilotdaten");
    expect(startCardDoc).toContain("Stop statt Freigabe");
  });

  it("keeps the start card discoverable from existing beta rehearsal anchors", () => {
    for (const doc of [readmeDoc, testingDoc, checklistDoc, managementBriefDoc]) {
      expect(doc).toContain("P7_B63_REVIEWER_REHEARSAL_STARTKARTE.md");
    }

    expect(testingDoc).toContain("tests/p7-b63-reviewer-rehearsal-start-card-contract.test.ts");
    expect(readmeDoc).toContain("P7-B63");
  });
});
