import type { ProductionWorkbenchNextStep } from "./production-workbench.js";
import {
  translateEventType,
  translateMenuCategory,
  translateProductionMode,
  translateServiceForm
} from "./production-language.js";

export type ProductionUploadResultFact = {
  label: string;
  value: string;
};

export type ProductionUploadResultSummary = {
  statusLabel: string;
  helperLabel: string;
  facts: ProductionUploadResultFact[];
  menuItems: string[];
  openItems: string[];
  nextStepLabel: string;
};

type ProductionUploadResultSummaryInput = {
  documentPhase: "idle" | "analysing" | "done";
  productionWorkspaceCleared: boolean;
  focusedProductionSpec?: Record<string, unknown>;
  productionQuestions: string[];
  productionAssumptions: string[];
  currentSpecPlans: Array<Record<string, unknown>>;
  currentSpecPurchaseLists: Array<Record<string, unknown>>;
  productionNextStep: ProductionWorkbenchNextStep;
};

function asRecord(input: unknown): Record<string, unknown> | undefined {
  return input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : undefined;
}

function asNonEmptyString(input: unknown): string | undefined {
  return typeof input === "string" && input.trim().length > 0 ? input.trim() : undefined;
}

function formatCount(count: number, singular: string, plural: string): string {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

function readName(record: Record<string, unknown> | undefined): string | undefined {
  return asNonEmptyString(record?.name) ?? asNonEmptyString(record?.label);
}

function buildFacts(spec: Record<string, unknown>): ProductionUploadResultFact[] {
  const event = asRecord(spec.event);
  const servicePlan = asRecord(spec.servicePlan);
  const attendees = asRecord(spec.attendees);
  const customer = asRecord(spec.customer);
  const venue = asRecord(spec.venue);
  const attendeeCount = typeof attendees?.expected === "number" ? attendees.expected : undefined;
  const facts: ProductionUploadResultFact[] = [
    {
      label: "Anlass",
      value: translateEventType(asNonEmptyString(event?.type) ?? asNonEmptyString(servicePlan?.eventType))
    },
    {
      label: "Personen",
      value: attendeeCount ? formatCount(attendeeCount, "Teilnehmer", "Teilnehmer") : "offen"
    },
    {
      label: "Datum",
      value: asNonEmptyString(event?.date) ?? "offen"
    },
    {
      label: "Serviceform",
      value: translateServiceForm(asNonEmptyString(servicePlan?.serviceForm))
    }
  ];
  const customerName = readName(customer);
  const venueName = readName(venue);

  if (customerName) {
    facts.push({ label: "Kunde", value: customerName });
  }
  if (venueName) {
    facts.push({ label: "Ort", value: venueName });
  }

  return facts;
}

function buildMenuItems(spec: Record<string, unknown>): string[] {
  const menuPlan = Array.isArray(spec.menuPlan) ? spec.menuPlan : [];

  return menuPlan.slice(0, 8).map((entry, index) => {
    const component = asRecord(entry) ?? {};
    const label = asNonEmptyString(component.label) ?? asNonEmptyString(component.componentId) ?? `Komponente ${index + 1}`;
    const category = translateMenuCategory(asNonEmptyString(component.menuCategory));
    const productionDecision = asRecord(component.productionDecision);
    const mode = translateProductionMode(asNonEmptyString(productionDecision?.mode));

    return `${label} · ${category} · ${mode}`;
  });
}

function buildOpenItems(input: ProductionUploadResultSummaryInput): string[] {
  const openItems: string[] = [];

  if (input.productionQuestions.length > 0) {
    openItems.push(formatCount(input.productionQuestions.length, "Rückfrage offen", "Rückfragen offen"));
  } else {
    openItems.push("Keine offenen Rückfragen im aktuellen Stand.");
  }
  if (input.productionAssumptions.length > 0) {
    openItems.push(formatCount(input.productionAssumptions.length, "Annahme prüfen", "Annahmen prüfen"));
  }
  if (input.currentSpecPlans.length === 0) {
    openItems.push("Produktionsplan noch nicht berechnet.");
  }
  if (input.currentSpecPurchaseLists.length === 0) {
    openItems.push("Einkaufsliste entsteht erst nach der Berechnung.");
  }

  return openItems;
}

export function buildProductionUploadResultSummary(
  input: ProductionUploadResultSummaryInput
): ProductionUploadResultSummary | undefined {
  if (input.documentPhase !== "done" || input.productionWorkspaceCleared || !input.focusedProductionSpec) {
    return undefined;
  }

  return {
    statusLabel: "Anfrage erfasst. Produktionsdaten prüfen.",
    helperLabel:
      "Das ist noch keine Produktionsfreigabe: Rückfragen, Zukauf, Eigenproduktion, Mengen und Einkauf bleiben vor der Berechnung zu prüfen.",
    facts: buildFacts(input.focusedProductionSpec),
    menuItems: buildMenuItems(input.focusedProductionSpec),
    openItems: buildOpenItems(input),
    nextStepLabel: `${input.productionNextStep.title}: ${input.productionNextStep.description}`
  };
}
