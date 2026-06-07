import type { MiniPilotCheckReportState } from "./mini-pilot-check-report-state.js";

export interface OfferMiniPilotActionState {
  eyebrow: string;
  title: string;
  statusLabel: string;
  helperText: string;
}

export function buildOfferMiniPilotActionState(
  reportState: MiniPilotCheckReportState
): OfferMiniPilotActionState {
  if (reportState.statusLabel === "ready") {
    return {
      eyebrow: "Mini-Pilot-Status vor Uebernahme",
      title: "Manuelle Uebernahme ist jetzt fachlich pruefbar",
      statusLabel: "Status: ready",
      helperText: reportState.nextStepLabel
    };
  }

  return {
    eyebrow: "Mini-Pilot-Status vor Uebernahme",
    title: "Uebernahme erst nach gruenem Mini-Pilot-Check",
    statusLabel: `Status: ${reportState.statusLabel}`,
    helperText: reportState.nextStepLabel
  };
}
