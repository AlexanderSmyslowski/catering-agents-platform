import {
  translateEventType,
  translateServiceForm
} from "./production-language.js";
import type {
  ProductionQuestionPanelState
} from "./production-question-panel.js";
import type { ProductionSourceInputValues } from "./production-input-panel.js";
import {
  formatOperatorPlanStatus,
  formatOperatorReadiness,
  type ProductionWorkbenchNextStep,
  type ProductionWorkbenchSummary
} from "./production-workbench.js";

export type ProductionAnalysisResult = {
  title: string;
  statusLine: string;
  planLine: string;
  menuItems: string[];
  questionPreviewItems: string[];
  questionPreviewOverflowCount: number;
  artifactItems: Array<{
    label: string;
    value: string;
    status: "ok" | "open";
  }>;
  checklistItems: Array<{
    label: string;
    value: string;
    status: "ok" | "open";
  }>;
  nextStepTitle: string;
};

function countOpenVisibleQuestions(summary: ProductionWorkbenchSummary): number {
  if (summary.questionCount > 0) {
    return Math.max(0, summary.questionCount - summary.answeredQuestionCount);
  }
  return Math.max(0, summary.unansweredQuestionCount);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readStringOrNumber(record: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "string" || typeof value === "number") {
      return String(value).trim();
    }
  }
  return undefined;
}

function hasValue(value: string | undefined): boolean {
  return Boolean(value && value !== "-");
}

function formatChecklistValue(value: string | undefined, fallback = "offen"): string {
  return hasValue(value) && value ? value : fallback;
}

function buildMenuItemLabels(spec?: Record<string, unknown>): string[] {
  const menuPlan = Array.isArray(spec?.menuPlan) ? spec.menuPlan : [];
  return menuPlan
    .map((entry) => {
      const component = asRecord(entry);
      return String(component?.label ?? component?.componentId ?? "").trim();
    })
    .filter(Boolean)
    .slice(0, 6);
}

function buildQuestionPreviewItems(questions: string[]): string[] {
  return questions
    .map((question) => question.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function hasConvenienceDecision(spec?: Record<string, unknown>): boolean {
  const menuPlan = Array.isArray(spec?.menuPlan) ? spec.menuPlan : [];
  return menuPlan.length > 0 && menuPlan.every((entry) => {
    const component = asRecord(entry);
    const productionDecision = asRecord(component?.productionDecision);
    const purchasedElements = Array.isArray(component?.purchasedElements) ? component.purchasedElements : [];
    return hasValue(readStringOrNumber(productionDecision, ["mode"])) || purchasedElements.length > 0;
  });
}

function hasCompletePlan(summary: ProductionWorkbenchSummary): boolean {
  return (
    summary.productionObjectCount > 0 &&
    !["offen", "wird geladen", "unzureichend"].includes(summary.planStatusLabel)
  );
}

function countRecordArray(record: Record<string, unknown> | undefined, key: string): number {
  const value = record?.[key];
  return Array.isArray(value) ? value.length : 0;
}

function formatCount(count: number, singular: string, plural: string): string {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

export function buildDocumentAnalysisResult(
  sourceInput: ProductionSourceInputValues,
  summary: ProductionWorkbenchSummary,
  nextStep: ProductionWorkbenchNextStep,
  questionState: ProductionQuestionPanelState
): ProductionAnalysisResult | undefined {
  if (sourceInput.documentPhase !== "done") {
    return undefined;
  }

  const spec = questionState.focusedProductionSpec;
  const event = asRecord(spec?.event);
  const attendees = asRecord(spec?.attendees);
  const servicePlan = asRecord(spec?.servicePlan);
  const menuItems = buildMenuItemLabels(spec);
  const eventType = readStringOrNumber(event, ["type"]) ?? readStringOrNumber(servicePlan, ["eventType"]);
  const serviceForm = readStringOrNumber(servicePlan, ["serviceForm"]) ?? readStringOrNumber(event, ["serviceForm"]);
  const eventDate = readStringOrNumber(event, ["date"]);
  const attendeeCount = readStringOrNumber(attendees, ["expected"]);
  const hasBudgetContext = Boolean(asRecord(spec?.budgetContext));
  const hasConvenience = hasConvenienceDecision(spec);
  const openQuestionCount = countOpenVisibleQuestions(summary);
  const visibleQuestions = questionState.productionQuestions.filter((question) => question.trim().length > 0);
  const questionPreviewItems = buildQuestionPreviewItems(questionState.productionQuestions);
  const questionPreviewOverflowCount = Math.max(0, visibleQuestions.length - questionPreviewItems.length);
  const selectedPlan = asRecord(questionState.selectedPlan);
  const hasPlan = hasCompletePlan(summary);
  const productionBatchCount = countRecordArray(selectedPlan, "productionBatches");
  const kitchenSheetCount = countRecordArray(selectedPlan, "kitchenSheets");
  const timelineCount = countRecordArray(selectedPlan, "timeline");

  return {
    title: summary.activeSpecLabel,
    statusLine: [
      `Status: ${formatOperatorReadiness(summary.readinessLabel)}`,
      `Rückfragen: offen ${openQuestionCount}`,
      `beantwortet ${summary.answeredQuestionCount}`
    ].join(" · "),
    planLine: `Plan: ${formatOperatorPlanStatus(summary.planStatusLabel)} · Einkaufsliste: ${summary.purchaseStatusLabel}`,
    menuItems,
    questionPreviewItems,
    questionPreviewOverflowCount,
    artifactItems: [
      {
        label: "Kalkulationsübersicht",
        value: hasBudgetContext ? "Preisrahmen vorhanden" : "Preisrahmen offen",
        status: hasBudgetContext ? "ok" : "open"
      },
      {
        label: "Mengenkalkulation je Gericht",
        value: productionBatchCount > 0
          ? formatCount(productionBatchCount, "Mengenposition", "Mengenpositionen")
          : hasPlan
            ? "im Plan prüfen"
            : "entsteht mit Berechnung",
        status: productionBatchCount > 0 ? "ok" : "open"
      },
      {
        label: "Rezeptkarten / Produktionsschritte",
        value: kitchenSheetCount > 0
          ? formatCount(kitchenSheetCount, "Küchenkarte", "Küchenkarten")
          : "noch nicht verknüpft",
        status: kitchenSheetCount > 0 ? "ok" : "open"
      },
      {
        label: "Einkaufsliste nach Metro-Logik",
        value: summary.purchaseListCount > 0 ? summary.purchaseStatusLabel : "noch nicht erstellt",
        status: summary.purchaseListCount > 0 ? "ok" : "open"
      },
      {
        label: "Mise-en-Place / Abschlussprüfung",
        value: timelineCount > 0
          ? formatCount(timelineCount, "Zeitpunkt", "Zeitpunkte")
          : hasPlan
            ? "im Plan prüfen"
            : "entsteht mit Berechnung",
        status: timelineCount > 0 ? "ok" : "open"
      }
    ],
    checklistItems: [
      {
        label: "Anlass",
        value: formatChecklistValue(eventType ? translateEventType(eventType) : undefined),
        status: hasValue(eventType) ? "ok" : "open"
      },
      {
        label: "Datum",
        value: formatChecklistValue(eventDate),
        status: hasValue(eventDate) ? "ok" : "open"
      },
      {
        label: "Personenzahl",
        value: hasValue(attendeeCount) ? `${attendeeCount} Personen` : "offen",
        status: hasValue(attendeeCount) ? "ok" : "open"
      },
      {
        label: "Serviceform",
        value: formatChecklistValue(serviceForm ? translateServiceForm(serviceForm) : undefined),
        status: hasValue(serviceForm) ? "ok" : "open"
      },
      {
        label: "Gerichte",
        value: menuItems.length > 0 ? `${menuItems.length} Komponenten` : "offen",
        status: menuItems.length > 0 ? "ok" : "open"
      },
      {
        label: "Preisrahmen",
        value: hasBudgetContext ? "vorhanden" : "offen",
        status: hasBudgetContext ? "ok" : "open"
      },
      {
        label: "Zukauf/Convenience",
        value: hasConvenience ? "geklärt" : "offen",
        status: hasConvenience ? "ok" : "open"
      }
    ],
    nextStepTitle: nextStep.title
  };
}
