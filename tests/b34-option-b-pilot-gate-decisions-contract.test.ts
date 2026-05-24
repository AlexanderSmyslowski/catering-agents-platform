import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const docPath = "docs/deployment/B34_OPTION_B_PILOT_GATE_DECISIONS.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";

const requiredInputs = [
  "docs/deployment/B32_OPTION_B_REAL_DATA_HETZNER_READINESS.md",
  "docs/deployment/B33_OPTION_B_FOLLOWUP_DECISION.md",
  "docs/deployment/B31_HETZNER_MANAGEMENT_DECISION_LIST.md",
  "docs/architecture/B13_PII_RETENTION_BACKUP_GATE.md",
  "docs/architecture/B14_SANDBOX_WORKER_AV_GATE.md",
  "docs/architecture/PA9_PROXY_DEPLOYMENT_READINESS_ADR.md",
  "docs/architecture/B9_PROXY_IAP_AUTHN_PREFLIGHT_CONTRACT.md"
];

const decidedGates = [
  "Fachlicher Betreiber",
  "Tailscale/VPN-only",
  "Direkte Service-Exposition",
  "Trusted-Header / Secret-Grenze",
  "Datenkategorien / PII-Scope",
  "Speicherort / Systemgrenze",
  "Retention / Loeschung",
  "Backup / Restore",
  "Export / Audit / Logs",
  "Uploads / Sandbox / AV",
  "Recht / DSGVO / AVV",
  "Dokumentation / Evidence",
  "Stop-Regel"
];

const evidenceExclusions = [
  "keine Secrets",
  "keine Tokens",
  "keine privaten SSH-Keys",
  "keine produktive ENV",
  "keine IP-Adressen",
  "keine Hostnamen",
  "keine Serverdetails",
  "keine personenbezogenen Echtdaten",
  "keine echten Dokumentinhalte",
  "keine produktiven Logauszuege"
];

describe("B34 Option-B pilot gate decisions contract", () => {
  it("creates a non-sensitive pilot gate decision anchor without granting deployment or real-data start", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("B34 Option-B Pilot-Gate-Entscheidungen");
    expect(doc).toContain("Status: Doku-/Vertragstest-only Pilot-Gate-Entscheidungsanker");
    expect(doc).toContain("kein Deployment-Go");
    expect(doc).toContain("kein echte-Daten-Start-Go");
    expect(doc).toContain("kein SSH-Go");
    expect(doc).toContain("keine rechtssichere Compliance-/DSGVO-Freigabe");
  });

  it("uses B32, B33, B31, B13, B14 and proxy auth anchors as leading inputs", () => {
    for (const input of requiredInputs) {
      expect(doc).toContain(input);
    }
  });

  it("records Alexanders decisions with the restricted risk interpretation", () => {
    expect(doc).toContain("Ergebniswert: `preparation decision go`");
    expect(doc).toContain("Alexander / The ONE e.K. Geschaeftsfuehrung");
    expect(doc).toContain("Tailscale/VPN-only");
    expect(doc).toContain("App/API/Serviceports duerfen nicht direkt aus dem Internet erreichbar sein");
    expect(doc).toContain("Nur Hetzner-App-Systemgrenze");
    expect(doc).toContain("90 Tage; Loeschverantwortung Alexander");

    for (const gate of decidedGates) {
      expect(doc).toContain(gate);
    }
  });

  it("keeps backup retention as a visible follow-up decision instead of silently inventing a value", () => {
    expect(doc).toContain("Begrenztes Backup ist gewollt");
    expect(doc).toContain("Konkrete Backup-Retention ist noch festzulegen");
    expect(doc).toContain("Default-Vorschlag bleibt 7-14 Tage");
  });

  it("narrows logs and upload choices so they are not broad production permissions", () => {
    expect(doc).toContain("Technische Logs sollen keine unnoetigen Rohdaten/PII enthalten");
    expect(doc).toContain("Produktive Logauszuege gehoeren nicht in Repo, Tests, Telegram, Lageberichte oder allgemeine Evidence");
    expect(doc).toContain("Echte Uploads erst nach separatem Upload-Sicherheitsgate");
    expect(doc).toContain("blocked until B14 go");
    expect(doc).toContain("beliebige echte Uploads sind nicht unmittelbar freigegeben");
  });

  it("defines safe evidence rules that exclude secrets, infrastructure details and PII", () => {
    for (const exclusion of evidenceExclusions) {
      expect(doc).toContain(exclusion);
    }

    expect(doc).toContain("Gate-Status und Entscheidungsstatus");
    expect(doc).toContain("Reibungslog ohne PII");
    expect(doc).toContain("Export-/Audit-Nachweis nur als Existenz-/Statusnachweis ohne echte Inhalte");
  });

  it("bounds the next step to preparation only and blocks server access, secrets, real data and uploads", () => {
    expect(doc).toContain("Naechster sicherer Schritt");
    expect(doc).toContain("kein Deployment");
    expect(doc).toContain("keine SSH-Verbindung");
    expect(doc).toContain("keine Serveraenderung");
    expect(doc).toContain("keine Secret-Erstellung");
    expect(doc).toContain("keine echte Datenverarbeitung");
    expect(doc).toContain("keine echten Uploads");
  });
});
