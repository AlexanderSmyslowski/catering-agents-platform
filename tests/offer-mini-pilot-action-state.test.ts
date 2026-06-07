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
      }, "Lokaler Stand uebernommen · zuletzt aktualisiert 07.06.26, 18:20")
    ).toEqual({
      eyebrow: "Mini-Pilot-Status vor Uebernahme",
      title: "Uebernahme erst nach gruenem Mini-Pilot-Check",
      statusLabel: "Status: noch kein Ergebnis",
      reasonLabel: "Grund: JSON-Ausgabe fehlt.",
      provenanceLabel: "Lokaler Stand uebernommen · zuletzt aktualisiert 07.06.26, 18:20",
      cautionLabel: "Übernommener lokaler Stand: vor der manuellen Übernahme besser noch einmal frisch prüfen.",
      helperText: "Check zuerst lokal ausfuehren.",
      commandLabel: "npm run llm:synthetic-live:check:mini-pilot"
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
      }, "Lokal gespeichert · zuletzt aktualisiert 07.06.26, 18:20")
    ).toEqual({
      eyebrow: "Mini-Pilot-Status vor Uebernahme",
      title: "Manuelle Uebernahme ist jetzt fachlich pruefbar",
      statusLabel: "Status: ready",
      reasonLabel: "Grund: Mini-Pilot-Rahmen ist gruen.",
      provenanceLabel: "Lokal gespeichert · zuletzt aktualisiert 07.06.26, 18:20",
      cautionLabel: undefined,
      helperText: "Draft nur manuell pruefen.",
      commandLabel: "npm run llm:synthetic-live:check:mini-pilot"
    });
  });

  it("strengthens the takeover caution when the carried-over result is stale", () => {
    expect(
      buildOfferMiniPilotActionState({
        statusLabel: "ready",
        reasonLabel: "Mini-Pilot-Rahmen ist gruen.",
        nextStepLabel: "Draft nur manuell pruefen.",
        commandLabel: "npm run llm:synthetic-live:check:mini-pilot",
        errorLabels: []
      }, "Lokaler Stand übernommen · zuletzt aktualisiert 07.06.26, 18:20 · älter als 30 Minuten")
    ).toMatchObject({
      title: "Vor der manuellen Uebernahme Mini-Pilot-Check besser neu ausfuehren",
      statusLabel: "Status: ready, aber neu pruefen",
      cautionLabel: "Übernommener lokaler Stand ist älter als 30 Minuten: vor der manuellen Übernahme bitte neu prüfen."
    });
  });
});
