import {
  assertBusinessId,
  classifyRecipeProductionTrust,
  type AcceptedEventSpec,
  type BusinessContext,
  type MenuComponent,
  type ProductionPlan,
  type Recipe
} from "@catering/shared-core";
import type { RecipeDiscoveryService } from "../recipe-discovery/service.js";
import { recipeMenuCategoryConflictReason } from "../recipe-discovery/menu-category-compatibility.js";
import { isBlockingPlanningIssue } from "./planning-readiness.js";
import { normalizeRecipeResolution } from "./planning-recipe-resolution.js";
import { productionConstraintConflictReason } from "./production-constraint-conflicts.js";
import { buildResolvedRecipePlanningArtifacts } from "./planning-resolved-recipe-artifacts.js";
import { buildUnresolvedComponentArtifacts } from "./planning-unresolved-component-artifacts.js";

export type RecipeComponentPlanningIssue = {
  issue: string;
  blocking: boolean;
};

export type UnresolvedRecipeComponentPlanningArtifacts = {
  kind: "unresolved";
  recipe?: Recipe;
  selection: ProductionPlan["recipeSelections"][number];
  kitchenSheet: ProductionPlan["kitchenSheets"][number];
  timelineItem: ProductionPlan["timeline"][number];
  issues: RecipeComponentPlanningIssue[];
};

export type ResolvedRecipeComponentPlanningArtifacts = {
  kind: "resolved";
  recipe?: Recipe;
  selection: ProductionPlan["recipeSelections"][number];
  batch: ProductionPlan["productionBatches"][number];
  kitchenSheet: ProductionPlan["kitchenSheets"][number];
  timelineItem: ProductionPlan["timeline"][number];
  issues: RecipeComponentPlanningIssue[];
};

export type RecipeComponentPlanningArtifacts =
  | UnresolvedRecipeComponentPlanningArtifacts
  | ResolvedRecipeComponentPlanningArtifacts;

function resolutionIssues(unresolvedItems: string[]): RecipeComponentPlanningIssue[] {
  return unresolvedItems.map((issue) => ({
    issue,
    blocking: isBlockingPlanningIssue(issue)
  }));
}

export async function buildRecipeComponentPlanningArtifacts({
  component,
  eventSpec,
  servings,
  discoveryService,
  context,
  persistDiscoveredRecipes = true
}: {
  component: MenuComponent;
  eventSpec: AcceptedEventSpec;
  servings: number;
  discoveryService: RecipeDiscoveryService;
  context: BusinessContext;
  persistDiscoveredRecipes?: boolean;
}): Promise<RecipeComponentPlanningArtifacts> {
  if (!context) throw new Error("Ein Betriebskontext ist erforderlich.");
  assertBusinessId(context.businessId);
  const rawResolution = component.recipeOverrideId
    ? await discoveryService.resolveRecipeOverride(component.recipeOverrideId, component, context)
    : await discoveryService.resolveRecipe(component, eventSpec, {
      context,
      persistWebWinner: persistDiscoveredRecipes
    });
  const resolution = normalizeRecipeResolution(rawResolution, component.label);
  const resolvedRecipe = resolution.recipe as Recipe | undefined;
  const issues = resolutionIssues(resolution.unresolvedItems);
  const constraintConflict = productionConstraintConflictReason(
    resolvedRecipe,
    eventSpec.productionConstraints
  );
  const categoryConflict = recipeMenuCategoryConflictReason(resolvedRecipe, component);
  const hardConflict = constraintConflict ?? categoryConflict;
  const selection = hardConflict
    ? {
        ...resolution.selection,
        selectionReason: hardConflict,
        autoUsedInternetRecipe: false
      }
    : resolution.selection;

  if (hardConflict) {
    const artifacts = buildUnresolvedComponentArtifacts({
      component,
      eventSpec,
      servings,
      reason: hardConflict,
      timelineLabel: `${component.label} Rezeptklärung`
    });
    return {
      kind: "unresolved",
      ...(resolvedRecipe ? { recipe: resolvedRecipe } : {}),
      selection,
      kitchenSheet: artifacts.kitchenSheet,
      timelineItem: artifacts.timelineItem,
      issues: [...issues, { issue: artifacts.issue, blocking: artifacts.blocking }]
    };
  }

  if (resolvedRecipe) {
    const trust = classifyRecipeProductionTrust(resolvedRecipe);
    if (!trust.trustedProductionInput) {
      const reason = `Rezept ${resolvedRecipe.name} erfordert Operator-Review vor operativer Produktionsplanung.`;
      const artifacts = buildUnresolvedComponentArtifacts({
        component,
        eventSpec,
        servings,
        reason,
        blocking: true,
        timelineLabel: `${component.label} Rezeptprüfung`
      });
      return {
        kind: "unresolved",
        recipe: resolvedRecipe,
        selection: {
          ...selection,
          selectionReason: reason,
          autoUsedInternetRecipe: false
        },
        kitchenSheet: artifacts.kitchenSheet,
        timelineItem: artifacts.timelineItem,
        issues: [
          ...issues,
          {
            issue: artifacts.issue,
            blocking: artifacts.blocking
          }
        ]
      };
    }
  }

  if (!resolvedRecipe || servings <= 0) {
    const reason = resolution.selection.selectionReason || "Für diese Komponente wurde noch kein belastbares Rezept gefunden.";
    const artifacts = buildUnresolvedComponentArtifacts({
      component,
      eventSpec,
      servings,
      reason,
      blocking: servings <= 0,
      timelineLabel: `${component.label} Rezeptklärung`
    });
    return {
      kind: "unresolved",
      selection,
      kitchenSheet: artifacts.kitchenSheet,
      timelineItem: artifacts.timelineItem,
      issues: [...issues, { issue: artifacts.issue, blocking: artifacts.blocking }]
    };
  }

  const artifacts = buildResolvedRecipePlanningArtifacts({
    eventSpec,
    component,
    recipe: resolvedRecipe,
    servings
  });
  return {
    kind: "resolved",
    recipe: resolvedRecipe,
    selection,
    batch: artifacts.batch,
    kitchenSheet: artifacts.kitchenSheet,
    timelineItem: artifacts.timelineItem,
    issues
  };
}
