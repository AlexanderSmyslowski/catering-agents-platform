import type { ComponentEditState } from "./production-answer-types.js";

export type SpecEditUpdateFormState = {
  eventType: string;
  eventDate: string;
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
    serviceForm: state.serviceForm.trim() || undefined,
    attendeeCount: state.attendeeCount.trim() ? Number(state.attendeeCount) : undefined,
    menuItems: splitCommaList(state.menuItems),
    componentUpdates
  };
}
