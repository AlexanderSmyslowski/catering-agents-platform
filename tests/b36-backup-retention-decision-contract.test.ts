import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const docPath = "docs/deployment/B36_BACKUP_RETENTION_DECISION.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";

const requiredInputs = [
  "docs/deployment/B34_OPTION_B_PILOT_GATE_DECISIONS.md",
  "docs/deployment/B35_OPTION_B_PREPARATION_BOUNDARY.md",
  "docs/architecture/B13_PII_RETENTION_BACKUP_GATE.md"
];

const comparedOptions = [
  "7 Tage",
  "14 Tage",
  "30 Tage"
];

const hardBoundaries = [
  "keine echten Backups",
  "keine Restore-Tests",
  "keine Serverzugriffe",
  "keine echten Daten",
  "keine Secrets",
  "keine IPs/Hostnames",
  "keine produktiven Logs",
  "keine neue API/Persistenz/Migration"
];

describe("B36 backup retention decision contract", () => {
  it("creates a non-technical decision anchor for Option-B pilot backup retention", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("B36 Backup-Retention-Entscheidungsanker fuer Option-B-Pilot");
    expect(doc).toContain("Status: Doku-/Vertragstest-only Entscheidungsanker");
    expect(doc).toContain("Ziel: Managemententscheidung dokumentierbar machen");
    expect(doc).toContain("keine Backup-Aktivierung");
    expect(doc).toContain("kein Deployment-Go");
    expect(doc).toContain("kein Echtdaten-Go");
  });

  it("uses B34, B35 and B13 as leading inputs", () => {
    for (const input of requiredInputs) {
      expect(doc).toContain(input);
    }
  });

  it("compares the three management options and recommends 14 days as pilot default", () => {
    for (const option of comparedOptions) {
      expect(doc).toContain(option);
    }

    expect(doc).toContain("7 Tage: minimale Datenhaltung, weniger Wiederherstellungsfenster");
    expect(doc).toContain("14 Tage: empfohlener MVP-Default");
    expect(doc).toContain("30 Tage: mehr Sicherheit gegen spaete Fehler");
    expect(doc).toContain("Empfehlung: 14 Tage als Pilot-Default");
    expect(doc).toContain("sofern Alexander nichts anderes entscheidet");
  });

  it("keeps B36 bounded away from backup activation, deployment and real-data start", () => {
    for (const boundary of hardBoundaries) {
      expect(doc).toContain(boundary);
    }

    expect(doc).toContain("B36 aktiviert kein Backup");
    expect(doc).toContain("B36 prueft keinen Restore");
    expect(doc).toContain("B36 erlaubt keinen Serverlauf");
    expect(doc).toContain("B36 ersetzt keine Compliance-/DSGVO-Freigabe");
  });
});
