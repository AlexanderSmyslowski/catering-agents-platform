import { describe, expect, it, vi } from "vitest";
import type { AcceptedEventSpec, MenuComponent, Recipe } from "@catering/shared-core";
import { buildRecipeComponentPlanningArtifacts } from "../production-service/src/rules/planning-recipe-component-artifacts.js";
import type { RecipeDiscoveryService } from "../production-service/src/recipe-discovery/service.js";

const component: MenuComponent = {
  componentId: "component-main",
  label: "Roastbeef",
  productionDecision: { mode: "scratch" }
};

const eventSpec = {
  schemaVersion: "1.0.0",
  specId: "event-1",
  lifecycle: { commercialState: "accepted" },
  readiness: { status: "complete", reasons: [] },
  sourceLineage: [{ sourceType: "manual_input", reference: "test" }],
  event: { date: "2026-08-18", serviceForm: "Buffet" },
  attendees: { expected: 50 },
  servicePlan: { eventType: "Firmenfeier", serviceForm: "Buffet", modules: [] },
  menuPlan: [component]
} as AcceptedEventSpec;

const recipe: Recipe = {
  schemaVersion: "1.0.0",
  recipeId: "recipe-main",
  name: "Roastbeef",
  source: {
    tier: "internal_verified",
    originType: "internal_db",
    reference: "THE ONE",
    retrievedAt: "2026-08-17T10:00:00.000Z",
    approvalState: "approved_internal",
    qualityScore: 1,
    fitScore: 1,
    extractionCompleteness: 1
  },
  baseYield: { servings: 10, unit: "servings" },
  ingredients: [],
  steps: [{ index: 1, instruction: "Produzieren." }],
  scalingRules: { defaultLossFactor: 0.1 },
  allergens: [],
  dietTags: []
};

const discoveryService = {
  resolveRecipe: vi.fn(async () => ({
    recipe,
    selection: {
      componentId: component.componentId,
      recipeId: recipe.recipeId,
      selectionReason: "trusted test recipe",
      autoUsedInternetRecipe: false,
      sourceTier: recipe.source.tier
    },
    unresolvedItems: []
  })),
  resolveRecipeOverride: vi.fn()
} as unknown as RecipeDiscoveryService;

describe("production planner raw servings bypass", () => {
  it("does not create a recipe batch from raw servings when bridge proof is absent", async () => {
    const artifacts = await buildRecipeComponentPlanningArtifacts({
      component,
      eventSpec,
      servings: 50,
      discoveryService,
      context: { businessId: "local" }
    });

    expect(artifacts.kind).toBe("unresolved");
    expect(artifacts).not.toHaveProperty("batch");
    expect(artifacts.issues.some((issue) => issue.blocking)).toBe(true);
    expect(artifacts.issues.map((issue) => issue.issue).join(" ")).toContain("Mengen-Rezept-Nachweis");
    expect(artifacts.selection.selectionReason).toBe("trusted test recipe");
  });
});
