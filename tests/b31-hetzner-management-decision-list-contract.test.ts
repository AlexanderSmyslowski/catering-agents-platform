import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const b31Path = "docs/deployment/B31_HETZNER_MANAGEMENT_DECISION_LIST.md";
const b31Doc = existsSync(b31Path) ? readFileSync(b31Path, "utf8") : "";
const b25Doc = readFileSync("docs/deployment/B25_HETZNER_DEPLOYMENT_PREFLIGHT.md", "utf8");
const b26Doc = readFileSync("docs/deployment/B26_HETZNER_PREFLIGHT_EVIDENCE_CHECKLIST.md", "utf8");
const b27Doc = readFileSync("docs/deployment/B27_HETZNER_PREFLIGHT_STATUS_TEMPLATE.md", "utf8");
const b28Doc = readFileSync("docs/deployment/B28_HETZNER_PREFLIGHT_DECISION_PACKET.md", "utf8");
const b29Doc = readFileSync("docs/deployment/B29_HETZNER_PREFLIGHT_OPERATOR_QUESTIONS.md", "utf8");
const testingDoc = readFileSync("TESTING.md", "utf8");

describe("B31 Hetzner management decision list contract", () => {
  it("keeps the management list non-executing and blocked by default", () => {
    expect(existsSync(b31Path)).toBe(true);
    expect(b31Doc).toContain("B31 Hetzner-Management-Entscheidungsliste");
    expect(b31Doc).toContain("Management-Entscheidungsliste-only");
    expect(b31Doc).toContain("Deploymentstatus: `not deployed`");
    expect(b31Doc).toContain("Produktiv-/Pilotstatus bleibt `blocked`");
    expect(b31Doc).toContain("Eine offene Mussgruppe haelt den Produktiv-/Pilotstatus `blocked`");

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
      expect(b31Doc).toContain(forbiddenAction);
    }
  });

  it("condenses B25 to B29 into the required management decision groups", () => {
    for (const decisionGroup of [
      "Betreiber / Verantwortliche",
      "Zugriffsschicht und direkte Service-Exposition",
      "Trusted-Header und serverseitiges Secret",
      "TLS/Health",
      "Stop/Rollback",
      "Daten/PII/Retention/Backup",
      "Sandbox/Worker/AV"
    ]) {
      expect(b31Doc).toContain(decisionGroup);
    }

    for (const requiredColumn of [
      "Status (`go` / `blocked` / `not assessed`)",
      "Management-Entscheidung",
      "Nicht-sensitive Entscheidungsnotiz",
      "Blockiert bis"
    ]) {
      expect(b31Doc).toContain(requiredColumn);
    }
  });

  it("forbids secrets and prevents partial go escalation", () => {
    for (const forbiddenContent of [
      "keine echten Secret-Werte",
      "keine Tokens",
      "keine privaten SSH-Keys",
      "keine vollständigen ENV-Dumps",
      "keine IP-Adressen",
      "keine Serverdetails",
      "keine personenbezogenen Echtdaten",
      "keine Kunden- oder Mitarbeiterdaten",
      "keine produktiven Logauszüge"
    ]) {
      expect(b31Doc).toContain(forbiddenContent);
    }

    for (const blockingRule of [
      "Ein Teil-`go` ersetzt keinen Gesamt-Go",
      "Jede `not assessed`-Mussgruppe bleibt offen und haelt den Gesamtstatus `blocked`",
      "Jede `blocked`-Mussgruppe haelt den Gesamtstatus `blocked`",
      "Lokale Smoke- oder Demo-Gruensignale bleiben kein Deployment-Go"
    ]) {
      expect(b31Doc).toContain(blockingRule);
    }
  });

  it("stays linked to B25-B29 and discoverable from TESTING", () => {
    expect(b25Doc).toContain("B25 Hetzner-Deployment-Preflight");
    expect(b26Doc).toContain("B26 Hetzner-Preflight-Nachweischeckliste");
    expect(b27Doc).toContain("B27 Hetzner-Preflight-Statusvorlage");
    expect(b28Doc).toContain("B28 Hetzner-Preflight-Entscheidungspaket");
    expect(b29Doc).toContain("B29 Hetzner-Preflight-Operatorfragen");
    expect(b31Doc).toContain("docs/deployment/B25_HETZNER_DEPLOYMENT_PREFLIGHT.md");
    expect(b31Doc).toContain("docs/deployment/B26_HETZNER_PREFLIGHT_EVIDENCE_CHECKLIST.md");
    expect(b31Doc).toContain("docs/deployment/B27_HETZNER_PREFLIGHT_STATUS_TEMPLATE.md");
    expect(b31Doc).toContain("docs/deployment/B28_HETZNER_PREFLIGHT_DECISION_PACKET.md");
    expect(b31Doc).toContain("docs/deployment/B29_HETZNER_PREFLIGHT_OPERATOR_QUESTIONS.md");
    expect(testingDoc).toContain("tests/b31-hetzner-management-decision-list-contract.test.ts");
    expect(testingDoc).toContain("B31 Hetzner-Management-Entscheidungsliste");
  });
});
