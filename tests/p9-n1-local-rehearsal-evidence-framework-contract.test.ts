import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const frameworkPath = "docs/product/P9_N1_LOKALER_REHEARSAL_NACHWEISRAHMEN.md";
const frameworkDoc = existsSync(frameworkPath) ? readFileSync(frameworkPath, "utf8") : "";
const readmeDoc = readFileSync("README.md", "utf8");
const testingDoc = readFileSync("TESTING.md", "utf8");
const c8Doc = readFileSync("docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md", "utf8");

const requiredReferenceAnchors = [
  "C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md",
  "P6_B57_LOKALER_START_STATUS_KORRIDOR.md",
  "P6_B58_BETA_REIBUNGSLOG_VORLAGE.md",
  "P7_B63_REVIEWER_REHEARSAL_STARTKARTE.md",
  "P7_B64_SYNTHETISCHE_SZENARIO_UND_DATENKARTE.md",
  "P7_B65_EXPORT_AUDIT_ROUTE_EVIDENZPAKET.md",
  "P7_B67_REIBUNG_ZU_BACKLOG_TRIAGE.md"
];

const requiredFrameworkAnchors = [
  "P9-N1 Lokaler Rehearsal-Nachweisrahmen",
  "Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit",
  "lokal/synthetisch gruen",
  "echte Daten blocked",
  "Produktionsfreigabe blocked",
  "Compliance blocked",
  "Zeitfenster-Rehearsal-Notiz",
  "keine automatische event.schedule-Uebernahme",
  "kein Schedule-/Zeitfenster-Datenmodell",
  "keine Runtime-Schedule-Logik",
  "keine neue API",
  "keine neue Persistenz",
  "kein Deployment"
];

describe("P9-N1 local rehearsal evidence framework contract", () => {
  it("anchors one discoverable local rehearsal evidence framework", () => {
    expect(existsSync(frameworkPath)).toBe(true);

    for (const anchor of requiredFrameworkAnchors) {
      expect(frameworkDoc).toContain(anchor);
    }
  });

  it("links the existing start, friction, evidence, triage and option A documents", () => {
    for (const anchor of requiredReferenceAnchors) {
      expect(frameworkDoc).toContain(anchor);
    }

    expect(frameworkDoc).toContain("Plan 8");
    expect(frameworkDoc).toContain("Option A");
  });

  it("keeps the framework discoverable from existing beta rehearsal docs", () => {
    expect(readmeDoc).toContain("P9_N1_LOKALER_REHEARSAL_NACHWEISRAHMEN.md");
    expect(testingDoc).toContain("P9_N1_LOKALER_REHEARSAL_NACHWEISRAHMEN.md");
    expect(c8Doc).toContain("P9_N1_LOKALER_REHEARSAL_NACHWEISRAHMEN.md");
  });
});
