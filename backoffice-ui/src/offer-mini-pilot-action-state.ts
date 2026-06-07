import type { MiniPilotCheckReportState } from "./mini-pilot-check-report-state.js";

export interface OfferMiniPilotActionState {
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

  return "Übernommener lokaler Stand: vor der manuellen Übernahme besser noch einmal frisch prüfen.";
}

export function buildOfferMiniPilotActionState(
  reportState: MiniPilotCheckReportState,
  storageHintLabel?: string
): OfferMiniPilotActionState {
  if (reportState.statusLabel === "ready") {
    return {
      eyebrow: "Mini-Pilot-Status vor Uebernahme",
      title: "Manuelle Uebernahme ist jetzt fachlich pruefbar",
      statusLabel: "Status: ready",
      reasonLabel: `Grund: ${reportState.reasonLabel}`,
      provenanceLabel: storageHintLabel,
      cautionLabel: buildMiniPilotCarryoverCautionLabel(storageHintLabel),
      helperText: reportState.nextStepLabel,
      commandLabel: reportState.commandLabel
    };
  }

  return {
    eyebrow: "Mini-Pilot-Status vor Uebernahme",
    title: "Uebernahme erst nach gruenem Mini-Pilot-Check",
    statusLabel: `Status: ${reportState.statusLabel}`,
    reasonLabel: `Grund: ${reportState.reasonLabel}`,
    provenanceLabel: storageHintLabel,
    cautionLabel: buildMiniPilotCarryoverCautionLabel(storageHintLabel),
    helperText: reportState.nextStepLabel,
    commandLabel: reportState.commandLabel
  };
}
