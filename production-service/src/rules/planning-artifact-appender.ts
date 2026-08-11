import type {
  ProductionPlan,
  PurchaseItem,
  Recipe
} from "@catering/shared-core";
import type { UnresolvedComponentArtifacts } from "./planning-unresolved-component-artifacts.js";
import type { ProcurementPlanningArtifacts } from "./planning-procurement-artifacts.js";
import type { RecipeComponentPlanningArtifacts } from "./planning-recipe-component-artifacts.js";
import type { RecipeBranchPlanningArtifacts } from "./planning-recipe-branch-artifacts.js";

export type PlanningArtifactAppender = {
  productionBatches: ProductionPlan["productionBatches"];
  procurementItems: PurchaseItem[];
  kitchenSheets: ProductionPlan["kitchenSheets"];
  timeline: ProductionPlan["timeline"];
  recipeSelections: ProductionPlan["recipeSelections"];
  recipes?: Recipe[];
  noteIssue: (issue: string, blocking?: boolean) => void;
};

export function appendUnresolvedComponentArtifacts(
  appender: PlanningArtifactAppender,
  artifacts: UnresolvedComponentArtifacts
): void {
  appender.recipeSelections.push(artifacts.selection);
  appender.noteIssue(artifacts.issue, artifacts.blocking);
  appender.kitchenSheets.push(artifacts.kitchenSheet);
  appender.timeline.push(artifacts.timelineItem);
}

export function appendProcurementPlanningArtifacts(
  appender: PlanningArtifactAppender,
  artifacts: ProcurementPlanningArtifacts
): void {
  appender.procurementItems.push(...artifacts.procurementItems);
  appender.recipeSelections.push(artifacts.selection);
  appender.kitchenSheets.push(artifacts.kitchenSheet);
  appender.timeline.push(artifacts.timelineItem);
}

export function appendRecipeComponentPlanningArtifacts(
  appender: PlanningArtifactAppender,
  artifacts: RecipeComponentPlanningArtifacts
): void {
  appender.recipeSelections.push(artifacts.selection);
  if (artifacts.recipe && !(appender.recipes ?? []).some((recipe) => recipe.recipeId === artifacts.recipe?.recipeId)) {
    (appender.recipes ??= []).push(artifacts.recipe);
  }
  for (const issue of artifacts.issues) {
    appender.noteIssue(issue.issue, issue.blocking);
  }
  appender.kitchenSheets.push(artifacts.kitchenSheet);
  appender.timeline.push(artifacts.timelineItem);

  if (artifacts.kind === "resolved") {
    appender.productionBatches.push(artifacts.batch);
  }
}

export function appendRecipeBranchPlanningArtifacts(
  appender: PlanningArtifactAppender,
  artifacts: RecipeBranchPlanningArtifacts
): void {
  appender.procurementItems.push(...artifacts.procurementItems);
  appendRecipeComponentPlanningArtifacts(appender, artifacts.recipeArtifacts);
}
