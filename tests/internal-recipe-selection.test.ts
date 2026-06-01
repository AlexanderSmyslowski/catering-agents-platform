import { describe, expect, it } from "vitest";
import type {
  AcceptedEventSpec,
  MenuComponent,
  Recipe
} from "../shared-core/src/index.js";
import { SCHEMA_VERSION } from "../shared-core/src/index.js";
import {
  buildInternalRecipeCandidate,
  compareInternalRecipeCandidates,
  internalRecipeCandidatePassesThresholds,
  selectInternalRecipeCandidate
} from "../production-service/src/recipe-discovery/internal-recipe-selection.js";

function buildComponent(overrides: Partial<MenuComponent> = {}): MenuComponent {
  return {
    componentId: "component-tomato-soup",
    label: "Tomatensuppe",
    menuCategory: "vegetarian",
    serviceStyle: "buffet",
    ...overrides
  };
}

function buildEventSpec(): AcceptedEventSpec {
  return {
    schemaVersion: SCHEMA_VERSION,
    specId: "spec-internal-recipe-selection",
    requestId: "request-internal-recipe-selection",
    acceptedAt: "2026-05-31T08:00:00.000Z",
    sourceRequestId: "request-internal-recipe-selection",
    attendees: { expected: 20 },
    servicePlan: {
      eventType: "Lunch",
      serviceForm: "buffet",
      modules: [],
      pricing: {
        subtotal: { amount: 0, currency: "EUR" }
      }
    },
    menuPlan: [],
    assumptions: [],
    missingFields: [],
    productionConstraints: []
  } as unknown as AcceptedEventSpec;
}

function buildRecipe(overrides: {
  recipeId: string;
  name: string;
  tier?: Recipe["source"]["tier"];
  reference?: string;
  ingredients?: string[];
  dietTags?: string[];
}): Recipe {
  return {
    schemaVersion: SCHEMA_VERSION,
    recipeId: overrides.recipeId,
    name: overrides.name,
    source: {
      tier: overrides.tier ?? "internal_approved",
      originType: "internal_db",
      reference: overrides.reference ?? `house:${overrides.recipeId}`,
      retrievedAt: "2026-05-31T08:00:00.000Z",
      approvalState: "approved_internal",
      qualityScore: 0.9,
      fitScore: 0.9,
      extractionCompleteness: 1
    },
    baseYield: {
      servings: 10,
      unit: "servings"
    },
    ingredients: (overrides.ingredients ?? ["Tomaten", "Zwiebeln", "Gemüsebrühe"]).map((name, index) => ({
      ingredientId: `ingredient-${index}`,
      name,
      quantity: { amount: 1, unit: "kg" },
      group: "produce"
    })),
    steps: [
      {
        index: 1,
        instruction: "Vorbereiten."
      }
    ],
    scalingRules: {
      defaultLossFactor: 1.05
    },
    allergens: [],
    dietTags: overrides.dietTags ?? ["vegetarian"]
  };
}

describe("internal recipe selection", () => {
  it("builds candidate scores from one shared recipe search text", () => {
    const component = buildComponent();
    const eventSpec = buildEventSpec();
    const recipe = buildRecipe({
      recipeId: "recipe-tomato-soup-candidate",
      name: "Tomatensuppe Hausstandard",
      tier: "internal_verified"
    });

    const candidate = buildInternalRecipeCandidate({
      recipe,
      repositoryRank: 3,
      component,
      eventSpec
    });

    expect(candidate.recipe).toBe(recipe);
    expect(candidate.repositoryRank).toBe(3);
    expect(candidate.fitScore).toBeGreaterThanOrEqual(0.75);
    expect(candidate.primaryScore).toBeGreaterThanOrEqual(0.5);
    expect(candidate.specificPrimaryScore).toBeGreaterThanOrEqual(0.34);
    expect(candidate.leadNameScore).toBe(1);
  });

  it("keeps candidate thresholds explicit for the normal and lead-name fallback paths", () => {
    const component = buildComponent();
    const eventSpec = buildEventSpec();
    const candidate = buildInternalRecipeCandidate({
      recipe: buildRecipe({
        recipeId: "recipe-threshold-tomato-soup",
        name: "Tomatensuppe Hausstandard",
        tier: "internal_verified"
      }),
      repositoryRank: 0,
      component,
      eventSpec
    });

    expect(internalRecipeCandidatePassesThresholds(candidate)).toBe(true);
    expect(
      internalRecipeCandidatePassesThresholds({
        ...candidate,
        repositoryRank: 3,
        fitScore: 0.54,
        primaryScore: 0.49,
        specificPrimaryScore: 0.33,
        leadNameScore: 0
      })
    ).toBe(false);
    expect(
      internalRecipeCandidatePassesThresholds({
        ...candidate,
        repositoryRank: 0,
        fitScore: 0.55,
        primaryScore: 0,
        specificPrimaryScore: 0,
        leadNameScore: 1
      })
    ).toBe(true);
  });

  it("keeps internal tier priority ahead of repository rank when candidates pass the existing thresholds", () => {
    const component = buildComponent();
    const eventSpec = buildEventSpec();
    const approved = buildRecipe({
      recipeId: "recipe-approved-tomato-soup",
      name: "Tomatensuppe Hausstandard",
      tier: "internal_approved"
    });
    const verified = buildRecipe({
      recipeId: "recipe-verified-tomato-soup",
      name: "Tomatensuppe Bankett",
      tier: "internal_verified"
    });

    const selected = selectInternalRecipeCandidate([approved, verified], component, eventSpec);

    expect(selected?.recipe).toBe(verified);
    expect(selected?.repositoryRank).toBe(1);
    expect(selected?.fitScore).toBeGreaterThanOrEqual(0.75);

    const approvedCandidate = buildInternalRecipeCandidate({
      recipe: approved,
      repositoryRank: 0,
      component,
      eventSpec
    });
    const verifiedCandidate = buildInternalRecipeCandidate({
      recipe: verified,
      repositoryRank: 1,
      component,
      eventSpec
    });

    expect(compareInternalRecipeCandidates(approvedCandidate, verifiedCandidate)).toBeGreaterThan(0);
  });

  it("keeps repository rank ahead of score for candidates in the same source tier", () => {
    const component = buildComponent();
    const eventSpec = buildEventSpec();
    const first = buildRecipe({
      recipeId: "recipe-first-tomato-soup",
      name: "Tomatensuppe",
      tier: "internal_verified",
      ingredients: ["Tomaten"]
    });
    const later = buildRecipe({
      recipeId: "recipe-later-tomato-soup",
      name: "Tomatensuppe mit Tomaten und Gemüsebrühe",
      tier: "internal_verified",
      ingredients: ["Tomaten", "Gemüsebrühe", "Basilikum", "Zwiebeln"]
    });

    const selected = selectInternalRecipeCandidate([first, later], component, eventSpec);

    expect(selected?.recipe).toBe(first);
    expect(selected?.repositoryRank).toBe(0);
  });

  it("uses the existing lead-name fallback for the top repository candidate", () => {
    const component = buildComponent({
      componentId: "component-focaccia",
      label: "Focaccia deluxe",
      menuCategory: "vegetarian"
    });
    const eventSpec = buildEventSpec();
    const focaccia = buildRecipe({
      recipeId: "recipe-focaccia",
      name: "Focaccia",
      tier: "internal_approved",
      reference: "house:focaccia",
      ingredients: ["Mehl", "Olivenöl", "Rosmarin"]
    });

    const selected = selectInternalRecipeCandidate([focaccia], component, eventSpec);

    expect(selected?.recipe).toBe(focaccia);
    expect(selected?.leadNameScore).toBe(1);
  });

  it("filters internal recipes that do not support the requested menu category", () => {
    const component = buildComponent({ menuCategory: "vegetarian" });
    const eventSpec = buildEventSpec();
    const meatRecipe = buildRecipe({
      recipeId: "recipe-chicken-soup",
      name: "Tomatensuppe mit Chicken",
      tier: "internal_verified",
      ingredients: ["Tomaten", "Chicken"],
      dietTags: []
    });

    const selected = selectInternalRecipeCandidate([meatRecipe], component, eventSpec);

    expect(selected).toBeUndefined();
  });
});
