import { describe, expect, it } from "vitest";
import { buildHomeMiniPilotCardState } from "../backoffice-ui/src/home-mini-pilot-card-state.js";

describe("home mini-pilot card state", () => {
  it("keeps the mini-pilot entry narrow and operator-readable", () => {
    const state = buildHomeMiniPilotCardState();

    expect(state.eyebrow).toBe("Interner Mini-Pilot");
    expect(state.title).toContain("Draft-Probe");
    expect(state.helperText).toContain("keine automatische Produktänderung");
    expect(state.steps).toEqual([
      {
        title: "1. Kompakter Check",
        body: "npm run llm:synthetic-live:check:mini-pilot"
      },
      {
        title: "2. Status lesen",
        body: "ready oder blocked mit Grund und nächstem sicheren Schritt direkt im JSON-Ergebnis."
      },
      {
        title: "3. Draft behandeln",
        body: "Ergebnisse nur manuell prüfen und bewusst übernehmen; keine automatische Schreibwirkung."
      }
    ]);
  });
});
