import { describe, expect, it } from "vitest";
import {
  evaluateRecipeEventUse,
  evaluateRecipeKnowledgeMaturity,
  validateRecipe,
  validateRecipeEventUseReview,
  type Recipe,
  type RecipeEventUseReview
} from "@catering/shared-core";

const baseRecipe: Recipe = {
  schemaVersion: "1.0.0",
  recipeId: "recipe-bootstrap-1",
  name: "Kartoffelgratin",
  source: {
    tier: "digitized_cookbook",
    originType: "cookbook",
    reference: "Professional reference",
    retrievedAt: "2026-08-17T10:00:00.000Z",
    approvalState: "review_required",
    qualityScore: 0.9,
    fitScore: 0.9,
    extractionCompleteness: 1
  },
  baseYield: { servings: 10, unit: "servings" },
  ingredients: [
    {
      ingredientId: "potato",
      name: "Kartoffeln",
      quantity: { amount: 1.5, unit: "kg" },
      group: "produce",
      normalizedUnit: "kg"
    }
  ],
  steps: [{ index: 1, instruction: "Vorbereiten und garen." }],
  scalingRules: { defaultLossFactor: 1 },
  allergens: [],
  dietTags: ["vegetarian"]
};

function withKnowledge(
  recipe: Recipe,
  overrides: Partial<NonNullable<Recipe["knowledge"]>> = {}
): Recipe {
  return {
    ...recipe,
    knowledge: {
      artifactKind: "transcribed_recipe",
      sourceCitation: { title: "Professional culinary reference" },
      derivation: { method: "direct_transcription" },
      production: {},
      verification: {
        sourceStatus: "verified",
        allergenStatus: "unverified",
        productionStatus: "unverified",
        verifiedBy: "Kitchen lead",
        verifiedAt: "2026-08-17T10:00:00.000Z"
      },
      version: { revision: 1 },
      ...overrides
    }
  };
}

const acceptedReview: RecipeEventUseReview = {
  eventSpecId: "spec-001",
  recipeId: "recipe-bootstrap-1",
  reviewedBy: "Kitchen lead",
  reviewedAt: "2026-08-17T10:15:00.000Z",
  decision: "accepted_for_event",
  confirmations: {
    quantitiesAndYield: true,
    methodAndEquipment: true,
    allergensAndDiet: true,
    holdingAndRegeneration: true
  }
};

describe("production knowledge foundation", () => {
  it("keeps historical recipes valid but not durably production-ready without knowledge metadata", () => {
    expect(validateRecipe(baseRecipe)).toEqual(baseRecipe);
    expect(evaluateRecipeKnowledgeMaturity(baseRecipe)).toEqual({
      status: "review_required",
      blockers: ["knowledge_missing"]
    });
  });

  it("treats a source fact as reference-only and never as an event recipe", () => {
    const recipe = withKnowledge(baseRecipe, {
      artifactKind: "source_fact"
    });

    expect(evaluateRecipeKnowledgeMaturity(recipe).status).toBe("reference_only");
    expect(evaluateRecipeEventUse({ recipe, eventSpecId: "spec-001" }).status).toBe("blocked");
  });

  it("does not promote an unverified cookbook transcription to durable production knowledge", () => {
    const recipe = withKnowledge(baseRecipe);
    expect(evaluateRecipeKnowledgeMaturity(recipe).status).toBe("review_required");
  });

  it("never treats an AI-derived candidate as durable production-ready knowledge", () => {
    const recipe = withKnowledge(
      {
        ...baseRecipe,
        source: { ...baseRecipe.source, approvalState: "approved_internal" }
      },
      {
        artifactKind: "ai_derived_candidate",
        derivation: { method: "ai_derivation" },
        verification: {
          sourceStatus: "verified",
          allergenStatus: "verified",
          productionStatus: "verified",
          verifiedBy: "Kitchen lead",
          verifiedAt: "2026-08-17T10:00:00.000Z"
        }
      }
    );

    expect(evaluateRecipeKnowledgeMaturity(recipe)).toEqual({
      status: "review_required",
      blockers: ["ai_candidate_not_durable"]
    });
  });

  it("marks a fully approved operational adaptation as durable production-ready knowledge", () => {
    const recipe = withKnowledge(
      {
        ...baseRecipe,
        source: { ...baseRecipe.source, approvalState: "approved_internal" }
      },
      {
        artifactKind: "operational_adaptation",
        derivation: { method: "human_adaptation" },
        verification: {
          sourceStatus: "verified",
          allergenStatus: "verified",
          productionStatus: "verified",
          verifiedBy: "Kitchen lead",
          verifiedAt: "2026-08-17T10:00:00.000Z"
        }
      }
    );

    expect(evaluateRecipeKnowledgeMaturity(recipe)).toEqual({
      status: "production_ready",
      blockers: []
    });
  });

  it("supports zero-seed startup by routing an AI candidate to kitchen review instead of a no-recipe failure", () => {
    const recipe = withKnowledge(baseRecipe, {
      artifactKind: "ai_derived_candidate",
      derivation: { method: "ai_derivation" }
    });

    expect(evaluateRecipeEventUse({ recipe, eventSpecId: "spec-001" })).toEqual({
      status: "kitchen_review_required",
      blockers: ["event_review_missing"]
    });
  });

  it("allows a candidate for one exact event after complete kitchen review without changing durable maturity", () => {
    const recipe = withKnowledge(baseRecipe, {
      artifactKind: "ai_derived_candidate",
      derivation: { method: "ai_derivation" }
    });
    const before = JSON.parse(JSON.stringify(recipe)) as Recipe;

    expect(validateRecipeEventUseReview(acceptedReview)).toEqual(acceptedReview);
    expect(evaluateRecipeEventUse({ recipe, eventSpecId: "spec-001", review: acceptedReview })).toEqual({
      status: "event_usable",
      blockers: []
    });
    expect(evaluateRecipeKnowledgeMaturity(recipe).status).toBe("review_required");
    expect(recipe).toEqual(before);
  });

  it("does not reuse event-specific acceptance for another event", () => {
    const recipe = withKnowledge(baseRecipe, {
      artifactKind: "ai_derived_candidate",
      derivation: { method: "ai_derivation" }
    });

    expect(evaluateRecipeEventUse({ recipe, eventSpecId: "spec-002", review: acceptedReview })).toEqual({
      status: "blocked",
      blockers: ["event_review_binding_mismatch"]
    });
  });

  it("requires every kitchen confirmation before a bootstrap candidate becomes event-usable", () => {
    const recipe = withKnowledge(baseRecipe, {
      artifactKind: "ai_derived_candidate",
      derivation: { method: "ai_derivation" }
    });
    const review: RecipeEventUseReview = {
      ...acceptedReview,
      confirmations: {
        ...acceptedReview.confirmations,
        allergensAndDiet: false
      }
    };

    expect(evaluateRecipeEventUse({ recipe, eventSpecId: "spec-001", review })).toEqual({
      status: "kitchen_review_required",
      blockers: ["allergens_and_diet_unconfirmed"]
    });
  });

  it("blocks an event-specific kitchen rejection", () => {
    const recipe = withKnowledge(baseRecipe, {
      artifactKind: "ai_derived_candidate",
      derivation: { method: "ai_derivation" }
    });
    const review: RecipeEventUseReview = {
      ...acceptedReview,
      decision: "rejected_for_event"
    };

    expect(evaluateRecipeEventUse({ recipe, eventSpecId: "spec-001", review })).toEqual({
      status: "blocked",
      blockers: ["event_review_rejected"]
    });
  });

  it("rejects malformed verification metadata instead of inventing reviewer evidence", () => {
    const recipe = withKnowledge(baseRecipe, {
      verification: {
        sourceStatus: "verified",
        allergenStatus: "unverified",
        productionStatus: "unverified"
      }
    });

    expect(() => validateRecipe(recipe)).toThrow(/verifiedBy|verifiedAt/);
  });

  it("rejects malformed knowledge quantities and revisions", () => {
    const recipe = withKnowledge(baseRecipe, {
      production: { prepLeadMinutes: -1 },
      version: { revision: 0 }
    });

    expect(() => validateRecipe(recipe)).toThrow(/validation/i);
  });
});
