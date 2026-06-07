import { describe, expect, it } from "vitest";
import { buildProductionMiniPilotCardState } from "../backoffice-ui/src/production-mini-pilot-card-state.js";

describe("buildProductionMiniPilotCardState", () => {
  it("describes the guarded production draft mini pilot flow", () => {
    expect(buildProductionMiniPilotCardState()).toEqual({
      eyebrow: "Interner Draft-Pilot",
      title: "Produktions-Draft lokal gegen den Mini-Pilot-Rahmen prüfen",
      helperText:
        "Nur benannte interne Operatoren, nur Draft-Ausgaben, keine automatische Übernahme in Produktobjekte oder Freigaben.",
      steps: [
        {
          title: "1. Check auslösen",
          body: "npm run llm:synthetic-live:check:mini-pilot"
        },
        {
          title: "2. Ergebnis lesen",
          body: "Nur bei ready weiterarbeiten; blocked bleibt Stop statt stiller Produktionsfreigabe."
        },
        {
          title: "3. Draft behandeln",
          body: "Draft nur manuell prüfen, fachlich bewerten und bewusst übernehmen."
        }
      ]
    });
  });
});
