import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const frictionLogPath = "docs/product/P6_B58_BETA_REIBUNGSLOG_VORLAGE.md";
const frictionLogDoc = existsSync(frictionLogPath) ? readFileSync(frictionLogPath, "utf8") : "";
const readmeDoc = readFileSync("README.md", "utf8");
const testingDoc = readFileSync("TESTING.md", "utf8");
const c8Doc = readFileSync("docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md", "utf8");
const checklistDoc = readFileSync("docs/product/P5_B54_MANUELLE_BETA_TEST_CHECKLISTE.md", "utf8");
const gapMapDoc = readFileSync("docs/product/P6_B56_BETA_ONBOARDING_ISTSTAND_LUECKENKARTE.md", "utf8");
const startStatusDoc = readFileSync("docs/product/P6_B57_LOKALER_START_STATUS_KORRIDOR.md", "utf8");

const requiredFields = [
  "Beobachtung",
  "Route",
  "Erwartetes Verhalten",
  "Tatsaechliches Verhalten",
  "Schweregrad",
  "Screenshot-Hinweis ohne personenbezogene Daten",
  "Naechste Entscheidung"
];

const requiredBoundaries = [
  "keine echten Daten",
  "Demo-/Seed-/synthetischen Daten",
  "keine personenbezogenen Daten",
  "keine externe QA-Plattform",
  "keine neue Speicherung echter Nutzerdaten",
  "keine Produktionsfreigabe",
  "keine externe Freigabe",
  "keine rechtssichere Audit-/Compliance-Aussage"
];

describe("P6-B58 beta friction log template contract", () => {
  it("anchors a safe manual beta friction log template with the required fields", () => {
    expect(existsSync(frictionLogPath)).toBe(true);
    expect(frictionLogDoc).toContain("P6-B58 Reibungslog fuer manuellen Beta-Durchlauf");
    expect(frictionLogDoc).toContain("Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit");

    for (const field of requiredFields) {
      expect(frictionLogDoc).toContain(field);
    }

    expect(frictionLogDoc).toContain("niedrig");
    expect(frictionLogDoc).toContain("mittel");
    expect(frictionLogDoc).toContain("hoch");
    expect(frictionLogDoc).toContain("blockierend");
  });

  it("keeps synthetic-data and non-release boundaries visible", () => {
    for (const boundary of requiredBoundaries) {
      expect(frictionLogDoc).toContain(boundary);
    }

    expect(frictionLogDoc).toContain("keine Kunden-, Mitarbeiter-, Einsatz-, Schicht-, Abrechnungs- oder produktionsnahen Pilotdaten");
    expect(frictionLogDoc).toContain("Screenshots nur ohne Namen, Kontaktdaten, Adressen, echte Termine oder echte Dokumentinhalte");
  });

  it("keeps the friction log discoverable from existing beta onboarding anchors", () => {
    for (const doc of [readmeDoc, testingDoc, c8Doc, checklistDoc, gapMapDoc, startStatusDoc]) {
      expect(doc).toContain("P6_B58_BETA_REIBUNGSLOG_VORLAGE.md");
    }

    expect(testingDoc).toContain("tests/p6-b58-beta-friction-log-template-contract.test.ts");
    expect(checklistDoc).toContain("Reibungslog-Vorlage");
    expect(gapMapDoc).toContain("P6-B58");
    expect(startStatusDoc).toContain("P6-B58");
  });
});
