import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const docPath = "docs/deployment/B32_OPTION_B_REAL_DATA_HETZNER_READINESS.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";

const requiredSourceAnchors = [
  "docs/plans/hans-night-build-plan-13-option-b-real-data-hetzner-readiness-2026-05-24.md",
  "docs/product/P12_N2_MANAGEMENT_GO_NO_GO_ENTSCHEIDUNGSPAKET.md",
  "docs/deployment/B31_HETZNER_MANAGEMENT_DECISION_LIST.md",
  "docs/deployment/B28_HETZNER_PREFLIGHT_DECISION_PACKET.md",
  "docs/architecture/B13_PII_RETENTION_BACKUP_GATE.md",
  "docs/architecture/B14_SANDBOX_WORKER_AV_GATE.md",
  "docs/architecture/PA9_PROXY_DEPLOYMENT_READINESS_ADR.md",
  "docs/architecture/B9_PROXY_IAP_AUTHN_PREFLIGHT_CONTRACT.md"
];

const knownDecisions = [
  "Option B",
  "Hetzner Server",
  "Nutzung nur durch Berechtigte",
  "kein oeffentlicher Link",
  "echte Daten",
  "The ONE e.K.",
  "Alexander"
];

const requiredDecisionGroups = [
  "Betreiber / Verantwortliche",
  "Zugriffsschutz / Berechtigte",
  "Direkte Service-Exposition",
  "Trusted-Header / Secret-Grenze",
  "Datenkategorien / PII-Scope",
  "Speicherort / Systemgrenze",
  "Retention / Loeschung",
  "Backup / Restore",
  "Export / Audit / Logs",
  "Uploads / Sandbox / AV",
  "Dokumentation / Evidence",
  "Recht / DSGVO / AVV",
  "Gesamtstatus"
];

const requiredEvidenceRules = [
  "keine Secrets",
  "keine Tokens",
  "keine privaten SSH-Keys",
  "keine ENV-Dumps",
  "keine IP-Adressen",
  "keine Hostnamen",
  "keine personenbezogenen Echtdaten",
  "keine echten Kunden- oder Mitarbeiterdaten",
  "keine produktiven Logauszuege",
  "keine echten Dokumentinhalte"
];

describe("B32 Option-B real-data Hetzner readiness contract", () => {
  it("creates a non-sensitive readiness package for Option B without granting deployment or real-data use", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("B32 Option-B echter-Daten-Hetzner-Readiness");
    expect(doc).toContain("Status: Readiness-Entscheidungspaket-only");
    expect(doc).toContain("kein Deployment-Go");
    expect(doc).toContain("kein echte-Daten-Go");
    expect(doc).toContain("keine rechtssichere Compliance-/DSGVO-Freigabe");
  });

  it("records Alexanders known decisions while marking them insufficient for overall go", () => {
    for (const decision of knownDecisions) {
      expect(doc).toContain(decision);
    }

    expect(doc).toContain("Kein oeffentlicher Link reicht nicht als Zugriffsschutz");
    expect(doc).toContain("echte Daten erfordern B13");
    expect(doc).toContain("Stop-Verantwortung liegt bei Alexander");
  });

  it("keeps P13, P12, Hetzner, B13, B14 and proxy auth anchors leading", () => {
    for (const anchor of requiredSourceAnchors) {
      expect(doc).toContain(anchor);
    }
  });

  it("forces every Option-B must group into go, blocked, or not assessed", () => {
    for (const group of requiredDecisionGroups) {
      expect(doc).toContain(group);
    }

    expect(doc).toContain("Statuswerte: `go`, `blocked`, `not assessed`");
    expect(doc).toContain("Eine offene oder blockierte Mussgruppe haelt den Gesamtstatus `blocked`");
  });

  it("defines safe documentation and evidence rules that exclude secrets, infrastructure details and PII", () => {
    for (const rule of requiredEvidenceRules) {
      expect(doc).toContain(rule);
    }

    expect(doc).toContain("Evidence-Paket ohne sensible Inhalte");
    expect(doc).toContain("Reibungslog ohne PII");
  });

  it("requires the next step to stay preparation-only unless all gates are deliberately decided", () => {
    expect(doc).toContain("Naechster sicherer Schritt");
    expect(doc).toContain("vorbereitende Umsetzung nur nach separatem Go");
    expect(doc).toContain("keine SSH-Verbindung");
    expect(doc).toContain("keine Serveraenderung");
    expect(doc).toContain("keine Secret-Erstellung");
    expect(doc).toContain("keine echte Datenverarbeitung");
  });
});
