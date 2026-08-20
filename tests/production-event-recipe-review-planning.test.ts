import { describe, expect, it } from "vitest";
import { buildProductionArtifacts } from "../production-service/src/rules/planning.js";
import {
  SCHEMA_VERSION,
  evaluateQuantityRecipeProductionBridge,
  normalizeEventRequestToSpec,
  type AcceptedEventSpec,
  type Recipe,
  type RecipeEventUseReview
} from "../shared-core/src/index.js";
import type { RecipeDiscoveryService } from "../production-service/src/recipe-discovery/service.js";

function eventSpec(): AcceptedEventSpec {
  const normalized = normalizeEventRequestToSpec({
    schemaVersion: SCHEMA_VERSION,
    requestId: "event-review-planning-1",
    source: { channel: "text", receivedAt: "2026-08-20T10:00:00.000Z" },
    rawInputs: [
      {
        kind: "text",
        content: "Sommerbuffet am 2026-09-01 fuer 24 Personen mit Tomatensuppe."
      }
    ]
  });

  return {
    ...normalized,
    menuPlan: normalized.menuPlan.map((component) => ({
      ...component,
      componentId: "component-tomato-soup",
      label: "Tomatensuppe",
      menuCategory: "vegetarian" as const,
      productionDecision: { mode: "scratch" as const }
    }))
  };
}

function bootstrapRecipe(): Recipe {
  return {
    schemaVersion: SCHEMA_VERSION,
    recipeId: "recipe-tomato-soup-candidate",
    name: "Tomatensuppe Kandidat",
    source: {
      tier: "digitized_cookbook",
      originType: "cookbook",
      reference: "cookbook:tomato-soup",
      retrievedAt: "2026-08-20T09:00:00.000Z",
      approvalState: "review_required",
      qualityScore: 0.9,
      fitScore: 0.9,
      extractionCompleteness: 1
    },
    baseYield: { servings: 12, unit: "servings" },
    ingredients: [
      {
        ingredientId: "tomatoes",
        name: "Tomaten",
        quantity: { amount: 2, unit: "kg" },
        group: "produce",
        purchaseUnit: "kg",
        normalizedUnit: "g"
      }
    ],
    steps: [{ index: 1, instruction: "Tomaten vorbereiten und garen." }],
    scalingRules: { defaultLossFactor: 1.05 },
    allergens: [],
    dietTags: ["vegetarian"],
    knowledge: {
      artifactKind: "transcribed_recipe",
      sourceCitation: { title: "Professional culinary reference" },
      derivation: { method: "direct_transcription" },
      production: { prepLeadMinutes: 45, holdMinutes: 30 },
      verification: {
        sourceStatus: "verified",
        allergenStatus: "verified",
        productionStatus: "verified",
        verifiedBy: "Kitchen lead",
        verifiedAt: "2026-08-20T09:30:00.000Z"
      },
      version: { revision: 1 }
    }
  };
}

function acceptedEventReview(spec: AcceptedEventSpec, recipe: Recipe): RecipeEventUseReview {
  return {
    eventSpecId: spec.specId,
    recipeId: recipe.recipeId,
    reviewedBy: "Kitchen lead",
    reviewedAt: "2026-08-20T09:45:00.000Z",
    decision: "accepted_for_event",
    confirmations: {
      quantitiesAndYield: true,
      methodAndEquipment: true,
      allergensAndDiet: true,
      holdingAndRegeneration: true
    }
  };
}

function discoveryFor(recipe: Recipe): RecipeDiscoveryService {
  const resolution = async () => ({
    recipe,
    selection: {
      componentId: "component-tomato-soup",
      recipeId: recipe.recipeId,
      selectionReason: "Professional recipe candidate selected.",
      autoUsedInternetRecipe: false
    },
    unresolvedItems: []
  });

  return {
    resolveRecipe: resolution,
    resolveRecipeOverride: resolution
  } as unknown as RecipeDiscoveryService;
}

function bridgeFor(spec: AcceptedEventSpec, recipe: Recipe) {
  const component = spec.menuPlan[0]!;
  const servings = component.servings ?? spec.attendees.expected ?? 0;
  return evaluateQuantityRecipeProductionBridge({
    eventSpecId: spec.specId,
    componentId: component.componentId,
    quantityDecision: {
      decisionId: "quantity-event-review-1",
      eventSpecId: spec.specId,
      componentId: component.componentId,
      guestCount: servings,
      serviceFormat: "buffet",
      dishRole: "starter",
      basis: "servings_per_person",
      perUnitAmount: 1,
      perUnitUnit: "servings",
      targetAmount: servings,
      targetUnit: "servings",
      rationale: "Vom freigegebenen Eventplan abgeleitete Portionsmenge.",
      evidence: { kind: "operator_instruction", reference: "event-plan" },
      reviewStatus: "approved"
    },
    recipe,
    recipeEventUseReview: acceptedEventReview(spec, recipe)
  });
}

describe("event-reviewed recipe candidates in production planning", () => {
  it("materializes a production batch only after exact event kitchen review", async () => {
    const spec = eventSpec();
    const recipe = bootstrapRecipe();
    const artifacts = await buildProductionArtifacts(
      spec,
      discoveryFor(recipe),
      {
        context: { businessId: "local" },
        quantityRecipeBridges: { [spec.menuPlan[0]!.componentId]: bridgeFor(spec, recipe) },
        recipeEventUseReviews: {
          [spec.menuPlan[0]!.componentId]: acceptedEventReview(spec, recipe)
        }
      }
    );

    expect(artifacts.productionPlan.productionBatches).toHaveLength(1);
    expect(artifacts.productionPlan.productionBatches[0]?.recipeId).toBe(recipe.recipeId);
    expect(artifacts.productionPlan.kitchenSheets[0]?.recipeSource?.reference).toBe("cookbook:tomato-soup");
    expect(recipe.source.approvalState).toBe("review_required");
  });

  it("keeps a candidate blocked when the review belongs to another event", async () => {
    const spec = eventSpec();
    const recipe = bootstrapRecipe();
    const review = {
      ...acceptedEventReview(spec, recipe),
      eventSpecId: "different-event"
    };
    const artifacts = await buildProductionArtifacts(
      spec,
      discoveryFor(recipe),
      {
        context: { businessId: "local" },
        quantityRecipeBridges: { [spec.menuPlan[0]!.componentId]: bridgeFor(spec, recipe) },
        recipeEventUseReviews: { [spec.menuPlan[0]!.componentId]: review }
      }
    );

    expect(artifacts.productionPlan.productionBatches).toHaveLength(0);
    expect(artifacts.productionPlan.blockingIssues).toContain("Rezept Tomatensuppe Kandidat ist für dieses Event nicht freigegeben.");
  });
});
