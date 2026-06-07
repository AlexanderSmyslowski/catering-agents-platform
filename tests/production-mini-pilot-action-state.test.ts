import { describe, expect, it } from "vitest";
import { buildProductionMiniPilotActionState } from "../backoffice-ui/src/production-mini-pilot-action-state.js";

describe("buildProductionMiniPilotActionState", () => {
  it("marks the export review as ready when the mini-pilot check is green", () => {
    expect(
      buildProductionMiniPilotActionState({
        statusLabel: "ready",
        reasonLabel: "Mini-Pilot-Rahmen ist gruen.",
        nextStepLabel: "Draft nur manuell pruefen.",
        commandLabel: "npm run llm:synthetic-live:check:mini-pilot",
        errorLabels: []
      }, "Lokal gespeichert · zuletzt aktualisiert 07.06.26, 18:20")
    ).toEqual({
      eyebrow: "Mini-Pilot-Status vor Export",
      title: "Produktions-Export ist jetzt fachlich pruefbar",
      statusLabel: "Status: ready",
      reasonLabel: "Grund: Mini-Pilot-Rahmen ist gruen.",
      provenanceLabel: "Lokal gespeichert · zuletzt aktualisiert 07.06.26, 18:20",
      cautionLabel: undefined,
      helperText: "Draft nur manuell pruefen.",
      commandLabel: "npm run llm:synthetic-live:check:mini-pilot"
    });
  });

  it("keeps the export review blocked until the check is green", () => {
    expect(
      buildProductionMiniPilotActionState({
        statusLabel: "blocked",
        reasonLabel: "Mini-Pilot-Rahmen ist noch nicht vollstaendig markiert.",
        nextStepLabel: "PA62-Markierungen korrigieren.",
        commandLabel: "npm run llm:synthetic-live:check:mini-pilot",
        errorLabels: []
      }, "Lokaler Stand uebernommen · zuletzt aktualisiert 07.06.26, 18:20")
    ).toEqual({
      eyebrow: "Mini-Pilot-Status vor Export",
      title: "Export erst nach gruenem Mini-Pilot-Check",
      statusLabel: "Status: blocked",
      reasonLabel: "Grund: Mini-Pilot-Rahmen ist noch nicht vollstaendig markiert.",
      provenanceLabel: "Lokaler Stand uebernommen · zuletzt aktualisiert 07.06.26, 18:20",
      cautionLabel: "Übernommener lokaler Stand: vor dem Export besser noch einmal frisch prüfen.",
      helperText: "PA62-Markierungen korrigieren.",
      commandLabel: "npm run llm:synthetic-live:check:mini-pilot"
    });
  });

  it("strengthens the export caution when the carried-over result is stale", () => {
    expect(
      buildProductionMiniPilotActionState({
        statusLabel: "ready",
        reasonLabel: "Mini-Pilot-Rahmen ist gruen.",
        nextStepLabel: "Draft nur manuell pruefen.",
        commandLabel: "npm run llm:synthetic-live:check:mini-pilot",
        errorLabels: []
      }, "Lokaler Stand übernommen · zuletzt aktualisiert 07.06.26, 18:20 · älter als 30 Minuten")
    ).toMatchObject({
      title: "Vor dem Export Mini-Pilot-Check besser neu ausfuehren",
      statusLabel: "Status: ready, aber neu pruefen",
      cautionLabel: "Übernommener lokaler Stand ist älter als 30 Minuten: vor dem Export bitte neu prüfen."
    });
  });
});
