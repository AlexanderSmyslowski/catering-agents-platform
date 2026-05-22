import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const b29Path = "docs/deployment/B29_HETZNER_PREFLIGHT_OPERATOR_QUESTIONS.md";
const b29Doc = existsSync(b29Path) ? readFileSync(b29Path, "utf8") : "";
const b25Doc = readFileSync("docs/deployment/B25_HETZNER_DEPLOYMENT_PREFLIGHT.md", "utf8");
const b28Doc = readFileSync("docs/deployment/B28_HETZNER_PREFLIGHT_DECISION_PACKET.md", "utf8");
const testingDoc = readFileSync("TESTING.md", "utf8");

describe("B29 Hetzner preflight operator questions contract", () => {
  it("keeps the operator question packet non-executing and blocked by default", () => {
    expect(existsSync(b29Path)).toBe(true);
    expect(b29Doc).toContain("B29 Hetzner-Preflight-Operatorfragen");
    expect(b29Doc).toContain("Operatorfragen-only");
    expect(b29Doc).toContain("Deploymentstatus: `not deployed`");
    expect(b29Doc).toContain("Produktiv-/Pilotstatus bleibt `blocked`");
    expect(b29Doc).toContain("Keine Antwort in B29 darf als Deployment-Go gelesen werden");

    for (const forbiddenAction of [
      "kein Deployment",
      "keine Serveränderung",
      "keine SSH-Verbindung",
      "keine Secret-Erstellung",
      "keine ENV-Datei mit echten Werten",
      "keine neue API",
      "keine neue Persistenz",
      "keine echten Daten"
    ]) {
      expect(b29Doc).toContain(forbiddenAction);
    }
  });

  it("turns the B28 decision groups into non-sensitive operator questions", () => {
    for (const decisionGroup of [
      "Zielumgebung und Verantwortliche",
      "Zugriffsschicht und direkte Service-Exposition",
      "Trusted-Header und serverseitiges Secret",
      "HTTPS/TLS und nicht-sensitive Healthchecks",
      "Rollback-/Stop-Pfad",
      "Daten-/PII-/Retention-/Backup-Gate",
      "Sandbox-/Worker-/AV-Gate für echte Uploads"
    ]) {
      expect(b29Doc).toContain(decisionGroup);
      expect(b28Doc).toContain(decisionGroup);
    }

    for (const requiredColumn of [
      "Nicht-sensitive Operatorfrage",
      "Zulässige Antwortform",
      "Bleibt blocked, wenn"
    ]) {
      expect(b29Doc).toContain(requiredColumn);
    }
  });

  it("forbids collecting sensitive answers or treating partial answers as go", () => {
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
      expect(b29Doc).toContain(forbiddenContent);
    }

    for (const blockingRule of [
      "Eine beantwortete Frage ersetzt keinen B28-Gesamt-Go",
      "Unbeantwortete Fragen bleiben `not assessed` oder `blocked`",
      "Widerspruch zu B25/B26/B27/B28 bleibt `blocked`",
      "Lokale Smoke- oder Demo-Gruensignale bleiben kein Deployment-Go"
    ]) {
      expect(b29Doc).toContain(blockingRule);
    }
  });

  it("stays linked to B25/B28 and discoverable from TESTING", () => {
    expect(b25Doc).toContain("B25 Hetzner-Deployment-Preflight");
    expect(b28Doc).toContain("B28 Hetzner-Preflight-Entscheidungspaket");
    expect(b29Doc).toContain("docs/deployment/B25_HETZNER_DEPLOYMENT_PREFLIGHT.md");
    expect(b29Doc).toContain("docs/deployment/B26_HETZNER_PREFLIGHT_EVIDENCE_CHECKLIST.md");
    expect(b29Doc).toContain("docs/deployment/B27_HETZNER_PREFLIGHT_STATUS_TEMPLATE.md");
    expect(b29Doc).toContain("docs/deployment/B28_HETZNER_PREFLIGHT_DECISION_PACKET.md");
    expect(testingDoc).toContain("tests/b29-hetzner-preflight-operator-questions-contract.test.ts");
    expect(testingDoc).toContain("B29 Hetzner-Preflight-Operatorfragen");
  });
});
