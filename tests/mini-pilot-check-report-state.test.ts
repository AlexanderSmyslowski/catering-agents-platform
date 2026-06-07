import { describe, expect, it } from "vitest";
import { buildMiniPilotCheckReportState } from "../backoffice-ui/src/mini-pilot-check-report-state.js";

describe("buildMiniPilotCheckReportState", () => {
  it("starts with a waiting state before any local check result is pasted", () => {
    expect(buildMiniPilotCheckReportState("")).toEqual({
      statusLabel: "noch kein Ergebnis",
      reasonLabel: "JSON-Ausgabe aus dem lokalen Mini-Pilot-Check fehlt noch.",
      nextStepLabel: "Check lokal ausfuehren, JSON einfuellen und dann erst mit dem Draft weiterarbeiten.",
      commandLabel: "npm run llm:synthetic-live:check:mini-pilot",
      errorLabels: []
    });
  });

  it("shows a parse warning when the pasted result is not JSON", () => {
    expect(buildMiniPilotCheckReportState("not-json")).toEqual({
      statusLabel: "ungueltiges Ergebnis",
      reasonLabel: "Die Eingabe ist kein lesbares Mini-Pilot-JSON.",
      nextStepLabel: "Nur die JSON-Ausgabe von npm run llm:synthetic-live:check:mini-pilot einfuegen.",
      commandLabel: "npm run llm:synthetic-live:check:mini-pilot",
      errorLabels: []
    });
  });

  it("summarizes a ready result from the local mini-pilot check", () => {
    expect(
      buildMiniPilotCheckReportState(
        JSON.stringify({
          ok: true,
          errors: [],
          summary: {
            status: "ready",
            reason: "mini_pilot_ready",
            nextStep: "Draft nur manuell pruefen."
          },
          preflight: {
            preferredMiniPilotCommand: "npm run llm:synthetic-live:check:mini-pilot"
          }
        })
      )
    ).toEqual({
      statusLabel: "ready",
      reasonLabel: "Mini-Pilot-Rahmen ist gruen.",
      nextStepLabel: "Draft nur manuell pruefen.",
      commandLabel: "npm run llm:synthetic-live:check:mini-pilot",
      errorLabels: []
    });
  });

  it("keeps a blocked result readable together with reported errors", () => {
    expect(
      buildMiniPilotCheckReportState(
        JSON.stringify({
          ok: false,
          errors: ["mini-pilot policy is not fully marked as ready"],
          summary: {
            status: "blocked",
            reason: "mini_pilot_policy_incomplete",
            nextStep: "PA62-Markierungen korrigieren."
          },
          preflight: {}
        })
      )
    ).toEqual({
      statusLabel: "blocked",
      reasonLabel: "Mini-Pilot-Rahmen ist noch nicht vollstaendig markiert.",
      nextStepLabel: "PA62-Markierungen korrigieren.",
      commandLabel: "npm run llm:synthetic-live:check:mini-pilot",
      errorLabels: ["mini-pilot policy is not fully marked as ready"]
    });
  });
});
