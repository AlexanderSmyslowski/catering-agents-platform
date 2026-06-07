import { describe, expect, it } from "vitest";
import { buildOfferMiniPilotActionState } from "../backoffice-ui/src/offer-mini-pilot-action-state.js";

describe("buildOfferMiniPilotActionState", () => {
  it("keeps non-ready states clearly blocked near takeover actions", () => {
    expect(
      buildOfferMiniPilotActionState({
        statusLabel: "noch kein Ergebnis",
        reasonLabel: "JSON-Ausgabe fehlt.",
        nextStepLabel: "Check zuerst lokal ausfuehren.",
        commandLabel: "npm run llm:synthetic-live:check:mini-pilot",
        errorLabels: []
      })
    ).toEqual({
      eyebrow: "Mini-Pilot-Status vor Uebernahme",
      title: "Uebernahme erst nach gruenem Mini-Pilot-Check",
      statusLabel: "Status: noch kein Ergebnis",
      helperText: "Check zuerst lokal ausfuehren."
    });
  });

  it("shows a positive handoff when the mini-pilot result is ready", () => {
    expect(
      buildOfferMiniPilotActionState({
        statusLabel: "ready",
        reasonLabel: "Mini-Pilot-Rahmen ist gruen.",
        nextStepLabel: "Draft nur manuell pruefen.",
        commandLabel: "npm run llm:synthetic-live:check:mini-pilot",
        errorLabels: []
      })
    ).toEqual({
      eyebrow: "Mini-Pilot-Status vor Uebernahme",
      title: "Manuelle Uebernahme ist jetzt fachlich pruefbar",
      statusLabel: "Status: ready",
      helperText: "Draft nur manuell pruefen."
    });
  });
});
