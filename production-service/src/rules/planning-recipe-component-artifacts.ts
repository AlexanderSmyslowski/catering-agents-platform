import type {
  AcceptedEventSpec,
  MenuComponent,
  ProductionPlan,
  Recipe
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
  selection: ProductionPlan["recipeSelections"][number];
  kitchenSheet: ProductionPlan["kitchenSheets"][number];
  timelineItem: ProductionPlan["timeline"][number];
  issues: RecipeComponentPlanningIssue[];
};

export type ResolvedRecipeComponentPlanningArtifacts = {
  kind: "resolved";
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
  discoveryService
}: {
  component: MenuComponent;
  eventSpec: AcceptedEventSpec;
  servings: number;
  discoveryService: RecipeDiscoveryService;
}): Promise<RecipeComponentPlanningArtifacts> {
  const rawResolution = component.recipeOverrideId
    ? await discoveryService.resolveRecipeOverride(component.recipeOverrideId, component)
    : await discoveryService.resolveRecipe(component, eventSpec);
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
      selection,
      kitchenSheet: artifacts.kitchenSheet,
      timelineItem: artifacts.timelineItem,
      issues: [...issues, { issue: artifacts.issue, blocking: artifacts.blocking }]
    };
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
    selection,
    batch: artifacts.batch,
    kitchenSheet: artifacts.kitchenSheet,
    timelineItem: artifacts.timelineItem,
    issues
  };
}
