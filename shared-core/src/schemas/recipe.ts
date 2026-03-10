export const recipeSchema = {
  $id: "https://schemas.catering.local/recipe.json",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "recipeId",
    "name",
    "source",
    "baseYield",
    "ingredients",
    "steps",
    "scalingRules",
    "allergens",
    "dietTags"
  ],
  properties: {
    schemaVersion: { type: "string" },
    recipeId: { type: "string" },
    name: { type: "string" },
    source: {
      $ref: "https://schemas.catering.local/common.json#/$defs/recipeSource"
    },
    baseYield: {
      type: "object",
      additionalProperties: false,
      required: ["servings", "unit"],
      properties: {
        servings: { type: "integer", minimum: 1 },
        unit: { type: "string" }
      }
    },
    ingredients: {
      type: "array",
      minItems: 1,
      items: {
        $ref: "https://schemas.catering.local/common.json#/$defs/ingredientLine"
      }
    },
    steps: {
      type: "array",
      minItems: 1,
      items: {
        $ref: "https://schemas.catering.local/common.json#/$defs/recipeStep"
      }
    },
    scalingRules: {
      type: "object",
      additionalProperties: false,
      required: ["defaultLossFactor"],
      properties: {
        defaultLossFactor: { type: "number", minimum: 1 },
        batchSize: { type: "integer", minimum: 1 }
      }
    },
    allergens: {
      type: "array",
      items: { type: "string" }
    },
    dietTags: {
      type: "array",
      items: { type: "string" }
    }
  }
} as const;

