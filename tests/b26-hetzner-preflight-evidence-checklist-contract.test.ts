import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const b26Path = "docs/deployment/B26_HETZNER_PREFLIGHT_EVIDENCE_CHECKLIST.md";
const b26Doc = existsSync(b26Path) ? readFileSync(b26Path, "utf8") : "";
const b25Doc = readFileSync("docs/deployment/B25_HETZNER_DEPLOYMENT_PREFLIGHT.md", "utf8");
const testingDoc = readFileSync("TESTING.md", "utf8");

describe("B26 Hetzner preflight evidence checklist contract", () => {
  it("keeps the Hetzner preflight evidence-only and non-deploying", () => {
    expect(existsSync(b26Path)).toBe(true);
    expect(b26Doc).toContain("B26 Hetzner-Preflight-Nachweischeckliste");
    expect(b26Doc).toContain("Nachweischeckliste-only");
    expect(b26Doc).toContain("Deploymentstatus: `not deployed`");
    expect(b26Doc).toContain("Gesamtzustand ohne ausgefüllte Nachweise: `not assessed` beziehungsweise `blocked`");

    for (const forbiddenAction of [
      "kein Deployment",
      "keine Serveränderung",
      "keine SSH-Verbindung",
      "keine Secret-Erstellung",
      "keine ENV-Datei mit echten Werten",
      "keine Docker-/systemd-/nginx-Konfiguration",
      "keine neue API",
      "keine neue Persistenz"
    ]) {
      expect(b26Doc).toContain(forbiddenAction);
    }
  });

  it("defines evidence rows for the concrete Hetzner preflight without storing sensitive values", () => {
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
      expect(b26Doc).toContain(evidenceRow);
    }

    for (const secretBoundary of [
      "keine echten Secret-Werte",
      "keine Tokens",
      "keine privaten SSH-Keys",
      "keine vollständigen ENV-Dumps",
      "keine personenbezogenen Echtdaten",
      "keine Kunden- oder Mitarbeiterdaten"
    ]) {
      expect(b26Doc).toContain(secretBoundary);
    }
  });

  it("requires outcome states and blocks pilot readiness while evidence is missing", () => {
    for (const requiredState of ["`go`", "`blocked`", "`not assessed`"] ) {
      expect(b26Doc).toContain(requiredState);
    }

    for (const blockingRule of [
      "Fehlender Nachweis bleibt `not assessed`",
      "Nachgewiesener Widerspruch bleibt `blocked`",
      "Ein einzelnes `go` ersetzt keinen Gesamt-Go",
      "Produktiv-/Pilotstatus bleibt ohne vollständig grüne Mussnachweise `blocked`",
      "Interner Demo-Go bleibt kein Deployment-Go"
    ]) {
      expect(b26Doc).toContain(blockingRule);
    }
  });

  it("stays linked to B25 and discoverable from TESTING", () => {
    expect(b25Doc).toContain("B25 Hetzner-Deployment-Preflight");
    expect(b26Doc).toContain("docs/deployment/B25_HETZNER_DEPLOYMENT_PREFLIGHT.md");
    expect(testingDoc).toContain("tests/b26-hetzner-preflight-evidence-checklist-contract.test.ts");
    expect(testingDoc).toContain("B26 Hetzner-Preflight-Nachweischeckliste");
  });
});
