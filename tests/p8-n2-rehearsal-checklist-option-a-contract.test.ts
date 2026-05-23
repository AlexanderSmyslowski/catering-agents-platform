import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const startCardDoc = readFileSync("docs/product/P7_B63_REVIEWER_REHEARSAL_STARTKARTE.md", "utf8");
const scenarioCardDoc = readFileSync("docs/product/P7_B64_SYNTHETISCHE_SZENARIO_UND_DATENKARTE.md", "utf8");
const evidencePackDoc = readFileSync("docs/product/P7_B65_EXPORT_AUDIT_ROUTE_EVIDENZPAKET.md", "utf8");

const optionAChecklistAnchors = [
  "Option-A-Zeitfenster fuer interne Testperson",
  "Zeitfenster manuell notieren",
  "keine automatische event.schedule-Uebernahme",
  "kein Schedule-/Zeitfenster-Datenmodell",
  "keine automatische Spec-Korrektur",
  "Zeitfenster-Rehearsal-Notiz"
];

const evidenceCollectionAnchors = [
  "Route",
  "Erwartung",
  "Beobachtung",
  "Beleg",
  "Export-/Auditbeleg",
  "Naechste Entscheidung",
  "Zeitfenster-Rehearsal-Notiz"
];

describe("P8-N2 rehearsal checklist option A contract", () => {
  it("tells an internal test person where the schedule window is manually noted", () => {
    for (const anchor of optionAChecklistAnchors) {
      expect(startCardDoc).toContain(anchor);
    }

    expect(startCardDoc).toContain("docs/product/P7_B65_EXPORT_AUDIT_ROUTE_EVIDENZPAKET.md");
    expect(scenarioCardDoc).toContain("verbindliches Zeitfenster");
    expect(scenarioCardDoc).toContain("manuell als Rehearsal-Notiz");
  });

  it("keeps the evidence pack explicit about collected evidence and unresolved automation", () => {
    for (const anchor of evidenceCollectionAnchors) {
      expect(evidencePackDoc).toContain(anchor);
    }

    expect(evidencePackDoc).toContain("Zeitfenster wurde manuell notiert");
    expect(evidencePackDoc).toContain("nicht automatisch in event.schedule uebernommen");
    expect(evidencePackDoc).toContain("keine Runtime-Loesung");
  });
});
