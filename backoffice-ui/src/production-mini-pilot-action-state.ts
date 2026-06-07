import type { MiniPilotCheckReportState } from "./mini-pilot-check-report-state.js";

export interface ProductionMiniPilotActionState {
  eyebrow: string;
  title: string;
  statusLabel: string;
  reasonLabel: string;
  provenanceLabel?: string;
  cautionLabel?: string;
  helperText: string;
  commandLabel: string;
}

function buildMiniPilotCarryoverCautionLabel(storageHintLabel?: string): string | undefined {
  if (!storageHintLabel || !/^Lokaler Stand (übernommen|uebernommen)/i.test(storageHintLabel)) {
    return undefined;
  }

  return "Übernommener lokaler Stand: vor dem Export besser noch einmal frisch prüfen.";
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
      reasonLabel: `Grund: ${reportState.reasonLabel}`,
      provenanceLabel: storageHintLabel,
      cautionLabel: buildMiniPilotCarryoverCautionLabel(storageHintLabel),
      helperText: reportState.nextStepLabel,
      commandLabel: reportState.commandLabel
    };
  }

  return {
    eyebrow: "Mini-Pilot-Status vor Export",
    title: "Export erst nach gruenem Mini-Pilot-Check",
    statusLabel: `Status: ${reportState.statusLabel}`,
    reasonLabel: `Grund: ${reportState.reasonLabel}`,
    provenanceLabel: storageHintLabel,
    cautionLabel: buildMiniPilotCarryoverCautionLabel(storageHintLabel),
    helperText: reportState.nextStepLabel,
    commandLabel: reportState.commandLabel
  };
}
