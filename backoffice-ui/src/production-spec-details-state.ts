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
  specIdLabel: string;
  eventLabel: string;
  summaryLabel: string;
  menuItems: ProductionSpecDetailsMenuItemState[];
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function buildProductionSpecDetailsState(
  spec?: Record<string, unknown>
): ProductionSpecDetailsState | undefined {
  if (!spec) {
    return undefined;
  }

  const event = asRecord(spec.event);
  const servicePlan = asRecord(spec.servicePlan);
  const attendees = asRecord(spec.attendees);
  const menuPlan = Array.isArray(spec.menuPlan) ? spec.menuPlan : [];

  return {
    specIdLabel: `specId: ${String(spec.specId ?? "-")}`,
    eventLabel: `Eventtyp: ${translateEventType(String(event?.type ?? servicePlan?.eventType ?? ""))} · ${formatProductionTimingWindow(spec)}`,
    summaryLabel: `Teilnehmerzahl: ${String(attendees?.expected ?? "-")} · Serviceform: ${translateServiceForm(
      String(servicePlan?.serviceForm ?? "")
    )} · Readiness: ${translateReadiness(String((spec.readiness as Record<string, unknown> | undefined)?.status ?? "-"))}`,
    menuItems: menuPlan.map((entry) => {
      const component = entry as Record<string, unknown>;
      return {
        key: String(component.componentId ?? component.label),
        label: String(component.label ?? component.componentId ?? "-"),
        detailLabel: `${translateMenuCategory(String(component.menuCategory ?? ""))} · ${translateProductionMode(
          String((component.productionDecision as Record<string, unknown> | undefined)?.mode ?? "")
        )}`
      };
    })
  };
}
