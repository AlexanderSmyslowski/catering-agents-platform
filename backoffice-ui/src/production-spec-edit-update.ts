import type { ComponentEditState } from "./production-answer-types.js";

export type SpecEditUpdateFormState = {
  eventType: string;
  eventDate: string;
  eventSchedule?: string;
  attendeeCount: string;
  serviceForm: string;
  menuItems: string;
  componentStates: Record<string, ComponentEditState>;
};

export type SpecEditComponentUpdate = {
  componentId: string;
  menuCategory?: "classic" | "vegetarian" | "vegan";
  productionMode?: "scratch" | "hybrid" | "convenience_purchase" | "external_finished";
  purchasedElements?: string[];
  recipeOverrideId?: string;
  notes?: string;
};

export type SpecEditUpdateInput = {
  eventDate?: string;
  eventSchedule?: Array<{ label: string; start?: string; end?: string }>;
  attendeeCount?: number;
  serviceForm?: string;
  eventType?: string;
  menuItems?: string[];
  componentUpdates?: SpecEditComponentUpdate[];
};

function splitCommaList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeTimeToken(value: string): string | undefined {
  const match = value.trim().match(/^([01]?\d|2[0-3])(?::|\.|h)?(\d{2})?$/i);
  if (!match) {
    return undefined;
  }

  const hour = match[1].padStart(2, "0");
  const minute = match[2] ?? "00";
  return `${hour}:${minute}`;
}

function parseEventSchedule(value: string): SpecEditUpdateInput["eventSchedule"] {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const tokens = Array.from(trimmed.matchAll(/\b([01]?\d|2[0-3])(?::|\.|h)?(\d{2})?\b/gi))
    .map((match) => normalizeTimeToken(match[0]))
    .filter((item): item is string => Boolean(item));
  const [start, end] = tokens;

  return [
    {
      label: trimmed,
      ...(start ? { start } : {}),
      ...(end ? { end } : {})
    }
  ];
}

function parseMenuCategory(value: string): SpecEditComponentUpdate["menuCategory"] {
  return value === "classic" || value === "vegetarian" || value === "vegan" ? value : undefined;
}

function parseProductionMode(value: string): SpecEditComponentUpdate["productionMode"] {
  return value === "scratch" ||
    value === "hybrid" ||
    value === "convenience_purchase" ||
    value === "external_finished"
    ? value
    : undefined;
}

export function buildSpecEditUpdateInput(state: SpecEditUpdateFormState): SpecEditUpdateInput {
  const componentUpdates: SpecEditUpdateInput["componentUpdates"] = Object.entries(state.componentStates).map(
    ([componentId, componentState]) => ({
      componentId,
      menuCategory: parseMenuCategory(componentState.menuCategory),
      productionMode: parseProductionMode(componentState.productionMode),
      purchasedElements: splitCommaList(componentState.purchasedElements),
      recipeOverrideId: componentState.recipeOverrideId.trim() || "",
      notes: componentState.notes.trim() || undefined
    })
  );

  return {
    eventType: state.eventType.trim() || undefined,
    eventDate: state.eventDate.trim() || undefined,
    eventSchedule: parseEventSchedule(state.eventSchedule ?? ""),
    serviceForm: state.serviceForm.trim() || undefined,
    attendeeCount: state.attendeeCount.trim() ? Number(state.attendeeCount) : undefined,
    menuItems: splitCommaList(state.menuItems),
    componentUpdates
  };
}
