import { describe, expect, it, vi } from "vitest";
import {
  aggregatePurchaseList,
  classifyRecipeProductionTrust,
  SCHEMA_VERSION,
  validateLlmRecipeResearchDraft,
  type AcceptedEventSpec,
  type MenuComponent,
  type Recipe
} from "@catering/shared-core";
import { buildRecipeComponentPlanningArtifacts } from "../production-service/src/rules/planning-recipe-component-artifacts.js";
import type { RecipeDiscoveryService } from "../production-service/src/recipe-discovery/service.js";

function eventSpec(component: MenuComponent): AcceptedEventSpec {
  return {
    schemaVersion: SCHEMA_VERSION,
    specId: "spec-review-gate",
    readiness: {
      status: "complete",
      reasons: []
    },
    lifecycle: {
      commercialState: "accepted"
    },
    event: {
      date: "2026-06-30"
    },
    attendees: {
      expected: 40
    },
    servicePlan: {
      eventType: "lunch",
      serviceForm: "buffet",
      modules: []
    },
    menuPlan: [component],
    sourceLineage: [
      {
        sourceType: "manual_input",
        reference: "test:recipe-candidate-review-gate"
      }
    ]
  };
}

function component(): MenuComponent {
  return {
    componentId: "component-tomato-soup",
    label: "Tomatensuppe",
    menuCategory: "vegetarian",
    productionDecision: {
      mode: "scratch"
    }
  };
}

function recipe(sourceOverrides: Partial<Recipe["source"]> = {}): Recipe {
  return {
    schemaVersion: SCHEMA_VERSION,
    recipeId: "recipe-tomato-soup",
    name: "Tomatensuppe Bankett",
    source: {
      tier: "internal_verified",
      originType: "internal_db",
      reference: "internal:tomato-soup",
      retrievedAt: "2026-06-01T10:00:00.000Z",
      approvalState: "approved_internal",
      qualityScore: 0.98,
      fitScore: 0.95,
      extractionCompleteness: 1,
      ...sourceOverrides
    },
    baseYield: {
      servings: 10,
      unit: "servings"
    },
    ingredients: [
      {
        ingredientId: "ingredient-tomato",
        name: "Tomaten",
        quantity: {
          amount: 2,
          unit: "kg"
        },
        group: "produce"
      }
    ],
    steps: [
      {
        index: 1,
        instruction: "Tomaten garen."
      }
    ],
    scalingRules: {
      defaultLossFactor: 1.05
    },
    allergens: [],
    dietTags: ["vegetarian"]
  };
}

function discoveryReturning(selectedRecipe: Recipe): RecipeDiscoveryService {
  return {
    resolveRecipe: vi.fn(async (menuComponent: MenuComponent) => ({
      recipe: selectedRecipe,
      selection: {
        componentId: menuComponent.componentId,
        recipeId: selectedRecipe.recipeId,
        selectionReason: "Test recipe selected.",
        autoUsedInternetRecipe:
          selectedRecipe.source.approvalState === "auto_usable",
        sourceTier: selectedRecipe.source.tier
      },
      unresolvedItems: []
    })),
    resolveRecipeOverride: vi.fn()
  } as unknown as RecipeDiscoveryService;
}

async function buildArtifactsFor(selectedRecipe: Recipe) {
  const menuComponent = component();
  return buildRecipeComponentPlanningArtifacts({
    eventSpec: eventSpec(menuComponent),
    component: menuComponent,
    servings: 40,
    bridgeResult: {
      status: "ready_for_scaling",
      eventSpecId: "spec-review-gate",
      componentId: menuComponent.componentId,
      recipeId: selectedRecipe.recipeId,
      targetOutput: { amount: 40, unit: "servings" },
      targetServings: 40,
      conversionMethod: "direct_servings",
      issues: []
    },
    context: { businessId: "local" },
    discoveryService: discoveryReturning(selectedRecipe)
  });
}

describe("recipe candidate review gate", () => {
  it("keeps approved internal recipes available for deterministic production artifacts", async () => {
    const artifacts = await buildArtifactsFor(recipe());

    expect(artifacts.kind).toBe("resolved");
    if (artifacts.kind !== "resolved") {
      throw new Error("Expected resolved artifacts.");
    }

    expect(artifacts.batch.recipeId).toBe("recipe-tomato-soup");
    expect(artifacts.selection.autoUsedInternetRecipe).toBe(false);
    const purchaseList = aggregatePurchaseList("spec-review-gate", [artifacts.batch]);
    expect(purchaseList.items).toEqual([
      expect.objectContaining({
        ingredientId: "ingredient-tomato",
        sourceRecipes: ["recipe-tomato-soup"]
      })
    ]);
  });

  it("blocks review-required web candidates before batch and purchase generation", async () => {
    const artifacts = await buildArtifactsFor(
      recipe({
        tier: "internet_fallback",
        originType: "web",
        reference: "web:tomato-soup",
        approvalState: "review_required"
      })
    );

    expect(artifacts.kind).toBe("unresolved");
    expect(artifacts.selection.autoUsedInternetRecipe).toBe(false);
    expect(artifacts.selection.selectionReason).toBe(
      "Rezept Tomatensuppe Bankett erfordert Operator-Review vor operativer Produktionsplanung."
    );
    expect(artifacts.issues).toEqual([
      {
        issue:
          "Rezept Tomatensuppe Bankett erfordert Operator-Review vor operativer Produktionsplanung.",
        blocking: true
      }
    ]);
  });

  it("does not let web auto_usable bypass operator review", async () => {
    const artifacts = await buildArtifactsFor(
      recipe({
        tier: "internet_fallback",
        originType: "web",
        reference: "web:tomato-soup",
        approvalState: "auto_usable"
      })
    );

    expect(classifyRecipeProductionTrust(
      recipe({
        tier: "internet_fallback",
        originType: "web",
        reference: "web:tomato-soup",
        approvalState: "auto_usable"
      })
    )).toMatchObject({
      trustedProductionInput: false,
      humanReviewRequired: true
    });
    expect(artifacts.kind).toBe("unresolved");
    expect(artifacts.selection.autoUsedInternetRecipe).toBe(false);
  });

  it("allows reviewed web candidates through the existing approved_internal model", async () => {
    const reviewedWebRecipe = recipe({
      tier: "internal_approved",
      originType: "web",
      reference: "web:tomato-soup",
      url: "https://example.test/tomato-soup",
      publisher: "Example Recipes",
      approvalState: "approved_internal",
      licenseNote: "Review-Entscheidung: approve."
    });

    expect(classifyRecipeProductionTrust(reviewedWebRecipe)).toMatchObject({
      trustedProductionInput: true,
      humanReviewRequired: false
    });

    const artifacts = await buildArtifactsFor(reviewedWebRecipe);
    expect(artifacts.kind).toBe("resolved");
    expect(reviewedWebRecipe.source).toMatchObject({
      originType: "web",
      reference: "web:tomato-soup",
      url: "https://example.test/tomato-soup",
      publisher: "Example Recipes"
    });
  });

  it("keeps LLM recipe drafts outside trusted recipe inputs", () => {
    expect(
      validateLlmRecipeResearchDraft({
        draftType: "recipe_research_summary_draft",
        humanApprovalRequired: true,
        writesProductObject: false,
        text: "Candidate summary only.",
        sourceRefs: ["web:tomato-soup"]
      })
    ).toEqual({
      valid: true,
      errors: []
    });

    expect(
      validateLlmRecipeResearchDraft({
        draftType: "recipe_research_summary_draft",
        humanApprovalRequired: true,
        writesProductObject: true,
        text: "Create the production recipe.",
        sourceRefs: ["web:tomato-soup"]
      }).valid
    ).toBe(false);
  });
});
