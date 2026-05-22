import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const b28Path = "docs/deployment/B28_HETZNER_PREFLIGHT_DECISION_PACKET.md";
const b28Doc = existsSync(b28Path) ? readFileSync(b28Path, "utf8") : "";
const b25Doc = readFileSync("docs/deployment/B25_HETZNER_DEPLOYMENT_PREFLIGHT.md", "utf8");
const b26Doc = readFileSync("docs/deployment/B26_HETZNER_PREFLIGHT_EVIDENCE_CHECKLIST.md", "utf8");
const b27Doc = readFileSync("docs/deployment/B27_HETZNER_PREFLIGHT_STATUS_TEMPLATE.md", "utf8");
const testingDoc = readFileSync("TESTING.md", "utf8");

describe("B28 Hetzner preflight decision packet contract", () => {
  it("keeps the decision packet non-deploying and blocked by default", () => {
    expect(existsSync(b28Path)).toBe(true);
    expect(b28Doc).toContain("B28 Hetzner-Preflight-Entscheidungspaket");
    expect(b28Doc).toContain("Entscheidungspaket-only");
    expect(b28Doc).toContain("Deploymentstatus: `not deployed`");
    expect(b28Doc).toContain("Produktiv-/Pilotstatus bleibt `blocked`");
    expect(b28Doc).toContain("Keine Entscheidung in B28 darf als Deployment-Go gelesen werden");

    for (const forbiddenAction of [
      "kein Deployment",
      "keine Serveränderung",
      "keine SSH-Verbindung",
      "keine Secret-Erstellung",
      "keine ENV-Datei mit echten Werten",
      "keine Docker-/systemd-/nginx-Konfiguration",
      "keine neue API",
      "keine neue Persistenz",
      "keine echten Daten"
    ]) {
      expect(b28Doc).toContain(forbiddenAction);
    }
  });

  it("collects only explicit go or blocked decisions for the preflight evidence groups", () => {
    for (const decisionGroup of [
      "Zielumgebung und Verantwortliche",
      "Zugriffsschicht und direkte Service-Exposition",
      "Trusted-Header und serverseitiges Secret",
      "HTTPS/TLS und nicht-sensitive Healthchecks",
      "Rollback-/Stop-Pfad",
      "Daten-/PII-/Retention-/Backup-Gate",
      "Sandbox-/Worker-/AV-Gate für echte Uploads"
    ]) {
      expect(b28Doc).toContain(decisionGroup);
    }

    for (const requiredDecision of [
      "Entscheidung: `go` oder `blocked`",
      "Nicht-sensitive Entscheidungsbegründung",
      "Blockiert bis"
    ]) {
      expect(b28Doc).toContain(requiredDecision);
    }
  });

  it("forbids sensitive evidence and prevents partial-go escalation", () => {
    for (const forbiddenContent of [
      "keine echten Secret-Werte",
      "keine Tokens",
      "keine privaten SSH-Keys",
      "keine vollständigen ENV-Dumps",
      "keine IP-Adressen",
      "keine personenbezogenen Echtdaten",
      "keine Kunden- oder Mitarbeiterdaten",
      "keine produktiven Logauszüge"
    ]) {
      expect(b28Doc).toContain(forbiddenContent);
    }

    for (const blockingRule of [
      "Ein Teil-`go` ersetzt keinen Gesamt-Go",
      "Jede nicht entschiedene Mussgruppe bleibt `blocked`",
      "Jeder Widerspruch zu B25/B26/B27 bleibt `blocked`",
      "Interner Demo-Go bleibt kein Deployment-Go"
    ]) {
      expect(b28Doc).toContain(blockingRule);
    }
  });

  it("stays linked to B25/B26/B27 and discoverable from TESTING", () => {
    expect(b25Doc).toContain("B25 Hetzner-Deployment-Preflight");
    expect(b26Doc).toContain("B26 Hetzner-Preflight-Nachweischeckliste");
    expect(b27Doc).toContain("B27 Hetzner-Preflight-Statusvorlage");
    expect(b28Doc).toContain("docs/deployment/B25_HETZNER_DEPLOYMENT_PREFLIGHT.md");
    expect(b28Doc).toContain("docs/deployment/B26_HETZNER_PREFLIGHT_EVIDENCE_CHECKLIST.md");
    expect(b28Doc).toContain("docs/deployment/B27_HETZNER_PREFLIGHT_STATUS_TEMPLATE.md");
    expect(testingDoc).toContain("tests/b28-hetzner-preflight-decision-packet-contract.test.ts");
    expect(testingDoc).toContain("B28 Hetzner-Preflight-Entscheidungspaket");
  });
});
