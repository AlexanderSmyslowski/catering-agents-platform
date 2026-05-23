import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const scenarioCardPath = "docs/product/P7_B64_SYNTHETISCHE_SZENARIO_UND_DATENKARTE.md";
const scenarioCardDoc = existsSync(scenarioCardPath) ? readFileSync(scenarioCardPath, "utf8") : "";
const readmeDoc = readFileSync("README.md", "utf8");
const testingDoc = readFileSync("TESTING.md", "utf8");
const startCardDoc = readFileSync("docs/product/P7_B63_REVIEWER_REHEARSAL_STARTKARTE.md", "utf8");
const frictionLogDoc = readFileSync("docs/product/P6_B58_BETA_REIBUNGSLOG_VORLAGE.md", "utf8");

const requiredScenarioAnchors = [
  "P7-B64 Synthetische Szenario- und Datenkarte",
  "klar fiktives Szenario",
  "Keine echten Kunden-, Personen- oder Einsatzdaten",
  "Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit",
  "Beispielkunde: Testfirma Nordstern Demo GmbH",
  "Kontaktperson: Erika Beispiel",
  "Ort: Musterhalle 7, 12345 Beispielstadt",
  "Termin: 15. Oktober 2099, 18:00 Uhr",
  "Anlass: internes Probe-Catering fuer 42 fiktive Gaeste",
  "synthetisches Testdokument"
];

const requiredSafetyBoundaries = [
  "keine echten Namen",
  "keine echten Telefonnummern",
  "keine echten E-Mail-Adressen",
  "keine echten Adressen",
  "keine echten Termine",
  "keine echten Dokumentinhalte",
  "keine Kundendaten",
  "keine Mitarbeiterdaten",
  "keine Einsatzdaten",
  "keine produktionsnahen Pilotdaten"
];

describe("P7-B64 synthetic scenario and data card contract", () => {
  it("anchors one clearly fictional scenario for the manual beta rehearsal", () => {
    expect(existsSync(scenarioCardPath)).toBe(true);

    for (const anchor of requiredScenarioAnchors) {
      expect(scenarioCardDoc).toContain(anchor);
    }
  });

  it("prevents confusion with real usage and real data entry", () => {
    for (const boundary of requiredSafetyBoundaries) {
      expect(scenarioCardDoc).toContain(boundary);
    }

    expect(scenarioCardDoc).toContain("Stop statt Eingabe");
    expect(scenarioCardDoc).toContain("keine neue Seed-Daten-Quelle");
    expect(scenarioCardDoc).toContain("keine Persistenz- oder Datenmodell-Aenderung");
  });

  it("keeps the scenario card discoverable from existing beta rehearsal anchors", () => {
    for (const doc of [readmeDoc, testingDoc, startCardDoc, frictionLogDoc]) {
      expect(doc).toContain("P7_B64_SYNTHETISCHE_SZENARIO_UND_DATENKARTE.md");
    }

    expect(testingDoc).toContain("tests/p7-b64-synthetic-scenario-data-card-contract.test.ts");
    expect(readmeDoc).toContain("P7-B64");
  });
});
