import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const b30Path = "docs/deployment/B30_HETZNER_PREFLIGHT_ANSWER_HANDOFF.md";
const b30Doc = existsSync(b30Path) ? readFileSync(b30Path, "utf8") : "";
const b29Doc = readFileSync("docs/deployment/B29_HETZNER_PREFLIGHT_OPERATOR_QUESTIONS.md", "utf8");
const testingDoc = readFileSync("TESTING.md", "utf8");

describe("B30 Hetzner preflight answer handoff contract", () => {
  it("keeps the answer handoff non-executing and blocked by default", () => {
    expect(existsSync(b30Path)).toBe(true);
    expect(b30Doc).toContain("B30 Hetzner-Preflight-Antwortübergabe");
    expect(b30Doc).toContain("Antwortübergabe-only");
    expect(b30Doc).toContain("Deploymentstatus: `not deployed`");
    expect(b30Doc).toContain("Produktiv-/Pilotstatus bleibt `blocked`");
    expect(b30Doc).toContain("Keine B30-Antwort darf als Deployment-Go gelesen werden");

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
      expect(b30Doc).toContain(forbiddenAction);
    }
  });

  it("provides a sanitized answer structure for every B29 operator question group", () => {
    for (const decisionGroup of [
      "Zielumgebung und Verantwortliche",
      "Zugriffsschicht und direkte Service-Exposition",
      "Trusted-Header und serverseitiges Secret",
      "HTTPS/TLS und nicht-sensitive Healthchecks",
      "Rollback-/Stop-Pfad",
      "Daten-/PII-/Retention-/Backup-Gate",
      "Sandbox-/Worker-/AV-Gate für echte Uploads"
    ]) {
      expect(b30Doc).toContain(decisionGroup);
      expect(b29Doc).toContain(decisionGroup);
    }

    for (const requiredColumn of [
      "Antwortstatus: `go` / `blocked` / `not assessed`",
      "Nicht-sensitive Antwortnotiz",
      "Nächster sicherer Schritt"
    ]) {
      expect(b30Doc).toContain(requiredColumn);
    }
  });

  it("forbids sensitive values and keeps partial answers below deployment go", () => {
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
      expect(b30Doc).toContain(forbiddenContent);
    }

    for (const blockingRule of [
      "Eine einzelne `go`-Antwort ersetzt keinen B28-Gesamt-Go",
      "Unbeantwortete Antwortzeilen bleiben `not assessed` oder `blocked`",
      "Widerspruch zu B25/B26/B27/B28/B29 bleibt `blocked`",
      "Lokale Smoke- oder Demo-Gruensignale bleiben kein Deployment-Go"
    ]) {
      expect(b30Doc).toContain(blockingRule);
    }
  });

  it("stays linked to B29 and discoverable from TESTING", () => {
    expect(b29Doc).toContain("B29 Hetzner-Preflight-Operatorfragen");
    expect(b30Doc).toContain("docs/deployment/B25_HETZNER_DEPLOYMENT_PREFLIGHT.md");
    expect(b30Doc).toContain("docs/deployment/B26_HETZNER_PREFLIGHT_EVIDENCE_CHECKLIST.md");
    expect(b30Doc).toContain("docs/deployment/B27_HETZNER_PREFLIGHT_STATUS_TEMPLATE.md");
    expect(b30Doc).toContain("docs/deployment/B28_HETZNER_PREFLIGHT_DECISION_PACKET.md");
    expect(b30Doc).toContain("docs/deployment/B29_HETZNER_PREFLIGHT_OPERATOR_QUESTIONS.md");
    expect(testingDoc).toContain("tests/b30-hetzner-preflight-answer-handoff-contract.test.ts");
    expect(testingDoc).toContain("B30 Hetzner-Preflight-Antwortübergabe");
  });
});
