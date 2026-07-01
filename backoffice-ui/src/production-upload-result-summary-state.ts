import {
  translateEventType,
  translateMenuCategory,
  translateServiceForm
} from "./production-language.js";
import {
  formatProductionTimingWindow,
  translateReadiness
} from "./production-route-status.js";

export type ProductionUploadResultMenuItemState = {
  key: string;
  label: string;
  detailLabel: string;
};

export type ProductionUploadResultSummaryState = {
  eventLabel: string;
  statusLabel: string;
  menuItems: ProductionUploadResultMenuItemState[];
  questionLabels: string[];
  assumptionLabels: string[];
  artifactStatusLabels: string[];
  nextStepLabel: string;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readStringOrNumber(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
}

function readMessage(record: Record<string, unknown>, fallback: string): string {
  return readStringOrNumber(record, "suggestedQuestion") ?? readStringOrNumber(record, "message") ?? fallback;
}

export function buildProductionUploadResultSummaryState(
  spec?: Record<string, unknown>
): ProductionUploadResultSummaryState | undefined {
  if (!spec) {
    return undefined;
  }

  const event = asRecord(spec.event);
  const attendees = asRecord(spec.attendees);
  const servicePlan = asRecord(spec.servicePlan);
  const readiness = asRecord(spec.readiness);
  const menuPlan = Array.isArray(spec.menuPlan) ? spec.menuPlan : [];
  const uncertainties = Array.isArray(spec.uncertainties) ? spec.uncertainties : [];
  const assumptions = Array.isArray(spec.assumptions) ? spec.assumptions : [];
  const attendeeLabel = readStringOrNumber(attendees, "expected") ?? "?";
  const serviceForm = readStringOrNumber(servicePlan, "serviceForm") ?? readStringOrNumber(event, "serviceForm") ?? "";
  const eventType = readStringOrNumber(event, "type") ?? readStringOrNumber(servicePlan, "eventType") ?? "";
  const menuComponentCount = menuPlan.length;

  const questionLabels = uncertainties.map((item, index) =>
    readMessage(asRecord(item) ?? {}, `Offene Rückfrage ${index + 1}`)
  );
  const assumptionLabels = assumptions.map((item, index) =>
    readMessage(asRecord(item) ?? {}, `Annahme ${index + 1}`)
  );

  return {
    eventLabel: `${translateEventType(eventType)} · ${formatProductionTimingWindow(spec)} · ${attendeeLabel} Personen · ${translateServiceForm(serviceForm)}`,
    statusLabel: `Readiness: ${translateReadiness(readStringOrNumber(readiness, "status") ?? "-")}`,
    menuItems: menuPlan.map((item) => {
      const component = asRecord(item) ?? {};
      return {
        key: readStringOrNumber(component, "componentId") ?? readStringOrNumber(component, "label") ?? "menu-item",
        label: readStringOrNumber(component, "label") ?? readStringOrNumber(component, "componentId") ?? "offene Komponente",
        detailLabel: translateMenuCategory(readStringOrNumber(component, "menuCategory") ?? "")
      };
    }),
    questionLabels,
    assumptionLabels,
    artifactStatusLabels: [
      menuComponentCount === 1
        ? "1 Speisenkomponente erkannt"
        : menuComponentCount > 1
          ? `${menuComponentCount} Speisenkomponenten erkannt`
          : "Noch keine Speisenkomponenten erkannt",
      "Mengenkalkulation: wartet auf Berechnung",
      "Rezeptkarten: warten auf Rezeptzuordnung",
      "Einkaufsliste: wartet auf Berechnung"
    ],
    nextStepLabel:
      questionLabels.length > 0
        ? "Nächster Schritt: Rückfragen beantworten, dann Berechnung starten."
        : "Nächster Schritt: Produktionsplan berechnen."
  };
}
