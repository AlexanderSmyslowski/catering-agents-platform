import type { MiniPilotCheckReportState } from "./mini-pilot-check-report-state.js";

export interface ProductionMiniPilotActionState {
  eyebrow: string;
  title: string;
  statusLabel: string;
  provenanceLabel?: string;
  helperText: string;
}

export function buildProductionMiniPilotActionState(
  reportState: MiniPilotCheckReportState,
  storageHintLabel?: string
): ProductionMiniPilotActionState {
  if (reportState.statusLabel === "ready") {
    return {
      eyebrow: "Mini-Pilot-Status vor Export",
      title: "Produktions-Export ist jetzt fachlich pruefbar",
      statusLabel: "Status: ready",
      provenanceLabel: storageHintLabel,
      helperText: reportState.nextStepLabel
    };
  }

  return {
    eyebrow: "Mini-Pilot-Status vor Export",
    title: "Export erst nach gruenem Mini-Pilot-Check",
    statusLabel: `Status: ${reportState.statusLabel}`,
    provenanceLabel: storageHintLabel,
    helperText: reportState.nextStepLabel
  };
}
