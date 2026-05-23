import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const planPath = "docs/plans/hans-night-build-plan-12-internal-pilot-go-no-go-decision-2026-05-24.md";
const planDoc = existsSync(planPath) ? readFileSync(planPath, "utf8") : "";

const requiredAnchors = [
  "Plan 11 ist gruen abgeschlossen",
  "R4 Option-A Decision Record",
  "P11-N1",
  "P11-N2",
  "P11-N3",
  "B24",
  "PA7/PA8/PA9",
  "B8/B9",
  "P6/P7/P9/C8",
  "Option A"
];

const requiredStopGates = [
  "Deployment, Hetzner, SSH, Secrets",
  "echte Kunden-, Personen-, Mitarbeiter-, Einsatz-, Schicht-, Abrechnungs- oder produktionsnahe Pilotdaten",
  "neue Persistenz, Prisma, Migration",
  "neue API-Endpunkte oder veraenderte API-Vertraege",
  "OAuth/Login/OIDC/Session/Nutzerverwaltung",
  "PII/Retention/Backup-Entscheidung",
  "Sandbox/Worker/AV-Entscheidung",
  "rechtliche/Compliance-/DSGVO-/Signatur-/Export-Verbindlichkeitsentscheidung",
  "Runtime-Schedule-/Zeitfenster-Modell"
];

describe("Plan 12 internal pilot go/no-go decision plan contract", () => {
  it("creates a start-ready plan derived from green Plan 11 without starting the pilot", () => {
    expect(existsSync(planPath)).toBe(true);
    expect(planDoc).toContain("Hans Night Build Plan 12");
    expect(planDoc).toContain("Status: startbereit nach gruenem Plan 11 / kein Pilotstart in diesem Plan");
    expect(planDoc).toContain("Der naechste echte Bottleneck");
    expect(planDoc).toContain("Go/No-Go-Entscheidungspaket");
    expect(planDoc).toContain("keinen Pilot starten");
  });

  it("keeps the known Plan 11 and Option-A anchors leading", () => {
    for (const anchor of requiredAnchors) {
      expect(planDoc).toContain(anchor);
    }

    expect(planDoc).toContain("Das verbindliche Zeitfenster wird manuell geklaert");
    expect(planDoc).toContain("keine Runtime-Schedule-Loesung");
    expect(planDoc).toContain("keine API-/Persistenz-/Migrationsaenderung");
    expect(planDoc).toContain("keine automatische Spec-Korrektur");
  });

  it("preserves the pilot status split go/not-assessed/blocked", () => {
    expect(planDoc).toContain("lokaler Preflight `go`");
    expect(planDoc).toContain("echter begrenzter Pilot `not assessed`");
    expect(planDoc).toContain("produktionsnaher Pilot mit echten Daten `blocked`");
    expect(planDoc).toContain("Default `not assessed` fuer echten begrenzten Pilot");
    expect(planDoc).toContain("`blocked` fuer echte/produktive Daten");
  });

  it("keeps all hard stop gates explicit", () => {
    for (const stopGate of requiredStopGates) {
      expect(planDoc).toContain(stopGate);
    }

    expect(planDoc).toContain("`tmp/` bleibt bekannt untracked und wird nicht beruehrt");
  });

  it("limits Plan 12 to documentation, contract or copy fixes and requires gates", () => {
    expect(planDoc).toContain("Doku-/Vertragstest-only Anker");
    expect(planDoc).toContain("genau ein kleiner Doku-/Contract-/Copy-Fix");
    expect(planDoc).toContain("Kein Start eines echten Pilotbetriebs in Plan 12");

    for (const gate of [
      "fokussierter Test/Contract-Test passend zu Aenderungen",
      "npm test",
      "npm run build",
      "npm audit --omit=dev",
      "git diff --check",
      "npm run local:status",
      "npm run local:check",
      "CI fuer letzten Push pruefen"
    ]) {
      expect(planDoc).toContain(gate);
    }
  });

  it("marks the next decision boundary instead of unbounded roadmap work", () => {
    expect(planDoc).toContain("Wenn ein nicht-sensitives Management-Go fuer einen echten begrenzten internen Pilot fehlt");
    expect(planDoc).toContain("bewusst `decision needed` / Stop statt Scheinausbau");
    expect(planDoc).toContain("Ohne Alexanders bewusste Managemententscheidung bleibt ein echter begrenzter interner Pilot `not assessed`");
    expect(planDoc).toContain("produktionsnahe Nutzung mit echten Daten bleibt `blocked`");
  });
});
