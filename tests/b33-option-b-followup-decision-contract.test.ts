import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const docPath = "docs/deployment/B33_OPTION_B_FOLLOWUP_DECISION.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";

const requiredInputs = [
  "docs/plans/hans-night-build-plan-13-option-b-real-data-hetzner-readiness-2026-05-24.md",
  "docs/deployment/B32_OPTION_B_REAL_DATA_HETZNER_READINESS.md",
  "docs/architecture/B13_PII_RETENTION_BACKUP_GATE.md",
  "docs/architecture/B14_SANDBOX_WORKER_AV_GATE.md",
  "docs/architecture/PA9_PROXY_DEPLOYMENT_READINESS_ADR.md",
  "docs/architecture/B9_PROXY_IAP_AUTHN_PREFLIGHT_CONTRACT.md"
];

const blockingGroups = [
  "Zugriffsschutz / Berechtigte",
  "Direkte Service-Exposition",
  "Trusted-Header / Secret-Grenze",
  "Datenkategorien / PII-Scope",
  "Speicherort / Systemgrenze",
  "Retention / Loeschung",
  "Backup / Restore",
  "Export / Audit / Logs",
  "Uploads / Sandbox / AV",
  "Recht / DSGVO / AVV"
];

describe("B33 Option-B follow-up decision contract", () => {
  it("creates a P13-N2 follow-up decision that does not convert Option B into deployment go", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("B33 Option-B Abschluss- und Folgeentscheidung");
    expect(doc).toContain("Status: P13-N2 Entscheidung-only");
    expect(doc).toContain("kein Deployment-Go");
    expect(doc).toContain("kein echte-Daten-Go");
    expect(doc).toContain("kein SSH-Go");
  });

  it("uses the P13 and B32 readiness package as leading input", () => {
    for (const input of requiredInputs) {
      expect(doc).toContain(input);
    }
  });

  it("marks the current result as decision needed because blocking must groups remain open", () => {
    expect(doc).toContain("Ergebniswert: `decision needed`");
    expect(doc).toContain("kein `go fuer vorbereitende Umsetzung`");
    expect(doc).toContain("kein `blocked` als Produktabbruch");

    for (const group of blockingGroups) {
      expect(doc).toContain(group);
    }
  });

  it("defines the minimum external decisions needed before a later preparation run", () => {
    for (const decision of [
      "Zugriffsschicht waehlen",
      "direkte Service-Exposition ausschliessen",
      "B13 echte-Daten-Entscheid ausfuellen",
      "B14 Upload-Entscheid treffen",
      "Recht/DSGVO/AVV ausserhalb des Repos klaeren",
      "Evidence-Regeln ohne PII bestaetigen"
    ]) {
      expect(doc).toContain(decision);
    }
  });

  it("keeps the next technical step bounded to a preparation plan only after the missing decisions", () => {
    expect(doc).toContain("Naechster sinnvoller Schritt");
    expect(doc).toContain("kein Serverzugriff vor diesen Entscheidungen");
    expect(doc).toContain("keine Secrets");
    expect(doc).toContain("keine echten Daten");
    expect(doc).toContain("keine produktive ENV");
  });
});
