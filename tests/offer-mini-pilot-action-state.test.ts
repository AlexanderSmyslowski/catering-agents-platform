import { describe, expect, it } from "vitest";
import { buildOfferMiniPilotActionState } from "../backoffice-ui/src/offer-mini-pilot-action-state.js";

describe("buildOfferMiniPilotActionState", () => {
  it("keeps non-ready states clearly blocked near takeover actions", () => {
    expect(
      buildOfferMiniPilotActionState({
        statusLabel: "noch kein Ergebnis",
        reasonLabel: "JSON-Ausgabe fehlt.",
        nextStepLabel: "Check zuerst lokal ausführen.",
        commandLabel: "npm run llm:synthetic-live:check:mini-pilot",
        errorLabels: []
      }, "Lokaler Stand uebernommen · zuletzt aktualisiert 07.06.26, 18:20")
    ).toEqual({
      eyebrow: "Mini-Pilot-Status vor Übernahme",
      title: "Übernahme erst nach grünem Mini-Pilot-Check",
      statusLabel: "Status: noch kein Ergebnis",
      reasonLabel: "Grund: JSON-Ausgabe fehlt.",
      trustLabel: "Vertrauenslage: übernommener lokaler Stand.",
      provenanceLabel: "Lokaler Stand uebernommen · zuletzt aktualisiert 07.06.26, 18:20",
      cautionLabel: "Übernommener lokaler Stand: vor der manuellen Übernahme besser noch einmal frisch prüfen.",
      helperText: "Check zuerst lokal ausführen.",
      commandLabel: "npm run llm:synthetic-live:check:mini-pilot"
    });
  });

  it("shows a positive handoff when the mini-pilot result is ready", () => {
    expect(
      buildOfferMiniPilotActionState({
        statusLabel: "ready",
        reasonLabel: "Mini-Pilot-Rahmen ist grün.",
        nextStepLabel: "Draft nur manuell prüfen.",
        commandLabel: "npm run llm:synthetic-live:check:mini-pilot",
        errorLabels: []
      }, "Lokal gespeichert · zuletzt aktualisiert 07.06.26, 18:20")
    ).toEqual({
      eyebrow: "Mini-Pilot-Status vor Übernahme",
      title: "Manuelle Übernahme ist jetzt fachlich prüfbar",
      statusLabel: "Status: ready",
      reasonLabel: "Grund: Mini-Pilot-Rahmen ist grün.",
      trustLabel: "Vertrauenslage: frisch lokal gesetzt.",
      provenanceLabel: "Lokal gespeichert · zuletzt aktualisiert 07.06.26, 18:20",
      cautionLabel: undefined,
      helperText: "Draft nur manuell prüfen.",
      commandLabel: "npm run llm:synthetic-live:check:mini-pilot"
    });
  });

  it("strengthens the takeover caution when the carried-over result is stale", () => {
    expect(
      buildOfferMiniPilotActionState({
        statusLabel: "ready",
        reasonLabel: "Mini-Pilot-Rahmen ist grün.",
        nextStepLabel: "Draft nur manuell prüfen.",
        commandLabel: "npm run llm:synthetic-live:check:mini-pilot",
        errorLabels: []
      }, "Lokaler Stand übernommen · zuletzt aktualisiert 07.06.26, 18:20 · älter als 30 Minuten")
    ).toMatchObject({
      title: "Vor der manuellen Übernahme Mini-Pilot-Check besser neu ausführen",
      statusLabel: "Status: ready, aber neu prüfen",
      trustLabel: "Vertrauenslage: älterer übernommener Stand.",
      cautionLabel: "Übernommener lokaler Stand ist älter als 30 Minuten: vor der manuellen Übernahme bitte neu prüfen."
    });
  });
});
