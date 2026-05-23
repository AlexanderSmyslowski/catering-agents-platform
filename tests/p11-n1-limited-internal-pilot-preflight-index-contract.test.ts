import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const indexPath = "docs/product/P11_N1_LIMITED_INTERNAL_PILOT_PREFLIGHT_INDEX.md";
const indexDoc = existsSync(indexPath) ? readFileSync(indexPath, "utf8") : "";
const b24Doc = readFileSync("docs/product/B24_PILOT_KORRIDOR_ENTSCHEIDUNGSANKER.md", "utf8");
const r4Doc = readFileSync("docs/product/R4_SCHEDULE_OPTION_A_DECISION_RECORD.md", "utf8");
const p9Doc = readFileSync("docs/product/P9_N1_LOKALER_REHEARSAL_NACHWEISRAHMEN.md", "utf8");

const requiredPreflightQuestions = [
  "Zielumgebung",
  "Nutzerkreis",
  "Datenumfang",
  "Betreiberkontext",
  "Zugriffskontext",
  "Anonymisierungs-/Synthetiknachweis",
  "Abgrenzung zu Plan 9/10",
  "Stop-Gates"
];

const requiredBlockedBoundaries = [
  "produktionsnaher Pilot mit echten Daten",
  "echte Kunden-, Personen-, Mitarbeiter-, Einsatz-, Schicht- oder Abrechnungsdaten",
  "beliebige echte Uploads oder produktionsnahe Dateiannahme",
  "Deployment, Hetzner, SSH, Secrets",
  "OAuth/Login/OIDC/Session/Auth-Ausbau",
  "neue API, API-Vertragsaenderung, neue Persistenz, Prisma oder Migration",
  "Retention-/Loesch-/Backup-Entscheidung",
  "Sandbox-/Worker-/AV-Freigabe",
  "rechtssichere Compliance-/DSGVO-/Audit-Freigabe"
];

describe("P11-N1 limited internal pilot preflight index contract", () => {
  it("anchors a documentation-only pilot preflight index from B24", () => {
    expect(existsSync(indexPath)).toBe(true);
    expect(indexDoc).toContain("P11-N1 Limited Internal Pilot Preflight Index");
    expect(indexDoc).toContain("Doku-/Vertragstest-only");
    expect(indexDoc).toContain("begrenzter interner Pilot mit anonymisierten Daten: not assessed");
    expect(indexDoc).toContain("keine Runtime");
    expect(indexDoc).toContain("kein Deployment");
    expect(indexDoc).toContain("keine neue API");
    expect(indexDoc).toContain("keine Persistenz");
    expect(indexDoc).toContain("keine Auth/OIDC-Implementierung");
    expect(indexDoc).toContain("keine echten Daten");
    expect(indexDoc).toContain("keine Compliance-/DSGVO-Freigabe");

    expect(b24Doc).toContain("begrenzter interner Pilot mit anonymisierten Daten: `not assessed`");
  });

  it("separates local rehearsal go, limited pilot not assessed, and production-like blocked", () => {
    for (const requiredState of [
      "lokaler Demo-/Rehearsal-Korridor",
      "`go`",
      "begrenzter interner Pilot mit anonymisierten/synthetischen Daten",
      "`not assessed`",
      "produktionsnaher Pilot mit echten Daten",
      "`blocked`",
      "Ein lokales Gruensignal aus Plan 9/10 darf nicht als Pilot-Go gelesen werden",
      "`not assessed` ist kein stilles Go"
    ]) {
      expect(indexDoc).toContain(requiredState);
    }

    expect(p9Doc).toContain("lokal/synthetisch gruen");
    expect(p9Doc).toContain("Rehearsal-Go darf nur vergeben werden");
  });

  it("names the non-sensitive must questions for later assessment", () => {
    for (const question of requiredPreflightQuestions) {
      expect(indexDoc).toContain(question);
    }

    for (const nonSensitiveLimit of [
      "Keine Secrets",
      "keine Tokens",
      "keine privaten SSH-Keys",
      "keine produktiven ENV-Werte",
      "keine IP-/Serverdetails",
      "keine echten Personen- oder Kundendaten",
      "keine echten Betriebsdaten"
    ]) {
      expect(indexDoc).toContain(nonSensitiveLimit);
    }
  });

  it("keeps Plan 9/10 evidence usable but not sufficient for pilot go", () => {
    for (const evidence of [
      "npm run local:status",
      "npm run local:check",
      "manuelle UI-Sichtung von `/`, `/angebot` und `/produktion`",
      "read-only Angebots-HTML",
      "Produktionsplan-/Produktionsblatt-HTML",
      "Einkaufslisten-CSV",
      "read-only Audit-/Herkunftsanker",
      "P6-B58-Reibungslog",
      "P7-B65-Evidence-Paket",
      "`go`, `fix`, `blocked` und `decision needed`"
    ]) {
      expect(indexDoc).toContain(evidence);
    }

    expect(indexDoc).toContain("Diese Evidenz bleibt lokal/synthetisch");
    expect(indexDoc).toContain("keine produktionsnahe Freigabe");
  });

  it("preserves the R4 Option A schedule boundary", () => {
    for (const boundary of [
      "Option A bleibt fuehrend",
      "keine strukturierte Schedule-/Zeitfenster-Runtime",
      "keine automatische oder halbautomatische `event.schedule`-Uebernahme",
      "kein neues Schedule-Datenmodell",
      "keine automatische Spec-Korrektur",
      "`decision needed`"
    ]) {
      expect(indexDoc).toContain(boundary);
    }

    expect(r4Doc).toContain("Option A bleibt fuehrend");
    expect(r4Doc).toContain("keine** strukturierte Schedule-/Zeitfenster-Runtime gebaut");
  });

  it("keeps production-like, legal, auth, data, persistence, and infra work blocked", () => {
    for (const blockedBoundary of requiredBlockedBoundaries) {
      expect(indexDoc).toContain(blockedBoundary);
    }
  });
});
