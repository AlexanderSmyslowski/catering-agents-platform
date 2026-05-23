import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dataCorridorPath = "docs/product/P11_N2_PILOT_DATENKORRIDOR_ANONYMISIERT_SYNTHETISCH.md";
const dataCorridorDoc = existsSync(dataCorridorPath) ? readFileSync(dataCorridorPath, "utf8") : "";
const n1Doc = readFileSync("docs/product/P11_N1_LIMITED_INTERNAL_PILOT_PREFLIGHT_INDEX.md", "utf8");
const b24Doc = readFileSync("docs/product/B24_PILOT_KORRIDOR_ENTSCHEIDUNGSANKER.md", "utf8");
const p7DataDoc = readFileSync("docs/product/P7_B64_SYNTHETISCHE_SZENARIO_UND_DATENKARTE.md", "utf8");

const requiredReferenceAnchors = [
  "docs/product/P11_N1_LIMITED_INTERNAL_PILOT_PREFLIGHT_INDEX.md",
  "docs/product/B24_PILOT_KORRIDOR_ENTSCHEIDUNGSANKER.md",
  "docs/product/C8_INTERNER_DEMO_DURCHLAUF_ABNAHMEWEG.md",
  "docs/product/P6_B56_BETA_ONBOARDING_ISTSTAND_LUECKENKARTE.md",
  "docs/product/P6_B57_LOKALER_START_STATUS_KORRIDOR.md",
  "docs/product/P6_B58_BETA_REIBUNGSLOG_VORLAGE.md",
  "docs/product/P6_B61_BETA_MANAGEMENT_ENTSCHEIDUNGSVORLAGE.md",
  "docs/product/P7_B63_REVIEWER_REHEARSAL_STARTKARTE.md",
  "docs/product/P7_B64_SYNTHETISCHE_SZENARIO_UND_DATENKARTE.md",
  "docs/product/P7_B65_EXPORT_AUDIT_ROUTE_EVIDENZPAKET.md",
  "docs/product/P7_B67_REIBUNG_ZU_BACKLOG_TRIAGE.md",
  "docs/product/P9_N1_LOKALER_REHEARSAL_NACHWEISRAHMEN.md",
  "docs/deployment/B25_HETZNER_DEPLOYMENT_PREFLIGHT.md",
  "docs/deployment/B26_HETZNER_PREFLIGHT_EVIDENCE_CHECKLIST.md",
  "docs/deployment/B27_HETZNER_PREFLIGHT_STATUS_TEMPLATE.md",
  "docs/deployment/B28_HETZNER_PREFLIGHT_DECISION_PACKET.md",
  "docs/deployment/B29_HETZNER_PREFLIGHT_OPERATOR_QUESTIONS.md",
  "docs/deployment/B30_HETZNER_PREFLIGHT_ANSWER_HANDOFF.md",
  "docs/deployment/B31_HETZNER_MANAGEMENT_DECISION_LIST.md",
  "docs/product/R4_SCHEDULE_OPTION_A_DECISION_RECORD.md"
];

const allowedExamples = [
  "Testfirma Nordstern Demo GmbH",
  "Muster Catering Probe AG",
  "Erika Beispiel",
  "erika.beispiel@example.invalid",
  "+49 000 000000",
  "Musterhalle 7, 12345 Beispielstadt",
  "15. Oktober 2099",
  "42 fiktive Gaeste",
  "Aufbau 16:00 Uhr, Service 18:00 bis 21:00 Uhr, Abbau bis 22:00 Uhr"
];

const noGoData = [
  "echte Namen",
  "echte Telefonnummern",
  "echte E-Mail-Adressen",
  "echte Privat-/Firmenadressen",
  "echte Kundennamen",
  "echte Mitarbeiter-, Dienstplan-, Einsatz-, Schicht-, Lohn-, Rechnungs- oder Abrechnungsdaten",
  "echte Termine aus laufenden oder vergangenen Auftraegen",
  "echte Dokumentinhalte",
  "echte PDFs",
  "echte E-Mails",
  "echte Pages-Dateien",
  "Secrets, Tokens, private SSH-Keys, produktive `.env`, Connection Strings, Hostnamen, IPs oder Serverdetails"
];

describe("P11-N2 pilot data corridor contract", () => {
  it("anchors a documentation-only corridor without product or platform changes", () => {
    expect(existsSync(dataCorridorPath)).toBe(true);
    expect(dataCorridorDoc).toContain("P11-N2 Pilot-Datenkorridor anonymisiert/synthetisch");
    expect(dataCorridorDoc).toContain("Doku-/Vertragstest-only");

    for (const outOfScope of [
      "keine echten Daten",
      "keine Testdatenplattform",
      "kein Reset-/Seeder-Feature",
      "keine neue API",
      "keine Persistenz",
      "kein Deployment",
      "keine Auth/OIDC-Implementierung",
      "keine Compliance-/DSGVO-Freigabe"
    ]) {
      expect(dataCorridorDoc).toContain(outOfScope);
    }
  });

  it("links the existing P6/P7/P9/C8/B24/B25-B31 anchors instead of building a new platform", () => {
    for (const anchor of requiredReferenceAnchors) {
      expect(dataCorridorDoc).toContain(anchor);
    }

    expect(dataCorridorDoc).toContain("B25-B31 bleiben Deployment-/Hetzner-Preflight-Anker");
    expect(dataCorridorDoc).toContain("nur verlinkt und nicht ausgefuellt");
  });

  it("classifies demo, synthetic and anonymized data as allowed while blocking real or pseudonymized data", () => {
    for (const expectedState of [
      "Demo-/Seed-Daten aus dem Repo | `go`",
      "Offensichtlich synthetische Daten | `go`",
      "Anonymisierte Testdaten | `go` nur nach Nachweis",
      "Pseudonymisierte echte Daten | `blocked`",
      "Echte Kunden-, Personen-, Mitarbeiter-, Einsatz-, Schicht- oder Abrechnungsdaten | `blocked`",
      "Produktionsnahe Betriebsdateien oder beliebige echte Uploads | `blocked`"
    ]) {
      expect(dataCorridorDoc).toContain(expectedState);
    }

    expect(n1Doc).toContain("begrenzter interner Pilot mit anonymisierten/synthetischen Daten");
    expect(b24Doc).toContain("nur Demo-/synthetische/anonymisierte Daten erlaubt");
  });

  it("provides concrete synthetic example values for internal testers", () => {
    for (const example of allowedExamples) {
      expect(dataCorridorDoc).toContain(example);
    }

    expect(p7DataDoc).toContain("Testfirma Nordstern Demo GmbH");
    expect(dataCorridorDoc).toContain("Die Werte aus `docs/product/P7_B64_SYNTHETISCHE_SZENARIO_UND_DATENKARTE.md` bleiben der bevorzugte Default");
  });

  it("names no-go data and stop rules to avoid accidental real data use", () => {
    for (const forbidden of noGoData) {
      expect(dataCorridorDoc).toContain(forbidden);
    }

    for (const stopRule of [
      "echte oder produktionsnahe Daten eingegeben, hochgeladen, angezeigt, exportiert oder dokumentiert werden sollen",
      "ein Upload nur mit echten Dateien sinnvoll wirkt",
      "ein Screenshot echte Namen, Kontakte, Adressen, Termine, Dokumentinhalte oder Betriebsdaten enthalten wuerde",
      "Retention/Loeschung/Backup, Sandbox/Worker/AV, Auth/OIDC, Deployment oder Compliance geklaert werden muessten",
      "ein lokales Demo-/Rehearsal-Go als Pilot-Go, Produktionsfreigabe, externe Freigabe oder rechtssichere Audit-/Compliance-Aussage gelesen werden soll"
    ]) {
      expect(dataCorridorDoc).toContain(stopRule);
    }
  });

  it("keeps anonymized distinct from pseudonymized and preserves Option A schedule boundary", () => {
    for (const boundary of [
      "`synthetisch` bedeutet: frei erfunden und nicht aus echten Daten abgeleitet",
      "`anonymisiert` bedeutet: kein Rueckschluss auf echte Personen, Kunden, Mitarbeitende, Einsaetze, Schichten oder Abrechnung moeglich",
      "`pseudonymisiert` bedeutet: echte Quelle wurde nur maskiert, gekuerzt oder ersetzt; das bleibt im P11-N2-Korridor `blocked`",
      "keine strukturierte Schedule-/Zeitfenster-Runtime",
      "keine automatische oder halbautomatische `event.schedule`-Uebernahme",
      "keine API-/Persistenz-/Migrationsaenderung",
      "Zeitfenster-Beispiele duerfen nur als synthetische manuelle Rehearsal-Notiz genutzt werden"
    ]) {
      expect(dataCorridorDoc).toContain(boundary);
    }
  });
});
