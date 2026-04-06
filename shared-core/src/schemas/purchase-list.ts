export const purchaseListSchema = {
  $id: "https://schemas.catering.local/purchase-list.json",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "purchaseListId",
    "eventSpecId",
    "items",
    "groupingMode",
    "totals"
  ],
  properties: {
    schemaVersion: { type: "string" },
    purchaseListId: { type: "string" },
    eventSpecId: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "ingredientId",
          "displayName",
          "normalizedQty",
          "normalizedUnit",
          "purchaseQty",
          "purchaseUnit",
          "group",
          "sourceRecipes",
          "mappingConfidence"
        ],
        properties: {
          ingredientId: { type: "string" },
          displayName: { type: "string" },
          normalizedQty: { type: "number", minimum: 0 },
          normalizedUnit: { type: "string" },
          purchaseQty: { type: "number", minimum: 0 },
          purchaseUnit: { type: "string" },
          appliedPurchasingUnit: {
            $ref: "https://schemas.catering.local/common.json#/$defs/appliedPurchasingUnit"
          },
          group: { type: "string" },
          supplierHint: { type: "string" },
          sourceRecipes: {
            type: "array",
            items: { type: "string" }
          },
          mappingConfidence: { type: "number", minimum: 0, maximum: 1 }
        }
      }
    },
    groupingMode: { const: "group" },
    totals: {
      type: "object",
      additionalProperties: false,
      required: ["itemCount", "groups"],
      properties: {
        itemCount: { type: "integer", minimum: 0 },
        groups: {
          type: "array",
          items: { type: "string" }
        }
      }
    }
  }
} as const;
