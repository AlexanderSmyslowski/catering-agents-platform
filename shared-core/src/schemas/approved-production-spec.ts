export const approvedProductionSpecSchema = {
  $id: "https://schemas.catering.local/approved-production-spec.json",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "businessId",
    "approvedProductionSpecId",
    "sourceDraft",
    "approvalRequestId",
    "approvedAt",
    "artifacts"
  ],
  properties: {
    schemaVersion: { const: "1.0" },
    businessId: { type: "string", pattern: "^[a-z0-9][a-z0-9_-]{1,63}$" },
    approvedProductionSpecId: {
      type: "string",
      pattern: "^approved-production-spec-[a-f0-9]{64}$"
    },
    sourceDraft: {
      type: "object",
      additionalProperties: false,
      required: ["draftId", "revision"],
      properties: {
        draftId: { type: "string", minLength: 1, maxLength: 160, pattern: ".*\\S.*" },
        revision: { type: "integer", minimum: 1, maximum: 2147483647 }
      }
    },
    approvalRequestId: { type: "string", pattern: "^approval-[a-f0-9]{64}$" },
    approvedAt: { type: "string", format: "date-time", maxLength: 80 },
    artifacts: {
      type: "object",
      additionalProperties: false,
      required: ["eventSpec", "productionPlan", "purchaseList", "recipes"],
      properties: {
        eventSpec: { $ref: "https://schemas.catering.local/accepted-event-spec.json" },
        productionPlan: { $ref: "https://schemas.catering.local/production-plan.json" },
        purchaseList: { $ref: "https://schemas.catering.local/purchase-list.json" },
        recipes: {
          type: "array",
          maxItems: 200,
          items: { $ref: "https://schemas.catering.local/recipe.json" }
        }
      }
    }
  }
} as const;
