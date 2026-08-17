import {
  applyNonlinearProductionScaling,
  previewQuantityOverride,
  recommendQuantity,
  type ProductionScalingRule,
  type QuantityDecisionInput,
  type QuantityOverrideEdit,
  type QuantityOverridePreviewInput,
  type QuantityRecommendationInput
} from "@catering/shared-core";

export interface ProductionQuantityPurchaseLineage {
  eventSpecId: string;
  componentId: string;
  recipeId: string;
  ingredientId: string;
}

export interface ProductionQuantityPurchaseRowInput {
  rowId: string;
  articleName: string;
  amount: number;
  unit: string;
  lineage?: ProductionQuantityPurchaseLineage;
}

export interface ProductionQuantityPurchaseRowProjection extends ProductionQuantityPurchaseRowInput {
  editable: boolean;
  readOnlyReason?: string;
}

export interface QuantityWorkflowProjectionInput {
  componentId: string;
  label: string;
  recommendationInput: QuantityRecommendationInput;
  currentAuthority?: QuantityDecisionInput;
  purchaseRows: ProductionQuantityPurchaseRowInput[];
}

export interface QuantityWorkflowProjection {
  componentId: string;
  label: string;
  status: "recommended" | "evidence_insufficient" | "conflicting_evidence" | "invalid_input";
  recommendedAmount?: number;
  unit?: string;
  professionalRange?: { min: number; max: number; unit: string };
  targetTotal?: { amount: number; unit: string };
  rationale?: string;
  evidenceReferences: string[];
  currentAuthority?: { perUnitAmount?: number; targetAmount: number; unit: string; reviewStatus: QuantityDecisionInput["reviewStatus"] };
  canEdit: boolean;
  reviewMessage?: string;
  purchaseRows: ProductionQuantityPurchaseRowProjection[];
}

export interface ProductionQuantityPreviewInput extends Omit<QuantityOverridePreviewInput, "edit"> {
  edit: Extract<QuantityOverrideEdit, { origin: "target_output" | "purchase_ingredient" }>;
  productionScalingRules?: ProductionScalingRule[];
  productionContext?: string[];
}

export interface QuantityPreviewIngredientChange {
  ingredientId: string;
  name: string;
  baselineAmount: number;
  effectiveAmount: number;
  unit: string;
}

export type ProductionQuantityOverridePreview =
  | { status: "blocked"; confirmable: false; issues: string[] }
  | {
      status: "preview_ready";
      confirmable: true;
      editOrigin: "target_output" | "purchase_ingredient";
      previousValue: { amount: number; unit: string };
      requestedValue: { amount: number; unit: string };
      resultingTarget: { amount: number; unit: string };
      scaleFactor: number;
      recipeChanges: QuantityPreviewIngredientChange[];
      purchaseChanges: QuantityPreviewIngredientChange[];
      appliedRuleIds: string[];
      relevantCandidateRuleIds: string[];
      nonlinearIssues: string[];
      corePreview: ReturnType<typeof previewQuantityOverride>;
    };

function nonBlank(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function projectPurchaseRow(componentId: string, row: ProductionQuantityPurchaseRowInput): ProductionQuantityPurchaseRowProjection {
  const lineage = row.lineage;
  const lineageComplete = Boolean(
    lineage &&
      nonBlank(lineage.eventSpecId) &&
      nonBlank(lineage.componentId) &&
      nonBlank(lineage.recipeId) &&
      nonBlank(lineage.ingredientId)
  );
  if (!lineageComplete) {
    return { ...row, editable: false, readOnlyReason: "Keine eindeutige Rezept-Zutaten-Zuordnung vorhanden." };
  }
  if (lineage!.componentId !== componentId) {
    return { ...row, editable: false, readOnlyReason: "Einkaufsposition gehört nicht eindeutig zu dieser Komponente." };
  }
  return { ...row, editable: true };
}

export function buildQuantityWorkflowProjection(input: QuantityWorkflowProjectionInput): QuantityWorkflowProjection {
  const recommendation = recommendQuantity(input.recommendationInput);
  const currentAuthority = input.currentAuthority
    ? {
        perUnitAmount: input.currentAuthority.perUnitAmount,
        targetAmount: input.currentAuthority.targetAmount,
        unit: input.currentAuthority.targetUnit,
        reviewStatus: input.currentAuthority.reviewStatus
      }
    : undefined;

  const projection: QuantityWorkflowProjection = {
    componentId: input.componentId,
    label: input.label,
    status: recommendation.status,
    recommendedAmount: recommendation.recommendedAmount,
    unit: recommendation.unit,
    professionalRange: recommendation.professionalRange,
    targetTotal:
      recommendation.decisionCandidate && recommendation.unit
        ? { amount: recommendation.decisionCandidate.targetAmount, unit: recommendation.unit }
        : undefined,
    rationale: recommendation.rationale,
    evidenceReferences: recommendation.evidenceReferences,
    currentAuthority,
    canEdit: Boolean(input.currentAuthority),
    purchaseRows: input.purchaseRows.map((row) => projectPurchaseRow(input.componentId, row))
  };

  if (recommendation.status === "evidence_insufficient") {
    projection.reviewMessage = "Noch keine belastbare Mengenempfehlung – Küchenentscheidung erforderlich.";
  } else if (recommendation.status === "conflicting_evidence") {
    projection.reviewMessage = "Mengen-Evidenz widerspricht sich – Küchenentscheidung erforderlich.";
  } else if (recommendation.status === "invalid_input") {
    projection.reviewMessage = "Mengendaten sind unvollständig oder ungültig – Prüfung erforderlich.";
  }

  return projection;
}

function previousAndRequestedValue(
  input: ProductionQuantityPreviewInput,
  corePreview: Extract<ReturnType<typeof previewQuantityOverride>, { status: "preview_ready" }>
): { previousValue: { amount: number; unit: string }; requestedValue: { amount: number; unit: string } } {
  if (input.edit.origin === "target_output") {
    return {
      previousValue: {
        amount: input.currentAuthority.perUnitAmount ?? input.currentAuthority.targetAmount,
        unit: input.edit.unit
      },
      requestedValue: { amount: input.edit.perUnitAmount, unit: input.edit.unit }
    };
  }

  const newLine = corePreview.proportionalBaseline.ingredients.find((line) => line.ingredientId === input.edit.ingredientId);
  return {
    previousValue: {
      amount: newLine ? Number((newLine.quantity.amount / corePreview.scaleFactor).toFixed(2)) : input.edit.amount,
      unit: input.edit.unit
    },
    requestedValue: { amount: input.edit.amount, unit: input.edit.unit }
  };
}

export function previewProductionQuantityOverride(input: ProductionQuantityPreviewInput): ProductionQuantityOverridePreview {
  const corePreview = previewQuantityOverride({
    eventSpecId: input.eventSpecId,
    componentId: input.componentId,
    recipe: input.recipe,
    currentAuthority: input.currentAuthority,
    outputMapping: input.outputMapping,
    recommendationReference: input.recommendationReference,
    edit: input.edit
  });

  if (corePreview.status !== "preview_ready") {
    return { status: "blocked", confirmable: false, issues: corePreview.issues };
  }

  const effective = applyNonlinearProductionScaling({
    recipe: input.recipe,
    targetServings: corePreview.proportionalBaseline.scaledYield.amount,
    rules: input.productionScalingRules ?? [],
    context: input.productionContext
  });
  const effectiveByIngredient = new Map(effective.effectiveRecipe.ingredients.map((line) => [line.ingredientId, line] as const));
  const recipeChanges: QuantityPreviewIngredientChange[] = effective.proportionalBaseline.ingredients.map((line) => {
    const effectiveLine = effectiveByIngredient.get(line.ingredientId) ?? line;
    return {
      ingredientId: line.ingredientId,
      name: line.name,
      baselineAmount: line.quantity.amount,
      effectiveAmount: effectiveLine.quantity.amount,
      unit: line.quantity.unit
    };
  });

  return {
    status: "preview_ready",
    confirmable: true,
    editOrigin: input.edit.origin,
    ...previousAndRequestedValue(input, corePreview),
    resultingTarget: { amount: corePreview.proposedAuthority.targetAmount, unit: corePreview.proposedAuthority.targetUnit },
    scaleFactor: corePreview.scaleFactor,
    recipeChanges,
    purchaseChanges: recipeChanges.map((change) => ({ ...change })),
    appliedRuleIds: effective.appliedRuleIds,
    relevantCandidateRuleIds: effective.relevantCandidateIds,
    nonlinearIssues: effective.issues,
    corePreview
  };
}
