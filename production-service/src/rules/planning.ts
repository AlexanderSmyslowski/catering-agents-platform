import {
  assertBusinessId,
  validateAcceptedEventSpec,
  type AcceptedEventSpec,
  type BusinessContext,
  type ProductionPlan,
  type PurchaseList,
  type QuantityRecipeProductionBridgeResult,
  type Recipe,
  type RecipeEventUseReview
} from "@catering/shared-core";
import { RecipeDiscoveryService } from "../recipe-discovery/service.js";
import { buildFinalProductionArtifacts } from "./planning-artifact-finalization.js";
import { createPlanningIssueCollector } from "./planning-issue-collector.js";
import { selectOperationalPlanningArtifacts } from "./planning-operational-artifacts.js";
import { buildUnresolvedComponentArtifacts } from "./planning-unresolved-component-artifacts.js";
import { appendUnresolvedComponentArtifacts } from "./planning-artifact-appender.js";
import { planningComponentErrorReason } from "./planning-component-error-reason.js";
import { createPlanningArtifactState } from "./planning-artifact-state.js";
import { appendPlanningComponentBranchArtifacts } from "./planning-component-branch.js";

export async function buildProductionArtifacts(
  eventSpecInput: AcceptedEventSpec,
  discoveryService: RecipeDiscoveryService,
  options: {
    context: BusinessContext;
    persistDiscoveredRecipes?: boolean;
    quantityRecipeBridges?: Record<string, QuantityRecipeProductionBridgeResult>;
    recipeEventUseReviews?: Record<string, RecipeEventUseReview>;
  }
): Promise<{ productionPlan: ProductionPlan; purchaseList: PurchaseList; recipes: Recipe[] }> {
  if (!options?.context) throw new Error("Ein Betriebskontext ist erforderlich.");
  assertBusinessId(options.context.businessId);
  const eventSpec = validateAcceptedEventSpec(eventSpecInput);
  const issueCollector = createPlanningIssueCollector(eventSpec.missingFields);
  const {
    unresolvedItems,
    warnings,
    blockingIssues,
    noteIssue
  } = issueCollector;
  const {
    productionBatches,
    procurementItems,
    kitchenSheets,
    timeline,
    recipeSelections,
    recipes,
    appender: artifactAppender
  } = createPlanningArtifactState(noteIssue);

  for (const component of eventSpec.menuPlan) {
    const servings = component.servings ?? eventSpec.attendees.expected ?? 0;

    try {
      await appendPlanningComponentBranchArtifacts({
        eventSpec,
        component,
        servings,
        bridgeResult: options.quantityRecipeBridges?.[component.componentId],
        recipeEventUseReview: options.recipeEventUseReviews?.[component.componentId],
        discoveryService,
        context: options.context,
        persistDiscoveredRecipes: options.persistDiscoveredRecipes !== false,
        artifactAppender
      });
    } catch (error) {
      const reason = planningComponentErrorReason(component.label, error);
      const artifacts = buildUnresolvedComponentArtifacts({
        component,
        eventSpec,
        servings,
        reason,
        timelineLabel: `${component.label} Rezeptklärung`
      });
      appendUnresolvedComponentArtifacts(artifactAppender, artifacts);
    }
  }

  const uniqueBlockingIssues = [...new Set(blockingIssues)];
  const operationalArtifacts = selectOperationalPlanningArtifacts(
    {
      productionBatches,
      timeline,
      kitchenSheets,
      procurementItems
    },
    uniqueBlockingIssues
  );

  return {
    ...buildFinalProductionArtifacts({
      eventSpec,
      readinessIssues: {
        unresolvedItems,
        warnings,
        blockingIssues: uniqueBlockingIssues
      },
      operationalArtifacts,
      recipeSelections,
    }),
    recipes
  };
}
