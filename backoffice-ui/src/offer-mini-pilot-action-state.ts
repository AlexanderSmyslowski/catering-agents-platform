import type { MiniPilotCheckReportState } from "./mini-pilot-check-report-state.js";

export interface OfferMiniPilotActionState {
  eyebrow: string;
  title: string;
  statusLabel: string;
  reasonLabel: string;
  trustLabel?: string;
  provenanceLabel?: string;
  cautionLabel?: string;
  helperText: string;
  commandLabel: string;
}

function buildMiniPilotTrustLabel(storageHintLabel?: string): string | undefined {
  if (!storageHintLabel) {
    return undefined;
  }

  if (/^Lokal gespeichert/i.test(storageHintLabel)) {
    return "Vertrauenslage: frisch lokal gesetzt.";
  }

  if (!/^Lokaler Stand (übernommen|uebernommen)/i.test(storageHintLabel)) {
    return undefined;
  }

  if (/älter als 30 Minuten/i.test(storageHintLabel)) {
    return "Vertrauenslage: älterer übernommener Stand.";
  }

  return "Vertrauenslage: übernommener lokaler Stand.";
}

function buildMiniPilotCarryoverCautionLabel(storageHintLabel?: string): string | undefined {
  if (!storageHintLabel || !/^Lokaler Stand (übernommen|uebernommen)/i.test(storageHintLabel)) {
    return undefined;
  }

  if (/älter als 30 Minuten/i.test(storageHintLabel)) {
    return "Übernommener lokaler Stand ist älter als 30 Minuten: vor der manuellen Übernahme bitte neu prüfen.";
  }

  return "Übernommener lokaler Stand: vor der manuellen Übernahme besser noch einmal frisch prüfen.";
}

function isStaleCarryover(storageHintLabel?: string): boolean {
  return Boolean(
    storageHintLabel &&
      /^Lokaler Stand (übernommen|uebernommen)/i.test(storageHintLabel) &&
      /älter als 30 Minuten/i.test(storageHintLabel)
  );
}

export function buildOfferMiniPilotActionState(
  reportState: MiniPilotCheckReportState,
  storageHintLabel?: string
): OfferMiniPilotActionState {
  if (reportState.statusLabel === "ready") {
    const staleCarryover = isStaleCarryover(storageHintLabel);

    return {
      eyebrow: "Mini-Pilot-Status vor Übernahme",
      title: staleCarryover
        ? "Vor der manuellen Übernahme Mini-Pilot-Check besser neu ausführen"
        : "Manuelle Übernahme ist jetzt fachlich prüfbar",
      statusLabel: staleCarryover ? "Status: ready, aber neu prüfen" : "Status: ready",
      reasonLabel: `Grund: ${reportState.reasonLabel}`,
      trustLabel: buildMiniPilotTrustLabel(storageHintLabel),
      provenanceLabel: storageHintLabel,
      cautionLabel: buildMiniPilotCarryoverCautionLabel(storageHintLabel),
      helperText: reportState.nextStepLabel,
      commandLabel: reportState.commandLabel
    };
  }

  return {
    eyebrow: "Mini-Pilot-Status vor Übernahme",
    title: "Übernahme erst nach grünem Mini-Pilot-Check",
    statusLabel: `Status: ${reportState.statusLabel}`,
    reasonLabel: `Grund: ${reportState.reasonLabel}`,
    trustLabel: buildMiniPilotTrustLabel(storageHintLabel),
    provenanceLabel: storageHintLabel,
    cautionLabel: buildMiniPilotCarryoverCautionLabel(storageHintLabel),
    helperText: reportState.nextStepLabel,
    commandLabel: reportState.commandLabel
  };
}
