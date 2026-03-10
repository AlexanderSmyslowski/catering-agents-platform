export const offerDraftSchema = {
  $id: "https://schemas.catering.local/offer-draft.json",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "draftId",
    "eventSummary",
    "serviceModules",
    "pricingSummary",
    "assumptions",
    "openQuestions",
    "variantSet",
    "customerFacingText",
    "internalWorkingText",
    "proposedEventSpec"
  ],
  properties: {
    schemaVersion: { type: "string" },
    draftId: { type: "string" },
    eventSummary: { type: "string" },
    serviceModules: {
      type: "array",
      items: {
        $ref: "https://schemas.catering.local/common.json#/$defs/serviceModule"
      }
    },
    pricingSummary: {
      $ref: "https://schemas.catering.local/common.json#/$defs/pricingSummary"
    },
    assumptions: {
      type: "array",
      items: {
        $ref: "https://schemas.catering.local/common.json#/$defs/assumption"
      }
    },
    openQuestions: {
      type: "array",
      items: { type: "string" }
    },
    variantSet: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "variantId",
          "label",
          "qualityTier",
          "estimatedPrice",
          "moduleIds",
          "proposedEventSpec"
        ],
        properties: {
          variantId: { type: "string" },
          label: { type: "string" },
          qualityTier: { enum: ["economy", "standard", "premium"] },
          estimatedPrice: {
            $ref: "https://schemas.catering.local/common.json#/$defs/money"
          },
          moduleIds: {
            type: "array",
            items: { type: "string" }
          },
          proposedEventSpec: {
            $ref: "https://schemas.catering.local/accepted-event-spec.json"
          }
        }
      }
    },
    customerFacingText: { type: "string" },
    internalWorkingText: { type: "string" },
    proposedEventSpec: {
      $ref: "https://schemas.catering.local/accepted-event-spec.json"
    }
  }
} as const;

