import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const docPath = "docs/deployment/B35_OPTION_B_PREPARATION_BOUNDARY.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";

const requiredInputs = [
  "docs/deployment/B34_OPTION_B_PILOT_GATE_DECISIONS.md",
  "docs/deployment/B32_OPTION_B_REAL_DATA_HETZNER_READINESS.md",
  "docs/deployment/B33_OPTION_B_FOLLOWUP_DECISION.md",
  "docs/deployment/B31_HETZNER_MANAGEMENT_DECISION_LIST.md",
  "docs/architecture/B13_PII_RETENTION_BACKUP_GATE.md",
  "docs/architecture/B14_SANDBOX_WORKER_AV_GATE.md",
  "docs/architecture/PA9_PROXY_DEPLOYMENT_READINESS_ADR.md",
  "docs/architecture/B9_PROXY_IAP_AUTHN_PREFLIGHT_CONTRACT.md"
];

const corridorPoints = [
  "Gate-Konsistenz",
  "Zugriffsschicht",
  "Direkte Service-Exposition",
  "Trusted-Header-Grenze",
  "Evidence-Regeln",
  "Backup-Retention",
  "Uploads",
  "Recht/DSGVO/AVV"
];

const stopRules = [
  "SSH-Verbindung, Serveraenderung oder produktive Config erforderlich wird",
  "Secrets, Tokens, private SSH-Keys oder ENV-Werte dokumentiert werden sollen",
  "IP-Adressen, Hostnamen, Serverdetails oder Tailnet-/Geraetedetails ins Repo sollen",
  "echte Daten, echte Dokumente oder echte Uploads benoetigt werden",
  "B14 fuer echte Uploads nicht entschieden ist",
  "eine Compliance-/DSGVO-/AVV-Freigabe im Repo behauptet werden soll"
];

describe("B35 Option-B preparation boundary contract", () => {
  it("creates a preparation corridor without granting deployment, SSH or real-data use", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("B35 Option-B Vorbereitungskorridor ohne sensible Werte");
    expect(doc).toContain("Status: Doku-/Vertragstest-only Vorbereitungskorridor");
    expect(doc).toContain("kein Deployment-Go");
    expect(doc).toContain("kein echte-Daten-Start-Go");
    expect(doc).toContain("kein SSH-Go");
    expect(doc).toContain("keine Serveraenderung");
    expect(doc).toContain("keine rechtssichere Compliance-/DSGVO-Freigabe");
  });

  it("uses B34 and the existing B13/B14/proxy anchors as leading inputs", () => {
    for (const input of requiredInputs) {
      expect(doc).toContain(input);
    }
  });

  it("defines only a non-sensitive preparation corridor", () => {
    expect(doc).toContain("Ergebniswert: `preparation corridor defined`");
    expect(doc).toContain("Der Vorbereitungsschritt darf keine produktiven Werte, Secrets, IPs, Hostnamen oder echte Daten benoetigen");

    for (const point of corridorPoints) {
      expect(doc).toContain(point);
    }
  });

  it("keeps Tailscale/VPN-only, non-exposure and trusted headers bounded without infrastructure details", () => {
    expect(doc).toContain("Tailscale/VPN-only als Zieltyp nicht-sensitiv beschreiben");
    expect(doc).toContain("App/API/Serviceports duerfen nicht direkt oeffentlich erreichbar sein");
    expect(doc).toContain("Header-Stripping und serverseitig gesetzten Trusted-Kontext");
    expect(doc).toContain("IPs, Hostnamen, Geraetenamen, Keys, Tailnet-Details oder Serverbefehle");
  });

  it("keeps backup retention open and uploads blocked until B14 go", () => {
    expect(doc).toContain("konkrete Backup-Retention");
    expect(doc).toContain("Default-Vorschlag bleibt: 7-14 Tage");
    expect(doc).toContain("Uploads weiter `blocked until B14 go` halten");
    expect(doc).toContain("echte oder beliebige Uploads");
  });

  it("defines hard stop rules for secrets, infrastructure details, real data and compliance claims", () => {
    for (const rule of stopRules) {
      expect(doc).toContain(rule);
    }
  });

  it("points to the next step without starting a server run", () => {
    expect(doc).toContain("Naechster sinnvoller Schritt nach B35 ist kein Serverlauf");
    expect(doc).toContain("Backup-Retention als kurze Managemententscheidung nachtragen");
    expect(doc).toContain("ohne SSH, Secrets, produktive ENV, echte Daten und echte Uploads startet");
  });
});
