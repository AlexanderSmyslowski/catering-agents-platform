import { validPurchasedQuantities, type PurchasedQuantity } from "../../shared-core/src/purchased-quantities.js";
import { formatEventSchedule } from "./production-spec-edit-snapshot.js";
import type { ComponentEditState } from "./production-answer-types.js";

export type SpecEditUpdateFormState = {
  eventType: string;
  eventDate: string;
  eventSchedule?: string;
  originalEventSchedule?: SpecEditUpdateInput["eventSchedule"];
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
  purchasedQuantities?: PurchasedQuantity[];
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

function parseEventSchedule(value: string, original?: SpecEditUpdateInput["eventSchedule"]): SpecEditUpdateInput["eventSchedule"] {
  const trimmed = value.trim();
  // A display string cannot encode every source schedule. Keep the source structure
  // while its visible value is unchanged, including labels and multiple periods.
  if (original && trimmed === formatEventSchedule(original).trim()) {
    return original.length ? original.map(item => ({ ...item })) : undefined;
  }
  if (!trimmed && !original?.length) return undefined;
  const match = trimmed.match(/^(?:(.+?)\s+)?([01]\d|2[0-3]):([0-5]\d)\s*[-–]\s*([01]\d|2[0-3]):([0-5]\d)$/);
  const label = match?.[1]?.trim() || "Service";
  if (!match || /[,;:\n]|\d\s*[-–]/.test(label)) {
    throw new Error("Zeitfenster bitte als eindeutigen Abschnitt eingeben, z. B. Service 09:00-12:00. Mehrere oder unklare Abschnitte können hier nicht geändert werden.");
  }
  const start = `${match[2]}:${match[3]}`;
  const end = `${match[4]}:${match[5]}`;
  if (start >= end) throw new Error("Zeitfenster: Das Ende muss am selben Tag nach dem Beginn liegen.");
  return [{ label, start, end }];
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
    ([componentId, componentState]) => {
      const originalElements = componentState.originalPurchasedElements ?? componentState.purchasedQuantities?.map(item => item.element);
      // Commas inside an existing structured element are names, not separators.
      const purchasedElements = originalElements?.join(", ") === componentState.purchasedElements
        ? originalElements : splitCommaList(componentState.purchasedElements);
      const purchasedQuantities = componentState.purchasedQuantities?.map(item => ({
        element: item.element, amountPerPerson: Number(item.amountPerPerson), unit: item.unit
      }));
      if (purchasedQuantities !== undefined && !validPurchasedQuantities({ purchasedElements, purchasedQuantities })) {
        throw new Error("Zukaufmengen benötigen je Bestandteil eine positive endliche Menge pro Person und eine Einheit.");
      }
      return {
        componentId,
        menuCategory: parseMenuCategory(componentState.menuCategory),
        productionMode: parseProductionMode(componentState.productionMode),
        purchasedElements,
        ...(purchasedQuantities !== undefined ? { purchasedQuantities } : {}),
        recipeOverrideId: componentState.recipeOverrideId.trim() || "",
        notes: componentState.notes.trim() || undefined
      };
    }
  );

  return {
    eventType: state.eventType.trim() || undefined,
    eventDate: state.eventDate.trim() || undefined,
    eventSchedule: parseEventSchedule(state.eventSchedule ?? "", state.originalEventSchedule),
    serviceForm: state.serviceForm.trim() || undefined,
    attendeeCount: state.attendeeCount.trim() ? Number(state.attendeeCount) : undefined,
    menuItems: splitCommaList(state.menuItems),
    componentUpdates
  };
}
