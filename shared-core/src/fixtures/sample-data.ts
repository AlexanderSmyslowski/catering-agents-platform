import type { Recipe } from "../types.js";
import { SCHEMA_VERSION } from "../types.js";

export const internalRecipes: Recipe[] = [
  {
    schemaVersion: SCHEMA_VERSION,
    recipeId: "recipe-filter-coffee",
    name: "Filterkaffee Station",
    source: {
      tier: "internal_verified",
      originType: "internal_db",
      reference: "house:coffee-station",
      retrievedAt: new Date("2026-03-10T00:00:00.000Z").toISOString(),
      approvalState: "approved_internal",
      qualityScore: 0.98,
      fitScore: 0.92,
      extractionCompleteness: 1
    },
    baseYield: {
      servings: 10,
      unit: "servings"
    },
    ingredients: [
      {
        ingredientId: "coffee-ground",
        name: "Ground Coffee",
        quantity: { amount: 600, unit: "g" },
        group: "beverages",
        purchaseUnit: "kg",
        normalizedUnit: "g"
      },
      {
        ingredientId: "water",
        name: "Water",
        quantity: { amount: 10, unit: "l" },
        group: "beverages",
        purchaseUnit: "l",
        normalizedUnit: "l"
      },
      {
        ingredientId: "milk",
        name: "Milk",
        quantity: { amount: 1.5, unit: "l" },
        group: "dairy",
        purchaseUnit: "l",
        normalizedUnit: "l"
      }
    ],
    steps: [
      { index: 1, instruction: "Prepare coffee urns and filters." },
      { index: 2, instruction: "Brew fresh batches every 30 minutes." },
      { index: 3, instruction: "Set milk and sugar on the station." }
    ],
    scalingRules: {
      defaultLossFactor: 1.05,
      batchSize: 20
    },
    allergens: ["milk"],
    allergenStatus: "known",
    dietTags: ["vegetarian", "gluten_free"]
  },
  {
    schemaVersion: SCHEMA_VERSION,
    recipeId: "recipe-caesar-salad",
    name: "Caesar Salad Buffet",
    source: {
      tier: "internal_verified",
      originType: "internal_db",
      reference: "house:caesar-salad",
      retrievedAt: new Date("2026-03-10T00:00:00.000Z").toISOString(),
      approvalState: "approved_internal",
      qualityScore: 0.96,
      fitScore: 0.9,
      extractionCompleteness: 1
    },
    baseYield: {
      servings: 10,
      unit: "servings"
    },
    ingredients: [
      {
        ingredientId: "romaine",
        name: "Romaine Lettuce",
        quantity: { amount: 1.2, unit: "kg" },
        group: "produce",
        purchaseUnit: "kg",
        normalizedUnit: "kg"
      },
      {
        ingredientId: "parmesan",
        name: "Parmesan",
        quantity: { amount: 250, unit: "g" },
        group: "dairy",
        purchaseUnit: "kg",
        normalizedUnit: "g"
      },
      {
        ingredientId: "croutons",
        name: "Croutons",
        quantity: { amount: 350, unit: "g" },
        group: "bakery",
        purchaseUnit: "kg",
        normalizedUnit: "g"
      }
    ],
    steps: [
      { index: 1, instruction: "Wash and cut lettuce." },
      { index: 2, instruction: "Mix dressing and parmesan separately." },
      { index: 3, instruction: "Assemble buffet bowls shortly before service." }
    ],
    scalingRules: {
      defaultLossFactor: 1.08,
      batchSize: 25
    },
    allergens: ["milk", "gluten"],
    allergenStatus: "known",
    dietTags: ["vegetarian"]
  }
];
