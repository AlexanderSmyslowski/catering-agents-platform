export const productionPlanSchema = {
  $id: "https://schemas.catering.local/production-plan.json",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "planId",
    "eventSpecId",
    "readiness",
    "productionBatches",
    "timeline",
    "kitchenSheets",
    "recipeSelections",
    "unresolvedItems"
  ],
  properties: {
    schemaVersion: { type: "string" },
    planId: { type: "string" },
    eventSpecId: { type: "string" },
    readiness: {
      $ref: "https://schemas.catering.local/common.json#/$defs/readiness"
    },
    productionBatches: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "batchId",
          "componentId",
          "recipeId",
          "scaledYield",
          "batchCount",
          "lossFactor",
          "gnPlan",
          "station",
          "prepWindow",
          "ingredients",
          "steps"
        ],
        properties: {
          batchId: { type: "string" },
          componentId: { type: "string" },
          recipeId: { type: "string" },
          scaledYield: {
            $ref: "https://schemas.catering.local/common.json#/$defs/quantity"
          },
          batchCount: { type: "integer", minimum: 1 },
          lossFactor: { type: "number", minimum: 1 },
          gnPlan: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["container", "count"],
              properties: {
                container: { type: "string" },
                count: { type: "integer", minimum: 1 }
              }
            }
          },
          station: { type: "string" },
          prepWindow: { type: "string" },
          ingredients: {
            type: "array",
            items: {
              $ref: "https://schemas.catering.local/common.json#/$defs/ingredientLine"
            }
          },
          steps: {
            type: "array",
            items: {
              $ref: "https://schemas.catering.local/common.json#/$defs/recipeStep"
            }
          }
        }
      }
    },
    timeline: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "at"],
        properties: {
          label: { type: "string" },
          at: { type: "string" }
        }
      }
    },
    kitchenSheets: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "instructions"],
        properties: {
          title: { type: "string" },
          instructions: {
            type: "array",
            items: { type: "string" }
          }
        }
      }
    },
    recipeSelections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "componentId",
          "selectionReason",
          "autoUsedInternetRecipe"
        ],
        properties: {
          componentId: { type: "string" },
          recipeId: { type: "string" },
          selectionReason: { type: "string" },
          searchQuery: { type: "string" },
          autoUsedInternetRecipe: { type: "boolean" },
          sourceTier: {
            enum: [
              "internal_verified",
              "digitized_cookbook",
              "internal_approved",
              "internet_fallback"
            ]
          },
          qualityScore: { type: "number", minimum: 0, maximum: 1 },
          fitScore: { type: "number", minimum: 0, maximum: 1 }
        }
      }
    },
    unresolvedItems: {
      type: "array",
      items: { type: "string" }
    }
  }
} as const;

