import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const b24Path = "docs/product/B24_PILOT_KORRIDOR_ENTSCHEIDUNGSANKER.md";
const b24Doc = existsSync(b24Path) ? readFileSync(b24Path, "utf8") : "";
const testingDoc = readFileSync("TESTING.md", "utf8");
const b10Doc = readFileSync("docs/architecture/B10_PILOT_PREFLIGHT_RUNBOOK.md", "utf8");
const b13Doc = readFileSync("docs/architecture/B13_PII_RETENTION_BACKUP_GATE.md", "utf8");
const b14Doc = readFileSync("docs/architecture/B14_SANDBOX_WORKER_AV_GATE.md", "utf8");

describe("B24 pilot corridor decision contract", () => {
  it("anchors Alexander's conservative pilot decision as documentation-only contract", () => {
    expect(existsSync(b24Path)).toBe(true);
    expect(b24Doc).toContain("B24 Pilot-Korridor-Entscheidungsanker");
    expect(b24Doc).toContain("Alexander-Entscheidung");
    expect(b24Doc).toContain("Doku-/Vertragstest-only");

    for (const outOfScope of [
      "keine neue Produktlogik",
      "keine neue Produktfläche",
      "keine neue API",
      "keine neue Persistenz",
      "keine Migration",
      "kein Login/OIDC",
      "kein Proxy/IAP-Code",
      "keine Sandbox-/AV-/Worker-Implementierung",
      "keine Retention-/Backup-Implementierung",
      "keine echten Daten",
      "keine rechtssichere Compliance-/DSGVO-Freigabe"
    ]) {
      expect(b24Doc).toContain(outOfScope);
    }
  });

  it("states what is allowed, not assessed, and blocked now", () => {
    for (const requiredState of [
      "interner Demo-Modus: `go`",
      "begrenzter interner Pilot mit anonymisierten Daten: `not assessed`",
      "produktionsnaher Pilot mit echten Daten: `blocked`",
      "öffentlicher Direktzugriff: `blocked`",
      "beliebige echte Uploads: `blocked`"
    ]) {
      expect(b24Doc).toContain(requiredState);
    }
  });

  it("limits allowed data to demo, synthetic, or anonymized data", () => {
    for (const allowedBoundary of [
      "nur Demo-/synthetische/anonymisierte Daten erlaubt",
      "kuratierten Testdateien",
      "keine echten Mitarbeiter-/Kunden-/Einsatz-/Schicht-/Abrechnungsdaten",
      "keine echten Kunden- oder Mitarbeiterdaten",
      "keine beliebigen echten Uploads"
    ]) {
      expect(b24Doc).toContain(allowedBoundary);
    }
  });

  it("keeps production-like use blocked without B10, B13, and B14 decisions", () => {
    for (const gate of [
      "B10_PILOT_PREFLIGHT_RUNBOOK.md",
      "B13_PII_RETENTION_BACKUP_GATE.md",
      "B14_SANDBOX_WORKER_AV_GATE.md"
    ]) {
      expect(b24Doc).toContain(gate);
    }

    expect(b24Doc).toContain("produktionsnah bleibt ohne B10/B13/B14-Entscheidungen `blocked`");
    expect(b10Doc).toContain("not assessed");
    expect(b13Doc).toContain("echte Mitarbeiterdaten");
    expect(b14Doc).toContain("Produktionsnahe Verarbeitung echter Uploads bleibt `blocked`");
  });

  it("names stop criteria and forbids over-interpreting the decision", () => {
    for (const stopCriterion of [
      "echte personenbezogene Daten sollen genutzt werden",
      "öffentliche Erreichbarkeit ist geplant",
      "beliebige echte Uploads sollen verarbeitet werden",
      "Daten sollen längerfristig gespeichert werden",
      "Backup-/Restore-Verantwortung ist unklar",
      "Sandbox/AV/Worker-Isolation ist für echte Uploads nicht entschieden"
    ]) {
      expect(b24Doc).toContain(stopCriterion);
    }

    for (const nonConclusion of [
      "kein Produktivbetrieb",
      "keine produktionsnahe Pilotfreigabe",
      "keine externe Freigabe",
      "keine Freigabe für echte Daten",
      "keine AuthN/AuthZ-, Login-, OIDC- oder Proxy-Implementierung",
      "keine Sandbox-/AV-/Worker-Freigabe",
      "keine Retention-, Backup- oder DSGVO-Freigabe"
    ]) {
      expect(b24Doc).toContain(nonConclusion);
    }
  });

  it("keeps B24 discoverable from TESTING", () => {
    expect(testingDoc).toContain("tests/b24-pilot-corridor-decision-contract.test.ts");
    expect(testingDoc).toContain("B24 Pilot-Korridor-Entscheidungsanker");
  });
});
