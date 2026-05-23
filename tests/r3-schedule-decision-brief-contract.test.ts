import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const decisionPath = "docs/product/R3_SCHEDULE_ZEITFENSTER_ENTSCHEIDUNGSVORLAGE.md";
const decisionDoc = existsSync(decisionPath) ? readFileSync(decisionPath, "utf8") : "";

const requiredOptionAnchors = [
  "Option A: Vorerst Copy-/Anleitungs-Loesung ohne Datenmodelländerung",
  "Option B: Strukturierte Rueckfrage mit bestehender Spec-Patch-Bindung",
  "Option C: Spaeteres eigenes Schedule-/Zeitfenster-Modell",
  "`Wie lautet das verbindliche Zeitfenster?`",
  "`event.schedule`-Uncertainty"
];

const requiredRecommendationAnchors = [
  "Empfohlen wird Option A als konservativer Minimalentscheid fuer den internen Beta-MVP",
  "Option B ist der naechste fachlich saubere Entscheidungspfad",
  "Option C bleibt ein spaeterer Produktarchitekturpfad",
  "Konservative Empfehlung fuer jetzt: A bestaetigen; B nur als naechstes bewusstes Gate vormerken; C zurueckstellen."
];

const requiredBoundaryAnchors = [
  "kein neues Schedule-/Zeitfenster-Datenmodell",
  "keine Migration und keine neue Persistenzwelt",
  "keine neue API",
  "keine UI-Feature-Umsetzung",
  "keine automatische Spec-Korrektur",
  "keine echte Datenverarbeitung",
  "kein OAuth/Login/OIDC",
  "kein Deployment",
  "Eine Antwort soll `event.schedule` automatisch oder halbautomatisch veraendern",
  "Die Entscheidung zwischen Spec-Patch-Bindung und eigenem Schedule-Modell ist nicht ausdruecklich getroffen"
];

describe("R3 schedule decision brief contract", () => {
  it("creates a repo-local decision brief for the schedule/time-window rehearsal finding", () => {
    expect(existsSync(decisionPath)).toBe(true);
    expect(decisionDoc).toContain("R3 Schedule-/Zeitfenster-Entscheidungsvorlage");
    expect(decisionDoc).toContain("Status: strukturierte Rueckfrage / Entscheidungsvorlage, keine Runtime-Implementierung");

    for (const anchor of requiredOptionAnchors) {
      expect(decisionDoc).toContain(anchor);
    }
  });

  it("recommends the conservative minimal beta-MVP option without final runtime implementation", () => {
    for (const anchor of requiredRecommendationAnchors) {
      expect(decisionDoc).toContain(anchor);
    }

    expect(decisionDoc).toContain("Die bestehende Rueckfrage bleibt sichtbar.");
    expect(decisionDoc).toContain("nicht strukturiert in `event.schedule` ueberfuehrt");
  });

  it("documents explicit non-goals and stop gates instead of adding runtime logic", () => {
    for (const anchor of requiredBoundaryAnchors) {
      expect(decisionDoc).toContain(anchor);
    }

    expect(decisionDoc).not.toContain("CREATE TABLE");
    expect(decisionDoc).not.toContain("POST /v1");
    expect(decisionDoc).not.toContain("PATCH /v1");
  });
});
