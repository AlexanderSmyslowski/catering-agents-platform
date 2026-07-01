import type { ComponentEditState } from "./production-answer-types.js";

export type SpecEditSnapshot = {
  eventType: string;
  eventDate: string;
  eventSchedule: string;
  attendeeCount: string;
  serviceForm: string;
  menuItems: string;
  components: Array<[string, ComponentEditState]>;
};

export function componentEditStateFromMenuItem(item: Record<string, unknown>): ComponentEditState {
  const productionDecision =
    item.productionDecision && typeof item.productionDecision === "object"
      ? (item.productionDecision as Record<string, unknown>)
      : undefined;

  return {
    menuCategory: String(item.menuCategory ?? ""),
    productionMode: String(productionDecision?.mode ?? ""),
    purchasedElements: Array.isArray(productionDecision?.purchasedElements)
      ? productionDecision.purchasedElements.map((entry) => String(entry)).join(", ")
      : "",
    recipeOverrideId: String(item.recipeOverrideId ?? ""),
    notes: String(productionDecision?.notes ?? "")
  };
}

export function specEditSnapshotFromSpec(spec: Record<string, unknown>): SpecEditSnapshot {
  const event = spec.event as Record<string, unknown> | undefined;
  const attendees = spec.attendees as Record<string, unknown> | undefined;
  const menuPlan = Array.isArray(spec.menuPlan) ? (spec.menuPlan as Array<Record<string, unknown>>) : [];
  const schedule = Array.isArray(event?.schedule) ? (event.schedule as Array<Record<string, unknown>>) : [];

  return {
    eventType: String(event?.type ?? ""),
    eventDate: String(event?.date ?? ""),
    eventSchedule: schedule
      .map((slot) => [slot.label, slot.start, slot.end].map((value) => String(value ?? "").trim()).filter(Boolean).join(" "))
      .filter(Boolean)
      .join(", "),
    attendeeCount: String(attendees?.expected ?? ""),
    serviceForm: String(event?.serviceForm ?? ""),
    menuItems: menuPlan.map((item) => String(item.label ?? "")).filter(Boolean).join(", "),
    components: menuPlan.map((item) => [String(item.componentId), componentEditStateFromMenuItem(item)])
  };
}

export function normalizedSpecEditSnapshot(snapshot: SpecEditSnapshot): string {
  return JSON.stringify({
    ...snapshot,
    eventType: snapshot.eventType.trim(),
    eventDate: snapshot.eventDate.trim(),
    eventSchedule: snapshot.eventSchedule.trim(),
    attendeeCount: snapshot.attendeeCount.trim(),
    serviceForm: snapshot.serviceForm.trim(),
    menuItems: snapshot.menuItems.trim(),
    components: snapshot.components
      .map(([componentId, state]) => [
        componentId,
        {
          menuCategory: state.menuCategory.trim(),
          productionMode: state.productionMode.trim(),
          purchasedElements: state.purchasedElements.trim(),
          recipeOverrideId: state.recipeOverrideId.trim(),
          notes: state.notes.trim()
        }
      ])
      .sort(([leftId], [rightId]) => String(leftId).localeCompare(String(rightId)))
  });
}
