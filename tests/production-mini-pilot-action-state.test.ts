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
      provenanceLabel: "Lokal gespeichert · zuletzt aktualisiert 07.06.26, 18:20",
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
      provenanceLabel: "Lokaler Stand uebernommen · zuletzt aktualisiert 07.06.26, 18:20",
      helperText: "PA62-Markierungen korrigieren.",
      commandLabel: "npm run llm:synthetic-live:check:mini-pilot"
    });
  });
});
