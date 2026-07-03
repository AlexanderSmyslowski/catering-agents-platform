import {
  formatProductionTimingWindow,
  translateReadiness
} from "./production-route-state.js";
import {
  translateMenuCategory,
  translateEventType,
  translateProductionMode,
  translateServiceForm
} from "./production-language.js";

export type ProductionSpecDetailsMenuItemState = {
  key: string;
  label: string;
  detailLabel: string;
};

export type ProductionSpecDetailsState = {
  contextLabel: string;
  eventLabel: string;
  summaryLabel: string;
  menuItems: ProductionSpecDetailsMenuItemState[];
};

export type ProductionSpecDetailsStateOptions = {
  readinessLabel?: string;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function formatComponentDetailLabel(component: Record<string, unknown>): string {
  const categoryValue = String(component.menuCategory ?? "").trim();
  const productionDecision = asRecord(component.productionDecision);
  const modeValue = String(productionDecision?.mode ?? "").trim();
  const categoryLabel = categoryValue ? translateMenuCategory(categoryValue) : "Kategorie offen";
  const modeLabel = modeValue ? translateProductionMode(modeValue) : "Herstellungsart offen";

  return `${categoryLabel} · ${modeLabel}`;
}

export function buildProductionSpecDetailsState(
  spec?: Record<string, unknown>,
  options: ProductionSpecDetailsStateOptions = {}
): ProductionSpecDetailsState | undefined {
  if (!spec) {
    return undefined;
  }

  const event = asRecord(spec.event);
  const servicePlan = asRecord(spec.servicePlan);
  const attendees = asRecord(spec.attendees);
  const menuPlan = Array.isArray(spec.menuPlan) ? spec.menuPlan : [];
  const readinessLabel =
    options.readinessLabel?.trim()
    || translateReadiness(String((spec.readiness as Record<string, unknown> | undefined)?.status ?? "-"));

  return {
    contextLabel: "Spezifikation im Fokus",
    eventLabel: `Eventtyp: ${translateEventType(String(event?.type ?? servicePlan?.eventType ?? ""))} · ${formatProductionTimingWindow(spec)}`,
    summaryLabel: `Teilnehmerzahl: ${String(attendees?.expected ?? "-")} · Serviceform: ${translateServiceForm(
      String(servicePlan?.serviceForm ?? "")
    )} · Readiness: ${readinessLabel}`,
    menuItems: menuPlan.map((entry) => {
      const component = entry as Record<string, unknown>;
      return {
        key: String(component.componentId ?? component.label),
        label: String(component.label ?? component.componentId ?? "-"),
        detailLabel: formatComponentDetailLabel(component)
      };
    })
  };
}
