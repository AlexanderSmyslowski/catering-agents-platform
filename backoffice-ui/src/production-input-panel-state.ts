import type { ProductionSourceInputValues } from "./production-input-panel.js";
import {
  buildProductionSpecDetailsState,
  type ProductionSpecDetailsMenuItemState
} from "./production-spec-details-state.js";

export type ProductionUploadResultSummaryState = {
  eventLabel: string;
  summaryLabel: string;
  menuItems: ProductionSpecDetailsMenuItemState[];
  openItems: string[];
  assumptionItems: string[];
  artifactStatusItems: string[];
  nextStepLabel: string;
};

export type ProductionInputPanelState = {
  clearWorkspaceDisabled: boolean;
  archiveCurrentIntakeDisabled: boolean;
  submitDocumentDisabled: boolean;
  selectedFileName?: string;
  showAnalysingProgress: boolean;
  showCompletedProgress: boolean;
  documentEtaLabel: string;
  uploadResultSummary?: ProductionUploadResultSummaryState;
};

function formatEta(seconds: number): string {
  if (seconds <= 1) {
    return "weniger als 1 Sekunde";
  }
  return `${seconds} Sekunden`;
}

function visibleTextList(items: string[]): string[] {
  return items.map((item) => item.trim()).filter(Boolean);
}

function formatNextStep(input: {
  openItemCount: number;
  menuItemCount: number;
}): string {
  if (input.openItemCount > 0) {
    return "Nächster Schritt: Rückfragen beantworten, dann Berechnung starten.";
  }

  if (input.menuItemCount > 0) {
    return "Nächster Schritt: Komponenten prüfen und Berechnung starten.";
  }

  return "Nächster Schritt: erkannte Eckdaten prüfen und fehlende Gerichte ergänzen.";
}

function formatUploadSummaryLabel(summaryLabel: string): string {
  return summaryLabel.replace(/\s+·\s+Readiness: .+$/, "");
}

function buildArtifactStatusItems(input: {
  openItemCount: number;
  menuItemCount: number;
}): string[] {
  const recognized = input.menuItemCount > 0
    ? "Erkannt: Eckdaten, Gerichte/Komponenten, Rückfragen und Annahmen."
    : "Erkannt: Eckdaten und Rückfragen; Gerichte fehlen noch.";

  const nextArtifactStep = input.openItemCount > 0
    ? "Noch nicht berechnet: Mengen, Rezeptkarten, Einkaufsliste und Produktionsmappe."
    : "Noch nicht erzeugt: Mengen, Rezeptkarten, Einkaufsliste und Produktionsmappe.";

  return [recognized, nextArtifactStep];
}

function buildUploadResultSummary(input: {
  documentPhase: ProductionSourceInputValues["documentPhase"];
  focusedProductionSpec?: Record<string, unknown>;
  productionQuestions: string[];
  productionAssumptions: string[];
}): ProductionUploadResultSummaryState | undefined {
  if (input.documentPhase !== "done") {
    return undefined;
  }

  const detailsState = buildProductionSpecDetailsState(input.focusedProductionSpec);
  if (!detailsState) {
    return undefined;
  }

  const openItems = visibleTextList(input.productionQuestions);
  const assumptionItems = visibleTextList(input.productionAssumptions);

  return {
    eventLabel: detailsState.eventLabel,
    summaryLabel: formatUploadSummaryLabel(detailsState.summaryLabel),
    menuItems: detailsState.menuItems,
    openItems,
    assumptionItems,
    artifactStatusItems: buildArtifactStatusItems({
      openItemCount: openItems.length,
      menuItemCount: detailsState.menuItems.length
    }),
    nextStepLabel: formatNextStep({
      openItemCount: openItems.length,
      menuItemCount: detailsState.menuItems.length
    })
  };
}

export function buildProductionInputPanelState(input: {
  submitting: boolean;
  sourceInput: ProductionSourceInputValues;
  focusedProductionSpec?: Record<string, unknown>;
  productionQuestions?: string[];
  productionAssumptions?: string[];
}): ProductionInputPanelState {
  return {
    clearWorkspaceDisabled: input.submitting || !input.sourceInput.canClearWorkspace,
    archiveCurrentIntakeDisabled: input.submitting || !input.sourceInput.canArchiveCurrentIntake,
    submitDocumentDisabled: input.submitting || !input.sourceInput.intakeFile,
    selectedFileName: input.sourceInput.intakeFile?.name,
    showAnalysingProgress:
      input.sourceInput.documentPhase === "analysing" && Boolean(input.sourceInput.activeDocumentName),
    showCompletedProgress:
      input.sourceInput.documentPhase === "done" && Boolean(input.sourceInput.activeDocumentName),
    documentEtaLabel: formatEta(input.sourceInput.documentEtaSeconds ?? 1),
    uploadResultSummary: buildUploadResultSummary({
      documentPhase: input.sourceInput.documentPhase,
      focusedProductionSpec: input.focusedProductionSpec,
      productionQuestions: input.productionQuestions ?? [],
      productionAssumptions: input.productionAssumptions ?? []
    })
  };
}
