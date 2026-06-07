import { describe, expect, it } from "vitest";
import { buildOfferMiniPilotCardState } from "../backoffice-ui/src/offer-mini-pilot-card-state.js";

describe("offer mini-pilot card state", () => {
  it("keeps the offer draft pilot entry narrow and readable", () => {
    const state = buildOfferMiniPilotCardState();

    expect(state.eyebrow).toBe("Interner Draft-Pilot");
    expect(state.title).toContain("Mini-Pilot-Rahmen");
    expect(state.helperText).toContain("keine automatische Übernahme");
    expect(state.steps).toEqual([
      {
        title: "1. Check auslösen",
        body: "npm run llm:synthetic-live:check:mini-pilot"
      },
      {
        title: "2. Ergebnis lesen",
        body: "Nur bei ready weiterarbeiten; blocked bleibt Stop statt stiller Freigabe."
      },
      {
        title: "3. Entwurf behandeln",
        body: "Draft nur manuell prüfen, fachlich bewerten und bewusst übernehmen."
      }
    ]);
  });
});
