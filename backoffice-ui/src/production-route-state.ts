export type ProductionRouteFocusSpec = Record<string, unknown>;
export {
  canArchiveCurrentIntake,
  canClearProductionWorkspace,
  formatActiveProductionContextLabel,
  formatProductionContextId,
  formatProductionTechnicalContextLabel,
  selectProductionNextStep
} from "./production-route-context-state.js";
export type { ProductionNextStep } from "./production-route-context-state.js";
export {
  buildWorkbenchSpecFacts,
  countClarificationAnswerStatuses,
  formatProductionObjectStatusLabel,
  formatProductionPlanStatusLabel,
  formatProductionReadinessLabel,
  formatProductionTimingWindow,
  formatStructuredProductionAnswerSummary,
  translateReadiness
} from "./production-route-status.js";
export type { ClarificationAnswerStatusCounts, WorkbenchSpecFact } from "./production-route-status.js";
export {
  countPurchaseListItems,
  formatProductionHandoffContextLabel,
  formatProductionHandoffExportLabel,
  formatProductionIntakeOriginLabel,
  formatPurchaseZoneStatusLabel
} from "./production-route-artifact-status-state.js";

export function selectProductionIntakeRequestId(spec: Record<string, unknown> | undefined): string | undefined {
  const requestId = spec?.requestId;
  if (typeof requestId === "string" && requestId.trim()) {
    return requestId.trim();
  }

  const sourceLineage = Array.isArray(spec?.sourceLineage) ? spec?.sourceLineage : [];
  const intakeSource = sourceLineage.find((lineage) => {
    const sourceType = String((lineage as Record<string, unknown>)?.sourceType ?? "");
    return sourceType === "manual_input" || sourceType === "pdf" || sourceType === "email";
  }) as Record<string, unknown> | undefined;
  const reference = intakeSource?.reference;
  return typeof reference === "string" && reference.trim() ? reference.trim() : undefined;
}

export function selectProductionArtifactSpecIds(items: Array<Record<string, unknown>>): string[] {
  return Array.from(
    new Set(
      items
        .map((item) => String(item.eventSpecId ?? "").trim())
        .filter(Boolean)
    )
  );
}

export function lookupProductionSpecById<T extends Record<string, unknown>>(
  specsById: Map<string, T>,
  specId: unknown
): T | undefined {
  const normalizedSpecId = String(specId ?? "").trim();
  return normalizedSpecId ? specsById.get(normalizedSpecId) : undefined;
}

export function selectProductionPlanById<T extends Record<string, unknown>>(input: {
  plans: T[];
  selectedPlanId?: string;
}): T | undefined {
  const selectedPlanId = input.selectedPlanId?.trim();
  if (!selectedPlanId) {
    return undefined;
  }

  return input.plans.find((plan) => String(plan.planId ?? "").trim() === selectedPlanId);
}

export function selectFocusedProductionSpec(input: {
  acceptedSpecs: ProductionRouteFocusSpec[];
  filteredSpecs: ProductionRouteFocusSpec[];
  focusedProductionSpecId?: string;
  productionArtifactSpecIds?: string[];
  productionWorkspaceCleared: boolean;
  route: string;
  searchText: string;
}): ProductionRouteFocusSpec | undefined {
  if (input.productionWorkspaceCleared) {
    return undefined;
  }

  const preferred = input.focusedProductionSpecId
    ? input.filteredSpecs.find((spec) => String(spec.specId) === input.focusedProductionSpecId)
    : undefined;

  if (input.route === "production") {
    return preferred;
  }

  return preferred ?? input.filteredSpecs[input.filteredSpecs.length - 1] ?? input.acceptedSpecs[input.acceptedSpecs.length - 1];
}

export function selectCurrentProductionItems<T extends Record<string, unknown>>(input: {
  currentProductionSpecId: string;
  items: T[];
  productionWorkspaceCleared: boolean;
}): T[] {
  if (input.productionWorkspaceCleared) {
    return [];
  }

  if (!input.currentProductionSpecId) {
    return input.items;
  }

  return input.items.filter((item) => String(item.eventSpecId ?? "").trim() === input.currentProductionSpecId);
}

export function selectArchivedProductionItems<T extends Record<string, unknown>>(input: {
  currentProductionSpecId: string;
  items: T[];
  productionWorkspaceCleared: boolean;
}): T[] {
  if (!input.currentProductionSpecId || input.productionWorkspaceCleared) {
    return [];
  }

  return input.items.filter((item) => String(item.eventSpecId ?? "").trim() !== input.currentProductionSpecId);
}

export function selectProductionWorkbenchPlan<T extends Record<string, unknown>>(input: {
  currentProductionSpecId: string;
  currentSpecPlans: T[];
  orderedPlans: T[];
  productionWorkspaceCleared: boolean;
  selectedPlanId?: string;
}): T | undefined {
  if (input.productionWorkspaceCleared) {
    return undefined;
  }

  return (
    selectProductionPlanById({
      plans: input.currentSpecPlans,
      selectedPlanId: input.selectedPlanId
    }) ??
    selectProductionPlanById({
      plans: input.orderedPlans,
      selectedPlanId: input.selectedPlanId
    }) ??
    input.currentSpecPlans[0] ??
    (input.currentProductionSpecId ? undefined : input.orderedPlans[0])
  );
}

export function selectProductionPlanSpec<T extends Record<string, unknown>>(input: {
  selectedPlan?: Record<string, unknown>;
  specsById: Map<string, T>;
}): T | undefined {
  if (!input.selectedPlan) {
    return undefined;
  }

  return lookupProductionSpecById(input.specsById, input.selectedPlan.eventSpecId);
}

export function buildProductionPlanComponentMap(
  selectedPlanSpec?: Record<string, unknown>
): Map<string, Record<string, unknown>> {
  const menuPlan = Array.isArray(selectedPlanSpec?.menuPlan) ? selectedPlanSpec.menuPlan : [];
  return new Map(
    menuPlan.map((entry) => {
      const component = entry as Record<string, unknown>;
      return [String(component.componentId ?? ""), component] as const;
    })
  );
}
