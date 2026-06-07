import type { MiniPilotCheckReportState } from "./mini-pilot-check-report-state.js";

export interface ProductionMiniPilotActionState {
  eyebrow: string;
  title: string;
  statusLabel: string;
  helperText: string;
}

export function buildProductionMiniPilotActionState(
  reportState: MiniPilotCheckReportState
): ProductionMiniPilotActionState {
  if (reportState.statusLabel === "ready") {
    return {
      eyebrow: "Mini-Pilot-Status vor Export",
      title: "Produktions-Export ist jetzt fachlich pruefbar",
      statusLabel: "Status: ready",
      helperText: reportState.nextStepLabel
    };
  }

  return {
    eyebrow: "Mini-Pilot-Status vor Export",
    title: "Export erst nach gruenem Mini-Pilot-Check",
    statusLabel: `Status: ${reportState.statusLabel}`,
    helperText: reportState.nextStepLabel
  };
}
