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
    },
    knowledge: {
      type: "object",
      additionalProperties: false,
      required: [
        "artifactKind",
        "sourceCitation",
        "derivation",
        "production",
        "verification",
        "version"
      ],
      properties: {
        artifactKind: {
          enum: [
            "source_fact",
            "transcribed_recipe",
            "operational_adaptation",
            "ai_derived_candidate"
          ]
        },
        sourceCitation: {
          type: "object",
          additionalProperties: false,
          required: ["title"],
          properties: {
            title: { type: "string", minLength: 1 },
            author: { type: "string" },
            edition: { type: "string" },
            publisher: { type: "string" },
            location: { type: "string" },
            sourceUrl: { type: "string", format: "uri" }
          }
        },
        derivation: {
          type: "object",
          additionalProperties: false,
          required: ["method"],
          properties: {
            basedOnRecipeId: { type: "string" },
            method: {
              enum: [
                "direct_transcription",
                "human_adaptation",
                "ai_derivation",
                "internal_original"
              ]
            },
            notes: { type: "string" }
          }
        },
        production: {
          type: "object",
          additionalProperties: false,
          properties: {
            yieldLossPercent: { type: "number", minimum: 0 },
            prepLeadMinutes: { type: "number", minimum: 0 },
            holdMinutes: { type: "number", minimum: 0 },
            regenerationInstructions: { type: "string" },
            equipmentNotes: {
              type: "array",
              items: { type: "string" }
            },
            criticalParameters: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["name", "value"],
                properties: {
                  name: { type: "string", minLength: 1 },
                  value: { type: ["number", "string"] },
                  unit: { type: "string" }
                }
              }
            }
          }
        },
        verification: {
          type: "object",
          additionalProperties: false,
          required: ["sourceStatus", "allergenStatus", "productionStatus"],
          properties: {
            sourceStatus: { enum: ["verified", "unverified"] },
            allergenStatus: { enum: ["verified", "unverified"] },
            productionStatus: { enum: ["verified", "unverified"] },
            verifiedBy: { type: "string", minLength: 1 },
            verifiedAt: { type: "string", format: "date-time" }
          },
          allOf: [
            {
              if: {
                anyOf: [
                  { properties: { sourceStatus: { const: "verified" } }, required: ["sourceStatus"] },
                  { properties: { allergenStatus: { const: "verified" } }, required: ["allergenStatus"] },
                  { properties: { productionStatus: { const: "verified" } }, required: ["productionStatus"] }
                ]
              },
              then: { required: ["verifiedBy", "verifiedAt"] }
            }
          ]
        },
        version: {
          type: "object",
          additionalProperties: false,
          required: ["revision"],
          properties: {
            revision: { type: "integer", minimum: 1 },
            supersedesRecipeId: { type: "string" }
          }
        }
      }
    }
  }
} as const;
