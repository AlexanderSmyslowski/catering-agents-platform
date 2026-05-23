import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packetPath = "docs/product/P12_N2_MANAGEMENT_GO_NO_GO_ENTSCHEIDUNGSPAKET.md";
const packetDoc = existsSync(packetPath) ? readFileSync(packetPath, "utf8") : "";
const n1Doc = readFileSync("docs/product/P11_N1_LIMITED_INTERNAL_PILOT_PREFLIGHT_INDEX.md", "utf8");
const n2Doc = readFileSync("docs/product/P11_N2_PILOT_DATENKORRIDOR_ANONYMISIERT_SYNTHETISCH.md", "utf8");
const n3Doc = readFileSync("docs/product/P11_N3_INTERNER_PILOT_PREFLIGHT_RUNBOOK.md", "utf8");
const b24Doc = readFileSync("docs/product/B24_PILOT_KORRIDOR_ENTSCHEIDUNGSANKER.md", "utf8");
const r4Doc = readFileSync("docs/product/R4_SCHEDULE_OPTION_A_DECISION_RECORD.md", "utf8");

const requiredAnchors = [
  "docs/product/P11_N1_LIMITED_INTERNAL_PILOT_PREFLIGHT_INDEX.md",
  "docs/product/P11_N2_PILOT_DATENKORRIDOR_ANONYMISIERT_SYNTHETISCH.md",
  "docs/product/P11_N3_INTERNER_PILOT_PREFLIGHT_RUNBOOK.md",
  "docs/product/B24_PILOT_KORRIDOR_ENTSCHEIDUNGSANKER.md",
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

const decisionFields = [
  "Nutzerkreis",
  "Fachlicher Betreiber",
  "Technischer Betreiber",
  "Zugriffskontext",
  "Trusted-Actor-/Auth-Kontext",
  "Datenrahmen",
  "Anonymisierungs-/Synthetiknachweis",
  "Nachweis",
  "Stop-Verantwortung",
  "Finale Bewertung"
];

describe("P12-N2 management go/no-go decision packet contract", () => {
  it("creates a documentation-only non-sensitive decision packet without starting a pilot", () => {
    expect(existsSync(packetPath)).toBe(true);
    expect(packetDoc).toContain("P12-N2 Management-Go/No-Go-Entscheidungspaket");
    expect(packetDoc).toContain("Doku-/Vertragstest-only");
    expect(packetDoc).toContain("kein Pilotstart");

    for (const boundary of [
      "kein Deployment",
      "keine Auth-Implementierung",
      "keine echten Daten",
      "keine neue API",
      "keine Persistenz",
      "keine produktive Konfiguration",
      "keine rechtliche/Compliance-/DSGVO-Freigabe"
    ]) {
      expect(packetDoc).toContain(boundary);
    }
  });

  it("links the Plan 11, B24, auth/read-path, local evidence and Option-A anchors", () => {
    for (const anchor of requiredAnchors) {
      expect(packetDoc).toContain(anchor);
    }

    expect(n1Doc).toContain("begrenzter interner Pilot mit anonymisierten/synthetischen Daten | `not assessed`");
    expect(n2Doc).toContain("Anonymisierte Testdaten | `go` nur nach Nachweis");
    expect(n3Doc).toContain("Lokales Rehearsal-Go bleibt kein Pilot-/Auth-/Deployment-Go");
    expect(b24Doc).toContain("begrenzter interner Pilot mit anonymisierten Daten: `not assessed`");
    expect(r4Doc).toContain("Option A bleibt fuehrend");
  });

  it("preserves the hard go/not-assessed/blocked status split", () => {
    for (const state of [
      "lokaler Demo-/Preflight-Korridor mit Demo-/Seed-/synthetischen oder nachweisbar anonymisierten Daten | `go`",
      "echter begrenzter interner Pilot mit anonymisierten/synthetischen Daten | `not assessed`",
      "produktionsnaher Pilot mit echten Daten | `blocked`",
      "oeffentlicher Direktzugriff, produktive Konfiguration oder beliebige echte Uploads | `blocked`",
      "`not assessed` ist kein stilles Go",
      "Ein lokales Gruensignal aus Status, Check, UI, Export oder Audit ersetzt kein Management-Go"
    ]) {
      expect(packetDoc).toContain(state);
    }
  });

  it("requires all management decision fields with conservative defaults", () => {
    for (const field of decisionFields) {
      expect(packetDoc).toContain(field);
    }

    const defaultCount = (packetDoc.match(/`not assessed`/g) ?? []).length;
    expect(defaultCount).toBeGreaterThanOrEqual(10);
    expect(packetDoc).toContain("Finale Bewertung | Darf der echte begrenzte interne Pilot gestartet werden: `go`, `blocked` oder weiter `not assessed`? | `not assessed` |");
  });

  it("keeps evidence non-sensitive and limited to existing local proof anchors", () => {
    for (const marker of [
      "Keine echten Namen",
      "keine personenbezogenen Daten",
      "keine Hostnamen, IPs, Secrets, Tokens",
      "`npm run local:status`",
      "`npm run local:check`",
      "UI-Routen",
      "read-only Export-/Auditbelege",
      "Reibungslog",
      "Evidence-Paket"
    ]) {
      expect(packetDoc).toContain(marker);
    }
  });

  it("preserves Option A and blocks runtime schedule, API, persistence and automatic spec correction", () => {
    for (const boundary of [
      "verbindliches Zeitfenster manuell klaeren",
      "keine strukturierte Schedule-/Zeitfenster-Runtime",
      "keine automatische oder halbautomatische `event.schedule`-Uebernahme",
      "kein neues Schedule-Datenmodell",
      "keine neue API, Persistenz, Prisma oder Migration",
      "keine automatische Spec-Korrektur",
      "`decision needed` und kein P12-N2-Fix"
    ]) {
      expect(packetDoc).toContain(boundary);
    }
  });

  it("defines go/fix/decision-needed/blocked triage without pilot execution", () => {
    for (const triage of [
      "`go` nur nach Alexanders bewusster Managemententscheidung",
      "`fix`",
      "`decision needed`",
      "`blocked`",
      "P12-N2 startet ihn nicht",
      "bis dahin bleibt der echte begrenzte Pilot `not assessed`",
      "Keine Umsetzung im Nachtlauf"
    ]) {
      expect(packetDoc).toContain(triage);
    }
  });
});
