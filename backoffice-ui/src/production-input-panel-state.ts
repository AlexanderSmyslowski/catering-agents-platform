import type { ProductionSourceInputValues } from "./production-input-panel.js";
import type { IntakeRequestDetail } from "./api.js";
import {
  formatDocumentIngestionStatusLabel,
  formatDocumentIngestionWarningLabel
} from "../../shared-core/src/conversation-projection.js";
import {
  buildProductionSpecDetailsState,
  type ProductionSpecDetailsMenuItemState
} from "./production-spec-details-state.js";

export type ProductionUploadResultSummaryState = {
  eventLabel: string;
  summaryLabel: string;
  snapshotItems: ProductionUploadSnapshotItemState[];
  menuItems: ProductionSpecDetailsMenuItemState[];
  openItems: string[];
  assumptionItems: string[];
  preflightItems: ProductionUploadPreflightItemState[];
  artifactStatusItems: string[];
  sourceCheckItems: string[];
  nextStepLabel: string;
};

export type ProductionUploadSnapshotItemState = {
  key: string;
  label: string;
  value: string;
  status: "checked" | "open" | "review";
};

export type ProductionUploadPreflightItemState = {
  key: string;
  label: string;
  detailLabel: string;
  status: "checked" | "open" | "review";
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

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readPositiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function formatNextStep(input: {
  openItemCount: number;
  menuItemCount: number;
  sourceCheckItemCount: number;
}): string {
  if (input.sourceCheckItemCount > 0 && input.openItemCount > 0) {
    return "Nächster Schritt: Quellenprüfung und Rückfragen klären, dann Berechnung starten.";
  }

  if (input.sourceCheckItemCount > 0) {
    return "Nächster Schritt: Quellenprüfung bestätigen, dann Berechnung starten.";
  }

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

function formatOpenItemCount(openItemCount: number): string {
  if (openItemCount === 0) {
    return "keine blockierenden Punkte";
  }

  if (openItemCount === 1) {
    return "1 offener Punkt";
  }

  return `${openItemCount} offene Punkte`;
}

function formatMenuItemCount(menuItemCount: number): string {
  if (menuItemCount === 0) {
    return "keine Gerichte erkannt";
  }

  if (menuItemCount === 1) {
    return "1 Komponente erkannt";
  }

  return `${menuItemCount} Komponenten erkannt`;
}

function buildSnapshotItems(input: {
  menuItemCount: number;
  openItemCount: number;
  sourceCheckItemCount: number;
}): ProductionUploadSnapshotItemState[] {
  return [
    {
      key: "menu",
      label: "Gerichte",
      value: formatMenuItemCount(input.menuItemCount),
      status: input.menuItemCount > 0 ? "checked" : "open"
    },
    {
      key: "open-items",
      label: "Offen",
      value: formatOpenItemCount(input.openItemCount),
      status: input.openItemCount > 0 ? "open" : "checked"
    },
    {
      key: "source",
      label: "Quelle",
      value: input.sourceCheckItemCount > 0 ? "Lesbarkeit prüfen" : "keine Warnung",
      status: input.sourceCheckItemCount > 0 ? "review" : "checked"
    },
    {
      key: "artifacts",
      label: "Artefakte",
      value: input.openItemCount > 0 ? "noch nicht berechnet" : "noch nicht erzeugt",
      status: input.openItemCount > 0 ? "open" : "review"
    }
  ];
}

function buildSourceCheckItems(intakeRequestDetail?: IntakeRequestDetail | null): string[] {
  const rawInputs = Array.isArray(intakeRequestDetail?.rawInputs) ? intakeRequestDetail.rawInputs : [];

  return rawInputs
    .map((input) => {
      const filename = input.sourceMetadata?.filename?.trim() || input.documentId?.trim() || "Quelle";
      const status = input.documentIngestion?.status?.trim();
      const warnings = Array.isArray(input.documentIngestion?.warnings)
        ? input.documentIngestion.warnings.map((warning) => warning.trim()).filter(Boolean)
        : [];

      if (!status && warnings.length === 0) {
        return undefined;
      }

      const statusLabel = status ? `Lesbarkeit: ${formatDocumentIngestionStatusLabel(status)}` : undefined;
      const warningLabel = warnings.length > 0
        ? `Hinweise: ${warnings.map(formatDocumentIngestionWarningLabel).join(", ")}`
        : undefined;

      return [`Quelle: ${filename}`, statusLabel, warningLabel].filter(Boolean).join(" · ");
    })
    .filter((item): item is string => Boolean(item));
}

function buildPreflightItems(input: {
  focusedProductionSpec?: Record<string, unknown>;
  menuItemCount: number;
  openItemCount: number;
  sourceCheckItemCount: number;
}): ProductionUploadPreflightItemState[] {
  const spec = input.focusedProductionSpec;
  const event = asRecord(spec?.event);
  const attendees = asRecord(spec?.attendees);
  const servicePlan = asRecord(spec?.servicePlan);
  const budgetContext = asRecord(spec?.budgetContext);
  const menuPlan = Array.isArray(spec?.menuPlan) ? spec.menuPlan : [];
  const attendeeCount = readPositiveNumber(attendees?.expected);
  const eventDate = readString(event?.date);
  const schedule = Array.isArray(event?.schedule) ? event.schedule : [];
  const serviceForm = readString(servicePlan?.serviceForm ?? event?.serviceForm);
  const missingProductionDecisions = menuPlan.filter((entry) => {
    const component = asRecord(entry);
    const productionDecision = asRecord(component?.productionDecision);
    return !readString(productionDecision?.mode);
  }).length;
  const missingPurchasedElements = menuPlan.filter((entry) => {
    const component = asRecord(entry);
    const productionDecision = asRecord(component?.productionDecision);
    const mode = readString(productionDecision?.mode);
    const purchasedElements = Array.isArray(productionDecision?.purchasedElements)
      ? productionDecision.purchasedElements.map(readString).filter(Boolean)
      : [];
    return (mode === "hybrid" || mode === "convenience_purchase") && purchasedElements.length === 0;
  }).length;
  const hasBudget =
    Boolean(asRecord(budgetContext?.targetBudget)) ||
    Boolean(asRecord(budgetContext?.pricingSummary));

  return [
    attendeeCount
      ? {
          key: "attendees",
          label: "Personenzahl",
          detailLabel: `${attendeeCount} Personen erkannt.`,
          status: "checked"
        }
      : {
          key: "attendees",
          label: "Personenzahl",
          detailLabel: "Offen: verbindliche Teilnehmerzahl fehlt.",
          status: "open"
        },
    eventDate || schedule.length > 0
      ? {
          key: "timing",
          label: "Datum und Zeitfenster",
          detailLabel: eventDate ? `Datum erkannt: ${eventDate}.` : "Zeitfenster im Ablauf erkannt.",
          status: "checked"
        }
      : {
          key: "timing",
          label: "Datum und Zeitfenster",
          detailLabel: "Offen: Datum oder verbindliches Zeitfenster fehlt.",
          status: "open"
        },
    serviceForm
      ? {
          key: "service-form",
          label: "Serviceform",
          detailLabel: "Serviceform erkannt.",
          status: "checked"
        }
      : {
          key: "service-form",
          label: "Serviceform",
          detailLabel: "Offen: Buffet, Empfang, Kaffeepause oder andere Serviceform fehlt.",
          status: "open"
        },
    input.menuItemCount > 0
      ? {
          key: "menu",
          label: "Gerichte und Komponenten",
          detailLabel: `${input.menuItemCount} Komponenten erkannt.`,
          status: "checked"
        }
      : {
          key: "menu",
          label: "Gerichte und Komponenten",
          detailLabel: "Offen: keine Gerichte erkannt.",
          status: "open"
        },
    missingProductionDecisions === 0 && missingPurchasedElements === 0 && menuPlan.length > 0
      ? {
          key: "production-decision",
          label: "Eigenproduktion und Zukauf",
          detailLabel: "Herstellungsentscheidungen sind erfasst.",
          status: "checked"
        }
      : {
          key: "production-decision",
          label: "Eigenproduktion und Zukauf",
          detailLabel:
            missingPurchasedElements > 0
              ? "Offen: Zukaufbestandteile für hybride oder Convenience-Komponenten fehlen."
              : "Offen: Herstellungsentscheidungen fehlen.",
          status: "open"
        },
    hasBudget
      ? {
          key: "budget",
          label: "Preisrahmen",
          detailLabel: "Budget- oder Kalkulationskontext erkannt.",
          status: "checked"
        }
      : {
          key: "budget",
          label: "Preisrahmen",
          detailLabel: "Prüfen: kein Preisrahmen für wirtschaftliche Plausibilität erkannt.",
          status: "review"
        },
    input.sourceCheckItemCount > 0
      ? {
          key: "source",
          label: "Quelle und Lesbarkeit",
          detailLabel: "Prüfen: Dokumentquelle hat Hinweise oder Warnungen.",
          status: "review"
        }
      : {
          key: "source",
          label: "Quelle und Lesbarkeit",
          detailLabel: "Keine Dokumentwarnung im aktuellen Intake-Detail.",
          status: "checked"
        },
    input.openItemCount > 0 || input.sourceCheckItemCount > 0
      ? {
          key: "calculation-release",
          label: "Berechnung starten",
          detailLabel: "Noch nicht freigegeben: offene Punkte zuerst klären.",
          status: "open"
        }
      : {
          key: "calculation-release",
          label: "Berechnung starten",
          detailLabel: "Prüfen: Berechnung bleibt eine bewusste Operator-Aktion.",
          status: "review"
        }
  ];
}

function buildUploadResultSummary(input: {
  documentPhase: ProductionSourceInputValues["documentPhase"];
  focusedProductionSpec?: Record<string, unknown>;
  productionQuestions: string[];
  productionAssumptions: string[];
  intakeRequestDetail?: IntakeRequestDetail | null;
}): ProductionUploadResultSummaryState | undefined {
  if (input.documentPhase !== "done") {
    return undefined;
  }

  const detailsState = buildProductionSpecDetailsState(input.focusedProductionSpec);
  const openItems = visibleTextList(input.productionQuestions);
  const assumptionItems = visibleTextList(input.productionAssumptions);
  const sourceCheckItems = buildSourceCheckItems(input.intakeRequestDetail);
  const menuItemCount = detailsState?.menuItems.length ?? 0;
  const preflightItems = buildPreflightItems({
    focusedProductionSpec: input.focusedProductionSpec,
    menuItemCount,
    openItemCount: openItems.length,
    sourceCheckItemCount: sourceCheckItems.length
  });

  return {
    eventLabel: detailsState?.eventLabel ?? "Noch keine Produktionsdaten erkannt",
    summaryLabel: detailsState
      ? formatUploadSummaryLabel(detailsState.summaryLabel)
      : "Quelle wurde verarbeitet; bitte Eckdaten, Gerichte und Rückfragen prüfen.",
    snapshotItems: buildSnapshotItems({
      menuItemCount,
      openItemCount: openItems.length,
      sourceCheckItemCount: sourceCheckItems.length
    }),
    menuItems: detailsState?.menuItems ?? [],
    openItems,
    assumptionItems,
    preflightItems,
    artifactStatusItems: buildArtifactStatusItems({
      openItemCount: openItems.length,
      menuItemCount
    }),
    sourceCheckItems,
    nextStepLabel: formatNextStep({
      openItemCount: openItems.length,
      menuItemCount,
      sourceCheckItemCount: sourceCheckItems.length
    })
  };
}

export function buildProductionInputPanelState(input: {
  submitting: boolean;
  sourceInput: ProductionSourceInputValues;
  focusedProductionSpec?: Record<string, unknown>;
  productionQuestions?: string[];
  productionAssumptions?: string[];
  intakeRequestDetail?: IntakeRequestDetail | null;
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
      productionAssumptions: input.productionAssumptions ?? [],
      intakeRequestDetail: input.intakeRequestDetail
    })
  };
}
