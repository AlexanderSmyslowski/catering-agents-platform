import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const planPath = "docs/plans/hans-night-build-plan-13-option-b-real-data-hetzner-readiness-2026-05-24.md";
const planDoc = existsSync(planPath) ? readFileSync(planPath, "utf8") : "";

const requiredAnchors = [
  "docs/product/P12_N2_MANAGEMENT_GO_NO_GO_ENTSCHEIDUNGSPAKET.md",
  "docs/deployment/B31_HETZNER_MANAGEMENT_DECISION_LIST.md",
  "docs/deployment/B28_HETZNER_PREFLIGHT_DECISION_PACKET.md",
  "docs/deployment/B25_HETZNER_DEPLOYMENT_PREFLIGHT.md",
  "docs/architecture/B13_PII_RETENTION_BACKUP_GATE.md",
  "docs/architecture/B14_SANDBOX_WORKER_AV_GATE.md",
  "docs/architecture/PA7_AUTH_READ_PATH_DECISION_ADR.md",
  "docs/architecture/PA9_PROXY_DEPLOYMENT_READINESS_ADR.md",
  "docs/architecture/B8_AUTH_GATE_DECISION_BOUNDARY.md",
  "docs/architecture/B9_PROXY_IAP_AUTHN_PREFLIGHT_CONTRACT.md"
];

const requiredKnownDecisions = [
  "Option B",
  "Hetzner Server",
  "Nutzung nur durch Berechtigte",
  "kein oeffentlicher Link",
  "echte Daten",
  "The ONE e.K.",
  "Stop-Verantwortung: Alexander"
];

const requiredStopGates = [
  "SSH-Zugriff, Serveraenderung, Deployment oder produktive Config vor Readiness-Entscheidung",
  "echte Secret-Werte, Tokens, private SSH-Keys, ENV-Dumps, IP-Adressen oder Serverdetails",
  "direkter oeffentlicher Zugriff auf App oder APIs",
  "echte Daten ohne ausgefuellten B13-PII-/Retention-/Backup-Entscheid",
  "echte Uploads ohne B14-Sandbox-/Worker-/AV-Entscheid oder expliziten Ausschluss",
  "Logs, Screenshots, Exporte oder Evidence mit PII",
  "neue API, neue Persistenz, Prisma, Migration oder Produktlogik",
  "rechtliche/Compliance-/DSGVO-Freigabe wird im Repo behauptet"
];

describe("Plan 13 Option-B real-data Hetzner readiness contract", () => {
  it("creates a start-ready Option-B readiness plan without starting deployment or real data processing", () => {
    expect(existsSync(planPath)).toBe(true);
    expect(planDoc).toContain("Hans Night Build Plan 13");
    expect(planDoc).toContain("Option-B echter-Daten-Hetzner-Readiness");
    expect(planDoc).toContain("kein Deploymentstart in diesem Plan");
    expect(planDoc).toContain("Plan 13 startet keinen Pilot und verarbeitet keine echten Daten");
  });

  it("records Alexanders known Option-B decisions without sensitive infrastructure details", () => {
    for (const decision of requiredKnownDecisions) {
      expect(planDoc).toContain(decision);
    }

    expect(planDoc).toContain("Noch nicht ausreichend: Zugriffsschutz muss technisch konkretisiert werden");
    expect(planDoc).toContain("B13-Gate erforderlich");
    expect(planDoc).toContain("B13 statt P12-Synthetiklinie");
  });

  it("keeps the existing P12, B13, B14 and Hetzner anchors leading", () => {
    for (const anchor of requiredAnchors) {
      expect(planDoc).toContain(anchor);
    }

    expect(planDoc).toContain("B25-B31");
    expect(planDoc).toContain("PA7/PA8/PA9");
    expect(planDoc).toContain("B8/B9");
  });

  it("requires explicit decisions for access, data, retention, backup, uploads, evidence and legal review", () => {
    for (const group of [
      "Zugriffsschutz / Berechtigte",
      "Direkte Service-Exposition",
      "Trusted-Header / Secret-Grenze",
      "Datenkategorien / PII-Scope",
      "Retention / Loeschung",
      "Backup / Restore",
      "Export / Audit / Logs",
      "Uploads / Sandbox / AV",
      "Dokumentation / Evidence",
      "Recht / DSGVO / AVV",
      "Gesamtentscheidung"
    ]) {
      expect(planDoc).toContain(group);
    }

    expect(planDoc).toContain("Kein oeffentlicher Link reicht nicht");
    expect(planDoc).toContain("VPN/Tailscale, IP-Allowlist plus Auth, Proxy/IAP/OIDC oder gleichwertige Zugriffsschicht");
  });

  it("preserves hard stop gates and forbids silent scope expansion", () => {
    for (const stopGate of requiredStopGates) {
      expect(planDoc).toContain(stopGate);
    }

    expect(planDoc).toContain("keine SSH-Verbindung");
    expect(planDoc).toContain("keine echte Datenverarbeitung");
    expect(planDoc).toContain("keine rechtssichere Compliance-/DSGVO-Freigabe");
  });

  it("defines the next narrow P13-N1 artifact and required gates", () => {
    expect(planDoc).toContain("Cycle P13-N1 - Option-B-Readiness-Paket");
    expect(planDoc).toContain("docs/deployment/B32_OPTION_B_REAL_DATA_HETZNER_READINESS.md");
    expect(planDoc).toContain("tests/b32-option-b-real-data-hetzner-readiness-contract.test.ts");

    for (const gate of [
      "fokussierter Contract-Test fuer das Option-B-Paket",
      "npm test",
      "npm run build",
      "npm audit --omit=dev",
      "git diff --check"
    ]) {
      expect(planDoc).toContain(gate);
    }
  });
});
