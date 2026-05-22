import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const b27Path = "docs/deployment/B27_HETZNER_PREFLIGHT_STATUS_TEMPLATE.md";
const b27Doc = existsSync(b27Path) ? readFileSync(b27Path, "utf8") : "";
const b25Doc = readFileSync("docs/deployment/B25_HETZNER_DEPLOYMENT_PREFLIGHT.md", "utf8");
const b26Doc = readFileSync("docs/deployment/B26_HETZNER_PREFLIGHT_EVIDENCE_CHECKLIST.md", "utf8");
const testingDoc = readFileSync("TESTING.md", "utf8");

describe("B27 Hetzner preflight status template contract", () => {
  it("keeps the Hetzner status template non-deploying and evidence-only", () => {
    expect(existsSync(b27Path)).toBe(true);
    expect(b27Doc).toContain("B27 Hetzner-Preflight-Statusvorlage");
    expect(b27Doc).toContain("Statusvorlage-only");
    expect(b27Doc).toContain("Deploymentstatus: `not deployed`");
    expect(b27Doc).toContain("Produktiv-/Pilotstatus bleibt `blocked`");

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
      expect(b27Doc).toContain(forbiddenAction);
    }
  });

  it("provides a fillable non-sensitive status table for the B26 evidence rows", () => {
    for (const column of [
      "Nachweiszeile",
      "Status (`go` / `blocked` / `not assessed`)",
      "Nicht-sensitive Begründung",
      "Nächster sicherer Schritt"
    ]) {
      expect(b27Doc).toContain(column);
    }

    for (const evidenceRow of [
      "Zielumgebung / Hostrahmen",
      "Betreiber / Verantwortliche",
      "Reverse Proxy / IAP oder vergleichbare Zugriffsschicht",
      "Direkte Service-Exposition ausgeschlossen",
      "Header-Stripping am äußeren Rand",
      "Trusted-Header-Injektion nur durch Proxy/IAP",
      "Serverseitiges `CATERING_TRUSTED_ACTOR_SECRET`",
      "HTTPS/TLS-Terminierung",
      "Nicht-sensitive Healthchecks",
      "Rollback-/Stop-Pfad",
      "Daten-/PII-/Retention-/Backup-Gate",
      "Sandbox-/Worker-/AV-Gate für echte Uploads"
    ]) {
      expect(b27Doc).toContain(evidenceRow);
    }
  });

  it("forbids sensitive evidence content and preserves blocked defaults", () => {
    for (const forbiddenContent of [
      "keine echten Secret-Werte",
      "keine Tokens",
      "keine privaten SSH-Keys",
      "keine vollständigen ENV-Dumps",
      "keine IP-Adressen",
      "keine personenbezogenen Echtdaten",
      "keine Kunden- oder Mitarbeiterdaten"
    ]) {
      expect(b27Doc).toContain(forbiddenContent);
    }

    for (const blockingRule of [
      "Fehlender Nachweis bleibt `not assessed`",
      "Nachgewiesener Widerspruch bleibt `blocked`",
      "Ein einzelnes `go` ersetzt keinen Gesamt-Go",
      "Ohne vollständig grüne Mussnachweise bleibt der Produktiv-/Pilotstatus `blocked`"
    ]) {
      expect(b27Doc).toContain(blockingRule);
    }
  });

  it("stays linked to B25/B26 and discoverable from TESTING", () => {
    expect(b25Doc).toContain("B25 Hetzner-Deployment-Preflight");
    expect(b26Doc).toContain("B26 Hetzner-Preflight-Nachweischeckliste");
    expect(b27Doc).toContain("docs/deployment/B25_HETZNER_DEPLOYMENT_PREFLIGHT.md");
    expect(b27Doc).toContain("docs/deployment/B26_HETZNER_PREFLIGHT_EVIDENCE_CHECKLIST.md");
    expect(testingDoc).toContain("tests/b27-hetzner-preflight-status-template-contract.test.ts");
    expect(testingDoc).toContain("B27 Hetzner-Preflight-Statusvorlage");
  });
});
