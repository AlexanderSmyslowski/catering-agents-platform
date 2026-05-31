import { describe, expect, it } from "vitest";
import type {
  ProductionPlan,
  PurchaseItem
} from "../shared-core/src/index.js";
import {
  appendProcurementPlanningArtifacts,
  appendRecipeComponentPlanningArtifacts,
  appendUnresolvedComponentArtifacts,
  type PlanningArtifactAppender
} from "../production-service/src/rules/planning-artifact-appender.js";
import type { UnresolvedComponentArtifacts } from "../production-service/src/rules/planning-unresolved-component-artifacts.js";
import type { ProcurementPlanningArtifacts } from "../production-service/src/rules/planning-procurement-artifacts.js";
import type { RecipeComponentPlanningArtifacts } from "../production-service/src/rules/planning-recipe-component-artifacts.js";

function createAppender(): PlanningArtifactAppender & {
  notedIssues: Array<{ issue: string; blocking?: boolean }>;
} {
  const notedIssues: Array<{ issue: string; blocking?: boolean }> = [];
  return {
    productionBatches: [],
    procurementItems: [],
    kitchenSheets: [],
    timeline: [],
    recipeSelections: [],
    notedIssues,
    noteIssue(issue, blocking) {
      notedIssues.push({ issue, blocking });
    }
  };
}

const selection: ProductionPlan["recipeSelections"][number] = {
  componentId: "component-soup",
  selectionReason: "Rezeptklärung nötig.",
  autoUsedInternetRecipe: false
};

const kitchenSheet: ProductionPlan["kitchenSheets"][number] = {
  title: "Tomatensuppe - Rezeptklärung nötig",
  componentId: "component-soup",
  productionQty: { amount: 40, unit: "servings" },
  station: "Kalte Küche",
  prepWindow: "2026-06-01 T-1",
  ingredients: [],
  steps: [],
  blockingNotes: ["Rezeptklärung nötig."],
  instructions: ["Rezeptklärung nötig."]
};

const timelineItem: ProductionPlan["timeline"][number] = {
  label: "Tomatensuppe Rezeptklärung",
  at: "2026-06-01 T-1"
};

describe("planning artifact appender", () => {
  it("appends unresolved artifacts and records their issue", () => {
    const appender = createAppender();
    const artifacts: UnresolvedComponentArtifacts = {
      selection,
      kitchenSheet,
      timelineItem,
      issue: "Rezeptklärung nötig.",
      blocking: true
    };

    appendUnresolvedComponentArtifacts(appender, artifacts);

    expect(appender.recipeSelections).toEqual([selection]);
    expect(appender.kitchenSheets).toEqual([kitchenSheet]);
    expect(appender.timeline).toEqual([timelineItem]);
    expect(appender.notedIssues).toEqual([{ issue: "Rezeptklärung nötig.", blocking: true }]);
  });

  it("appends procurement artifacts without creating readiness issues", () => {
    const appender = createAppender();
    const item: PurchaseItem = {
      ingredientId: "purchase-bread",
      displayName: "Brot",
      normalizedQty: 12,
      normalizedUnit: "pcs",
      purchaseQty: 12,
      purchaseUnit: "pcs",
      group: "bakery",
      sourceRecipes: ["component-soup"],
      mappingConfidence: 1
    };
    const artifacts: ProcurementPlanningArtifacts = {
      procurementItems: [item],
      selection,
      kitchenSheet,
      timelineItem
    };

    appendProcurementPlanningArtifacts(appender, artifacts);

    expect(appender.procurementItems).toEqual([item]);
    expect(appender.recipeSelections).toEqual([selection]);
    expect(appender.kitchenSheets).toEqual([kitchenSheet]);
    expect(appender.timeline).toEqual([timelineItem]);
    expect(appender.notedIssues).toEqual([]);
  });

  it("appends unresolved recipe artifacts and preserves all recipe issues", () => {
    const appender = createAppender();
    const artifacts: RecipeComponentPlanningArtifacts = {
      kind: "unresolved",
      selection,
      kitchenSheet,
      timelineItem,
      issues: [
        { issue: "Kein Rezept gefunden.", blocking: false },
        { issue: "Rezeptprüfung nötig.", blocking: true }
      ]
    };

    appendRecipeComponentPlanningArtifacts(appender, artifacts);

    expect(appender.productionBatches).toEqual([]);
    expect(appender.recipeSelections).toEqual([selection]);
    expect(appender.kitchenSheets).toEqual([kitchenSheet]);
    expect(appender.timeline).toEqual([timelineItem]);
    expect(appender.notedIssues).toEqual([
      { issue: "Kein Rezept gefunden.", blocking: false },
      { issue: "Rezeptprüfung nötig.", blocking: true }
    ]);
  });

  it("appends resolved recipe batches alongside shared artifacts", () => {
    const appender = createAppender();
    const batch: ProductionPlan["productionBatches"][number] = {
      batchId: "batch-soup",
      componentId: "component-soup",
      recipeId: "recipe-soup",
      scaledYield: { amount: 40, unit: "servings" },
      batchCount: 1,
      lossFactor: 1.05,
      station: "Kalte Küche",
      prepWindow: "2026-06-01 T-1",
      ingredients: [],
      steps: [],
      gnPlan: []
    };
    const artifacts: RecipeComponentPlanningArtifacts = {
      kind: "resolved",
      selection,
      batch,
      kitchenSheet,
      timelineItem,
      issues: []
    };

    appendRecipeComponentPlanningArtifacts(appender, artifacts);

    expect(appender.productionBatches).toEqual([batch]);
    expect(appender.recipeSelections).toEqual([selection]);
    expect(appender.kitchenSheets).toEqual([kitchenSheet]);
    expect(appender.timeline).toEqual([timelineItem]);
    expect(appender.notedIssues).toEqual([]);
  });
});
