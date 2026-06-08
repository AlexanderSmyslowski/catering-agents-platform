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
          recipeSource: {
            $ref: "https://schemas.catering.local/common.json#/$defs/recipeSourceExportMetadata"
          },
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
        required: [
          "title",
          "instructions",
          "componentId",
          "productionQty",
          "station",
          "prepWindow",
          "ingredients",
          "steps"
        ],
        properties: {
          title: { type: "string" },
          instructions: {
            type: "array",
            items: { type: "string" }
          },
          componentId: { type: "string" },
          productionQty: {
            $ref: "https://schemas.catering.local/common.json#/$defs/quantity"
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
          },
          recipeId: { type: "string" },
          recipeSource: {
            $ref: "https://schemas.catering.local/common.json#/$defs/recipeSourceExportMetadata"
          },
          allergens: {
            type: "array",
            items: { type: "string" }
          },
          dietTags: {
            type: "array",
            items: { type: "string" }
          },
          procurementNotes: {
            type: "array",
            items: { type: "string" }
          },
          blockingNotes: {
            type: "array",
            items: { type: "string" }
          },
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
          searchTrace: {
            type: "array",
            items: { type: "string" }
          },
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
    componentReadiness: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "componentId",
          "label",
          "status",
          "reason",
          "hasProductionBatch",
          "hasKitchenSheet",
          "includedInPurchaseList",
          "blocksProduction"
        ],
        properties: {
          componentId: { type: "string" },
          label: { type: "string" },
          status: {
            enum: ["operational", "needs_clarification", "blocked"]
          },
          reason: { type: "string" },
          hasProductionBatch: { type: "boolean" },
          hasKitchenSheet: { type: "boolean" },
          includedInPurchaseList: { type: "boolean" },
          blocksProduction: { type: "boolean" }
        }
      }
    },
    unresolvedItems: {
      type: "array",
      items: { type: "string" }
    },
    isFallback: { type: "boolean" },
    fallbackReason: { type: "string" },
    warnings: {
      type: "array",
      items: { type: "string" }
    },
    blockingIssues: {
      type: "array",
      items: { type: "string" }
    }
  }
} as const;
