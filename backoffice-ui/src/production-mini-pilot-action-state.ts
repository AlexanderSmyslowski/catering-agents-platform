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

  if (/älter als 30 Minuten/i.test(storageHintLabel)) {
    return "Übernommener lokaler Stand ist älter als 30 Minuten: vor dem Export bitte neu prüfen.";
  }

  return "Übernommener lokaler Stand: vor dem Export besser noch einmal frisch prüfen.";
}

function isStaleCarryover(storageHintLabel?: string): boolean {
  return Boolean(
    storageHintLabel &&
      /^Lokaler Stand (übernommen|uebernommen)/i.test(storageHintLabel) &&
      /älter als 30 Minuten/i.test(storageHintLabel)
  );
}

export function buildProductionMiniPilotActionState(
  reportState: MiniPilotCheckReportState,
  storageHintLabel?: string
): ProductionMiniPilotActionState {
  if (reportState.statusLabel === "ready") {
    const staleCarryover = isStaleCarryover(storageHintLabel);

    return {
      eyebrow: "Mini-Pilot-Status vor Export",
      title: staleCarryover
        ? "Vor dem Export Mini-Pilot-Check besser neu ausfuehren"
        : "Produktions-Export ist jetzt fachlich pruefbar",
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
