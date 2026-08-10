export const approvedOfferSchema = {
  $id: "https://schemas.catering.local/approved-offer.json",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "businessId", "approvedOfferId", "sourceDraft", "selectedVariantId", "approvalRequestId", "approvedAt", "eventSummary", "customerFacingText", "serviceModules", "pricingSummary", "selectedVariant"],
  properties: {
    schemaVersion: { const: "1.0" }, businessId: { type: "string", pattern: "^[a-z0-9][a-z0-9_-]{1,63}$" },
    approvedOfferId: { type: "string", pattern: "^approved-offer-[a-f0-9]{64}$" },
    sourceDraft: { type: "object", additionalProperties: false, required: ["draftId", "revision"], properties: { draftId: { type: "string", minLength: 1 }, revision: { type: "integer", minimum: 1 } } },
    selectedVariantId: { type: "string", minLength: 1 }, approvalRequestId: { type: "string", pattern: "^approval-[a-f0-9]{64}$" }, approvedAt: { type: "string", format: "date-time" },
    eventSummary: { type: "string" }, customerFacingText: { type: "string" },
    serviceModules: { type: "array", items: { $ref: "https://schemas.catering.local/common.json#/$defs/serviceModule" } },
    pricingSummary: { $ref: "https://schemas.catering.local/common.json#/$defs/pricingSummary" },
    selectedVariant: { type: "object", additionalProperties: false, required: ["variantId", "label", "qualityTier", "estimatedPrice", "moduleIds", "proposedEventSpec"], properties: {
      variantId: { type: "string" }, label: { type: "string" }, qualityTier: { enum: ["economy", "standard", "premium"] },
      estimatedPrice: { $ref: "https://schemas.catering.local/common.json#/$defs/money" }, moduleIds: { type: "array", items: { type: "string" } }, proposedEventSpec: { $ref: "https://schemas.catering.local/accepted-event-spec.json" }
    } }
  }
} as const;
