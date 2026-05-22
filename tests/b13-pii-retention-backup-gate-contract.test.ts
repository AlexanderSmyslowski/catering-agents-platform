import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const b13Path = "docs/architecture/B13_PII_RETENTION_BACKUP_GATE.md";
const b13Doc = existsSync(b13Path) ? readFileSync(b13Path, "utf8") : "";
const b10Doc = readFileSync("docs/architecture/B10_PILOT_PREFLIGHT_RUNBOOK.md", "utf8");
const b12Doc = readFileSync("docs/product/B12_LOCAL_DEMO_RESULT_NOTE.md", "utf8");
const testingDoc = readFileSync("TESTING.md", "utf8");

describe("B13 PII/retention/backup gate contract", () => {
  it("adds a narrow decision anchor without implementing storage, backup, API, or compliance runtime", () => {
    expect(existsSync(b13Path)).toBe(true);
    expect(b13Doc).toContain("B13 PII/Retention/Backup-Gate");
    expect(b13Doc).toContain("Doku-/Vertragstest-only");

    for (const outOfScope of [
      "keine neue Persistenz",
      "keine Migration",
      "keine Backup-Implementierung",
      "keine Loesch-/Retention-Engine",
      "keine neue API",
      "keine Produktlogik-Ausweitung",
      "keine echte personenbezogene Datenverarbeitung",
      "keine rechtssichere Compliance-/DSGVO-Freigabe",
      "keine Multi-Tenancy-/White-Label-/Plattform-Erweiterung"
    ]) {
      expect(b13Doc).toContain(outOfScope);
    }
  });

  it("separates currently allowed synthetic/internal evidence from blocked real or production-like data", () => {
    for (const allowed of [
      "Demo-/Seed-/synthetische Daten",
      "interne Arbeitsbelege",
      "ohne echte Personen-/Kundendaten",
      "read-only Export-/Arbeitsbelege",
      "Demo-Start-/Auditbeleg"
    ]) {
      expect(b13Doc).toContain(allowed);
    }

    for (const blocked of [
      "echte Mitarbeiterdaten",
      "echte Kundendaten",
      "echte Einsatz-/Schicht-/Abrechnungsdaten",
      "produktionsnahe Pilotdaten",
      "echte Personen-/Kundendaten bleiben `blocked`"
    ]) {
      expect(b13Doc).toContain(blocked);
    }
  });

  it("requires the minimal missing decisions before any real data is used", () => {
    for (const requiredDecision of [
      "Datenkategorien/PII-Scope",
      "Speicherort/Systemgrenze",
      "Aufbewahrungsfrist/Loeschkonzept",
      "Backup-/Restore-Verantwortung",
      "Zugriff/Verantwortliche",
      "Export-/Audit-Artefaktklassifikation",
      "Incident-/Loeschpfad"
    ]) {
      expect(b13Doc).toContain(requiredDecision);
    }
  });

  it("defines go, blocked, and not assessed so local demo green cannot become production-like data approval", () => {
    for (const stateAnchor of ["`go`", "`blocked`", "`not assessed`", "Ergebniszustand"]) {
      expect(b13Doc).toContain(stateAnchor);
    }

    expect(b13Doc).toContain("`go` nur fuer Demo/synthetisch");
    expect(b13Doc).toContain("`blocked` fuer echte Daten ohne Gate");
    expect(b13Doc).toContain("`not assessed` fuer noch nicht gepruefte externe/rechtliche Fragen");
    expect(b13Doc).toContain("lokaler Demo-Go bleibt intern");
    expect(b13Doc).toContain("produktionsnaher Pilot bleibt `blocked`");
  });

  it("keeps B13 discoverable from B10, B12, and TESTING without changing their outcome", () => {
    expect(b10Doc).toContain("B13_PII_RETENTION_BACKUP_GATE.md");
    expect(b12Doc).toContain("B13_PII_RETENTION_BACKUP_GATE.md");
    expect(testingDoc).toContain("tests/b13-pii-retention-backup-gate-contract.test.ts");
    expect(testingDoc).toContain("B13 PII/Retention/Backup-Gate");
  });
});
