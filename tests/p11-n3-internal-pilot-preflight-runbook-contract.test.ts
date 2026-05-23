import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runbookPath = "docs/product/P11_N3_INTERNER_PILOT_PREFLIGHT_RUNBOOK.md";
const runbookDoc = existsSync(runbookPath) ? readFileSync(runbookPath, "utf8") : "";
const n1Doc = readFileSync("docs/product/P11_N1_LIMITED_INTERNAL_PILOT_PREFLIGHT_INDEX.md", "utf8");
const n2Doc = readFileSync("docs/product/P11_N2_PILOT_DATENKORRIDOR_ANONYMISIERT_SYNTHETISCH.md", "utf8");
const b24Doc = readFileSync("docs/product/B24_PILOT_KORRIDOR_ENTSCHEIDUNGSANKER.md", "utf8");
const pa7Doc = readFileSync("docs/architecture/PA7_AUTH_READ_PATH_DECISION_ADR.md", "utf8");
const pa9Doc = readFileSync("docs/architecture/PA9_PROXY_DEPLOYMENT_READINESS_ADR.md", "utf8");
const b8Doc = readFileSync("docs/architecture/B8_AUTH_GATE_DECISION_BOUNDARY.md", "utf8");
const b9Doc = readFileSync("docs/architecture/B9_PROXY_IAP_AUTHN_PREFLIGHT_CONTRACT.md", "utf8");
const readmeDoc = readFileSync("README.md", "utf8");

const requiredReferenceAnchors = [
  "docs/product/B24_PILOT_KORRIDOR_ENTSCHEIDUNGSANKER.md",
  "docs/product/P11_N1_LIMITED_INTERNAL_PILOT_PREFLIGHT_INDEX.md",
  "docs/product/P11_N2_PILOT_DATENKORRIDOR_ANONYMISIERT_SYNTHETISCH.md",
  "docs/architecture/PA7_AUTH_READ_PATH_DECISION_ADR.md",
  "PA8 Read-path Auth Hardening Slice 1",
  "docs/architecture/PA9_PROXY_DEPLOYMENT_READINESS_ADR.md",
  "docs/architecture/B8_AUTH_GATE_DECISION_BOUNDARY.md",
  "docs/architecture/B9_PROXY_IAP_AUTHN_PREFLIGHT_CONTRACT.md",
  "docs/product/P6_B57_LOKALER_START_STATUS_KORRIDOR.md",
  "docs/product/P6_B58_BETA_REIBUNGSLOG_VORLAGE.md",
  "docs/product/P7_B65_EXPORT_AUDIT_ROUTE_EVIDENZPAKET.md",
  "docs/product/P7_B67_REIBUNG_ZU_BACKLOG_TRIAGE.md",
  "docs/product/P9_N1_LOKALER_REHEARSAL_NACHWEISRAHMEN.md",
  "docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md",
  "docs/product/R4_SCHEDULE_OPTION_A_DECISION_RECORD.md"
];

const orderedSteps = [
  "Schritt 1: Datenkorridor bestaetigen",
  "Schritt 2: Lokalen Stack starten",
  "Schritt 3: Status pruefen",
  "Schritt 4: UI-Routen manuell oeffnen",
  "Schritt 5: Reibung notieren",
  "Schritt 6: Export-/Auditbelege read-only pruefen",
  "Schritt 7: Option-A-Zeitfenstergrenze beachten",
  "Schritt 8: Kontrolliert stoppen"
];

describe("P11-N3 internal pilot preflight runbook contract", () => {
  it("anchors a documentation-only runbook without workflow or platform changes", () => {
    expect(existsSync(runbookPath)).toBe(true);
    expect(runbookDoc).toContain("P11-N3 Interner Pilot-Preflight-Runbook");
    expect(runbookDoc).toContain("Doku-/Vertragstest-only");
    expect(runbookDoc).toContain("kein neuer Workflow");

    for (const boundary of [
      "keine echten Daten",
      "kein produktionsnaher Pilot",
      "keine neue Produktlogik",
      "keine neue API",
      "keine Persistenz",
      "keine Auth/OIDC-Implementierung",
      "keine Schedule-Runtime",
      "keine Compliance-/DSGVO-Freigabe"
    ]) {
      expect(runbookDoc).toContain(boundary);
    }
  });

  it("links the existing pilot, data, ops, friction, export, audit and Option-A anchors", () => {
    for (const anchor of requiredReferenceAnchors) {
      expect(runbookDoc).toContain(anchor);
    }

    expect(n1Doc).toContain("begrenzter interner Pilot mit anonymisierten/synthetischen Daten");
    expect(n2Doc).toContain("Demo-/Seed-Daten aus dem Repo | `go`");
  });

  it("orders the practical preflight steps from start through stop", () => {
    for (const step of orderedSteps) {
      expect(runbookDoc).toContain(step);
    }

    for (const command of [
      "npm run local:start",
      "npm run local:status",
      "npm run local:check",
      "npm run local:stop"
    ]) {
      expect(runbookDoc).toContain(command);
    }

    for (const route of [
      "http://localhost:3200/",
      "http://localhost:3200/angebot",
      "http://localhost:3200/produktion",
      "Start -> Angebot -> Produktion -> Rueckfragen -> Exporte/Audit"
    ]) {
      expect(runbookDoc).toContain(route);
    }
  });

  it("keeps local preflight distinct from pilot-go, production-like use and deployment", () => {
    for (const state of [
      "lokaler interner Pilot-Preflight mit Demo-/Seed-/synthetischen oder nachweisbar anonymisierten Daten | `go` fuer Preflight-Durchlauf",
      "begrenzter interner Pilot als echte Managementfreigabe | `not assessed`",
      "produktionsnaher Pilot, echte Daten oder Deployment | `blocked`",
      "Ein lokaler Preflight-Erfolg ist kein Deployment-Go",
      "kein Produktionsfreigabe-Go",
      "kein Auth-/Compliance-Go"
    ]) {
      expect(runbookDoc).toContain(state);
    }
  });

  it("requires friction logging, export/audit read-only evidence and go/fix/blocked/decision-needed triage", () => {
    for (const marker of [
      "docs/product/P6_B58_BETA_REIBUNGSLOG_VORLAGE.md",
      "Route oder Schritt",
      "Erwartung",
      "tatsaechliches Verhalten",
      "Schweregrad",
      "Triage: `go`, `fix`, `blocked` oder `decision needed`",
      "Angebots-HTML",
      "Produktionsplan-/Produktionsblatt-HTML",
      "Einkaufslisten-CSV",
      "Audit-/Herkunftsanker"
    ]) {
      expect(runbookDoc).toContain(marker);
    }
  });

  it("preserves the Option-A schedule boundary", () => {
    for (const boundary of [
      "Zeitfenster manuell klaeren und als Rehearsal-/Preflight-Notiz festhalten",
      "keine strukturierte Schedule-/Zeitfenster-Runtime",
      "keine automatische oder halbautomatische `event.schedule`-Uebernahme",
      "kein neues Schedule-Datenmodell",
      "keine neue API, Persistenz, Prisma oder Migration",
      "keine automatische Spec-Korrektur",
      "`decision needed` und kein P11-N3-Fix"
    ]) {
      expect(runbookDoc).toContain(boundary);
    }
  });

  it("is discoverable from the README", () => {
    expect(readmeDoc).toContain("docs/product/P11_N3_INTERNER_PILOT_PREFLIGHT_RUNBOOK.md");
    expect(readmeDoc).toContain("Starten -> Status pruefen -> UI-Routen -> Reibungslog -> Export-/Auditbelege -> kontrolliert stoppen");
  });
});
