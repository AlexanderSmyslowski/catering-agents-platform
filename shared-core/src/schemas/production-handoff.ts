export const productionHandoffSchema = {
  $id: "https://schemas.catering.local/production-handoff.json",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "businessId", "handoffId", "approvedOfferId", "approvalRequestId", "createdAt", "eventSpecSnapshot", "pricingSnapshot", "source"],
  properties: {
    schemaVersion: { const: "1.0" }, businessId: { type: "string", pattern: "^[a-z0-9][a-z0-9_-]{1,63}$" }, handoffId: { type: "string", pattern: "^handoff-[a-f0-9]{64}$" },
    approvedOfferId: { type: "string", pattern: "^approved-offer-[a-f0-9]{64}$" }, approvalRequestId: { type: "string", pattern: "^approval-[a-f0-9]{64}$" }, createdAt: { type: "string", format: "date-time" },
    eventSpecSnapshot: { $ref: "https://schemas.catering.local/accepted-event-spec.json" }, pricingSnapshot: { $ref: "https://schemas.catering.local/common.json#/$defs/pricingSummary" },
    source: { type: "object", additionalProperties: false, required: ["draftId", "revision", "selectedVariantId"], properties: { draftId: { type: "string", minLength: 1 }, revision: { type: "integer", minimum: 1 }, selectedVariantId: { type: "string", minLength: 1 } } }
  }
} as const;
