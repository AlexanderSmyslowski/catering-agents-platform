import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const b25Path = "docs/deployment/B25_HETZNER_DEPLOYMENT_PREFLIGHT.md";
const b25Doc = existsSync(b25Path) ? readFileSync(b25Path, "utf8") : "";
const b10Doc = readFileSync("docs/architecture/B10_PILOT_PREFLIGHT_RUNBOOK.md", "utf8");
const b13Doc = readFileSync("docs/architecture/B13_PII_RETENTION_BACKUP_GATE.md", "utf8");
const b14Doc = readFileSync("docs/architecture/B14_SANDBOX_WORKER_AV_GATE.md", "utf8");
const b24Doc = readFileSync("docs/product/B24_PILOT_KORRIDOR_ENTSCHEIDUNGSANKER.md", "utf8");
const testingDoc = readFileSync("TESTING.md", "utf8");

describe("B25 Hetzner deployment preflight contract", () => {
  it("anchors Alexander's Hetzner target without deploying or changing infrastructure", () => {
    expect(existsSync(b25Path)).toBe(true);
    expect(b25Doc).toContain("B25 Hetzner-Deployment-Preflight");
    expect(b25Doc).toContain("Zielumgebung: Alexanders Hetzner-Server");
    expect(b25Doc).toContain("Deploymentstatus: `not deployed`");
    expect(b25Doc).toContain("Produktiv-/Pilotstatus: weiterhin `blocked`, bis Preflight ausgefüllt ist");
    expect(b25Doc).toContain("Doku-/Vertragstest-only");

    for (const outOfScope of [
      "kein Deployment",
      "keine Serveränderung",
      "keine SSH-Verbindung",
      "keine Secret-Erstellung",
      "keine ENV-Datei mit echten Werten",
      "keine Docker-/systemd-/nginx-Konfiguration",
      "kein öffentlicher Direktzugriff",
      "kein produktionsnaher Pilot"
    ]) {
      expect(b25Doc).toContain(outOfScope);
    }
  });

  it("requires the minimal Hetzner preflight assumptions before any deployment", () => {
    for (const requiredAssumption of [
      "Reverse Proxy / IAP oder vergleichbare Zugriffsschicht erforderlich",
      "direkte Service-Exposition blockiert",
      "serverseitige Secrets/ENV bleiben außerhalb des Repos",
      "keine Secrets in Git, Reports, Logs oder Telegram",
      "HTTPS/TLS muss geklärt sein",
      "Prozessmodell muss geklärt sein",
      "systemd/pm2/docker",
      "Healthchecks dürfen nicht sensitiv sein",
      "Rollback-/Stop-Pfad muss vor Deployment bekannt sein"
    ]) {
      expect(b25Doc).toContain(requiredAssumption);
    }
  });

  it("keeps data, storage, backup, retention, and upload processing blocked until separate gates are decided", () => {
    for (const blockedGate of [
      "Daten-/Storage-/Backup-/Retention-Verantwortung bleibt vor echten Daten blockierend",
      "Upload-/Dateiverarbeitung bleibt ohne Sandbox/Worker/AV blockiert",
      "B13_PII_RETENTION_BACKUP_GATE.md",
      "B14_SANDBOX_WORKER_AV_GATE.md",
      "B10_PILOT_PREFLIGHT_RUNBOOK.md",
      "B24_PILOT_KORRIDOR_ENTSCHEIDUNGSANKER.md"
    ]) {
      expect(b25Doc).toContain(blockedGate);
    }

    expect(b10Doc).toContain("Keine produktionsnahe Freigabe ohne ausgefuellten und erfuellten Preflight");
    expect(b13Doc).toContain("produktionsnaher Pilot bleibt `blocked`");
    expect(b14Doc).toContain("Produktionsnahe Verarbeitung echter Uploads bleibt `blocked`");
    expect(b24Doc).toContain("produktionsnah bleibt ohne B10/B13/B14-Entscheidungen `blocked`");
  });

  it("states stop criteria and forbids deriving production readiness from the internal demo go", () => {
    for (const stopCriterion of [
      "Preflight nicht ausgefüllt oder nicht nachgewiesen",
      "öffentlicher Direktzugriff geplant",
      "direkte Service-Exposition vorgesehen",
      "Secrets sollen im Repo, in Reports, Logs oder Telegram erscheinen",
      "HTTPS/TLS ungeklärt",
      "Prozessmodell ungeklärt",
      "Rollback-/Stop-Pfad unbekannt",
      "echte Daten, echte Uploads oder längere Speicherung ohne B13/B14-Entscheidung"
    ]) {
      expect(b25Doc).toContain(stopCriterion);
    }

    for (const forbiddenConclusion of [
      "interner Demo-Go ist kein Deployment-Go",
      "kein Produktivbetrieb",
      "keine produktionsnahe Pilotfreigabe",
      "keine externe Freigabe",
      "keine Freigabe für echte Daten",
      "keine Freigabe für beliebige echte Uploads",
      "keine rechtssichere Compliance-/DSGVO-Freigabe"
    ]) {
      expect(b25Doc).toContain(forbiddenConclusion);
    }
  });

  it("keeps B25 discoverable from TESTING", () => {
    expect(testingDoc).toContain("tests/b25-hetzner-deployment-preflight-contract.test.ts");
    expect(testingDoc).toContain("B25 Hetzner-Deployment-Preflight");
  });
});
