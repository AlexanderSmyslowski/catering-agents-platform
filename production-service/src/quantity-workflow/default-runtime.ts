import type {
  ApprovedProductionSpec,
  MenuComponent,
  ProductionScalingRule,
  QuantityDecisionDishRole,
  QuantityRecommendationEvidence,
  Recipe,
  TrustedActor
} from "@catering/shared-core";
import type { QuantityWorkflowRuntimeComponent } from "./runtime.js";
import type { ProductionQuantityPurchaseRowInput } from "./service.js";

export interface ApprovedSnapshotQuantityEvidenceContext {
  actor: TrustedActor;
  caseId: string;
  approvedSpec: ApprovedProductionSpec;
  component: MenuComponent;
  recipe: Recipe;
}

export type QuantityEvidenceProvider = (
  context: ApprovedSnapshotQuantityEvidenceContext
) => Promise<QuantityRecommendationEvidence[]>;

export type ProductionScalingRuleProvider = (
  context: ApprovedSnapshotQuantityEvidenceContext
) => Promise<ProductionScalingRule[]>;

export interface BuildApprovedSnapshotQuantityRuntimeInput {
  actor: TrustedActor;
  caseId: string;
  approvedSpec: ApprovedProductionSpec;
  evidenceFor?: QuantityEvidenceProvider;
  scalingRulesFor?: ProductionScalingRuleProvider;
}

function dishRoleFor(component: MenuComponent): QuantityDecisionDishRole {
  const value = `${component.course ?? ""} ${component.serviceStyle ?? ""} ${component.label}`.toLocaleLowerCase("de-DE");
  if (/dessert|nachtisch|süß|sweet/.test(value)) return "dessert";
  if (/starter|vorspeise/.test(value)) return "starter";
  if (/beilage|side/.test(value)) return "side";
  if (/fingerfood|finger food/.test(value)) return "fingerfood";
  if (/snack/.test(value)) return "snack";
  if (/dip|sauce|condiment|chutney/.test(value)) return "condiment";
  if (/main|hauptgang|hauptgericht/.test(value)) return "main";
  return "other";
}

function approximatelyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= Math.max(0.01, Math.abs(right) * 1e-6);
}

function purchaseRowsFor(
  approvedSpec: ApprovedProductionSpec,
  componentId: string,
  recipe: Recipe
): ProductionQuantityPurchaseRowInput[] {
  const plan = approvedSpec.artifacts.productionPlan;
  const matchingBatches = plan.productionBatches.filter((batch) => batch.recipeId === recipe.recipeId);
  const uniqueComponentBatch = matchingBatches.length === 1 && matchingBatches[0]?.componentId === componentId
    ? matchingBatches[0]
    : undefined;

  return approvedSpec.artifacts.purchaseList.items
    .filter((item) => item.sourceRecipes.includes(recipe.recipeId))
    .map((item) => {
      const base: ProductionQuantityPurchaseRowInput = {
        rowId: `${approvedSpec.artifacts.purchaseList.purchaseListId}:${item.ingredientId}`,
        articleName: item.displayName,
        amount: item.normalizedQty,
        unit: item.normalizedUnit
      };
      if (!uniqueComponentBatch || item.sourceRecipes.length !== 1) return base;
      const recipeMatches = recipe.ingredients.filter((line) => line.ingredientId === item.ingredientId);
      const batchMatches = uniqueComponentBatch.ingredients.filter((line) => line.ingredientId === item.ingredientId);
      if (recipeMatches.length !== 1 || batchMatches.length !== 1) return base;
      const batchLine = batchMatches[0]!;
      if (batchLine.quantity.unit !== item.normalizedUnit) return base;
      if (!approximatelyEqual(batchLine.quantity.amount, item.normalizedQty)) return base;
      return {
        ...base,
        lineage: {
          eventSpecId: approvedSpec.artifacts.eventSpec.specId,
          componentId,
          recipeId: recipe.recipeId,
          ingredientId: item.ingredientId
        }
      };
    });
}

export async function buildApprovedSnapshotQuantityRuntime(
  input: BuildApprovedSnapshotQuantityRuntimeInput
): Promise<QuantityWorkflowRuntimeComponent[]> {
  const { approvedSpec } = input;
  if (approvedSpec.businessId !== input.actor.businessId) return [];
  const eventSpec = approvedSpec.artifacts.eventSpec;
  const guestCount = eventSpec.attendees.expected ?? eventSpec.attendees.guaranteed;
  if (!Number.isFinite(guestCount) || (guestCount ?? 0) <= 0) return [];
  const serviceFormat = eventSpec.event.serviceForm ?? eventSpec.servicePlan.serviceForm;
  if (!serviceFormat?.trim()) return [];

  const runtime: QuantityWorkflowRuntimeComponent[] = [];
  for (const batch of approvedSpec.artifacts.productionPlan.productionBatches) {
    if (batch.scaledYield.unit !== "servings" || !Number.isFinite(batch.scaledYield.amount) || batch.scaledYield.amount <= 0) {
      continue;
    }
    const components = eventSpec.menuPlan.filter((component) => component.componentId === batch.componentId);
    const recipes = approvedSpec.artifacts.recipes.filter((recipe) => recipe.recipeId === batch.recipeId);
    if (components.length !== 1 || recipes.length !== 1) continue;
    const component = components[0]!;
    const recipe = recipes[0]!;
    const context: ApprovedSnapshotQuantityEvidenceContext = {
      actor: input.actor,
      caseId: input.caseId,
      approvedSpec,
      component,
      recipe
    };
    const evidence = input.evidenceFor ? await input.evidenceFor(context) : [];
    const productionScalingRules = input.scalingRulesFor ? await input.scalingRulesFor(context) : [];
    const perUnitAmount = Number((batch.scaledYield.amount / guestCount!).toFixed(6));
    const currentAuthority = {
      decisionId: `approved-snapshot:${approvedSpec.approvedProductionSpecId}:${component.componentId}`,
      eventSpecId: eventSpec.specId,
      componentId: component.componentId,
      guestCount: guestCount!,
      serviceFormat,
      dishRole: dishRoleFor(component),
      basis: "servings_per_person" as const,
      perUnitAmount,
      perUnitUnit: "servings",
      targetAmount: batch.scaledYield.amount,
      targetUnit: "servings",
      rationale: "Aus dem menschlich freigegebenen Produktionssnapshot als aktuelle Event-Mengenautorität rekonstruiert.",
      evidence: { kind: "operator_instruction" as const, reference: approvedSpec.approvedProductionSpecId },
      reviewStatus: "approved" as const
    };
    const revision = [
      approvedSpec.approvedProductionSpecId,
      approvedSpec.sourceDraft.revision,
      approvedSpec.artifacts.productionPlan.planId,
      approvedSpec.artifacts.purchaseList.purchaseListId
    ].join(":");

    runtime.push({
      caseId: input.caseId,
      componentId: component.componentId,
      revision,
      projectionInput: {
        componentId: component.componentId,
        label: component.label,
        recommendationInput: {
          decisionId: `recommendation:${approvedSpec.approvedProductionSpecId}:${component.componentId}`,
          eventSpecId: eventSpec.specId,
          componentId: component.componentId,
          guestCount: guestCount!,
          serviceFormat,
          dishRole: dishRoleFor(component),
          basis: "servings_per_person",
          evidence
        },
        currentAuthority,
        purchaseRows: purchaseRowsFor(approvedSpec, component.componentId, recipe)
      },
      previewInput: {
        eventSpecId: eventSpec.specId,
        componentId: component.componentId,
        recipe,
        currentAuthority,
        outputMapping: {
          recipeId: recipe.recipeId,
          outputAmount: recipe.baseYield.servings,
          outputUnit: "servings",
          recipeServings: recipe.baseYield.servings,
          reviewedBy: `approved-snapshot:${approvedSpec.approvalRequestId}`,
          reviewedAt: approvedSpec.approvedAt
        },
        recommendationReference: `recommendation:${approvedSpec.approvedProductionSpecId}:${component.componentId}`,
        productionScalingRules
      }
    });
  }

  return runtime.sort((left, right) => left.componentId.localeCompare(right.componentId));
}
