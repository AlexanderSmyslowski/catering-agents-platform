export const offerDraftSchema = {
  $id: "https://schemas.catering.local/offer-draft.json",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "businessId",
    "draftId",
    "revision",
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
    businessId: { type: "string", pattern: "^[a-z0-9][a-z0-9_-]{1,63}$" },
    draftId: { type: "string" },
    revision: { type: "integer", minimum: 1, maximum: 2147483647 },
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
    },
    portfolioMapping: {
      type: "object",
      additionalProperties: false,
      required: ["packageId", "packageName", "source", "workingBandPerPerson"],
      properties: {
        packageId: { type: "string" },
        packageName: { type: "string" },
        source: { enum: ["curated_app_transfer"] },
        minPax: { type: "number" },
        workingBandPerPerson: {
          type: "object",
          additionalProperties: false,
          required: ["from", "to", "currency"],
          properties: {
            from: { type: "number" },
            to: { type: "number" },
            currency: { type: "string" }
          }
        },
        evidenceSummary: { type: "string" }
      }
    },
    reviewStatus: {
      type: "object",
      additionalProperties: false,
      required: [
        "priceReviewStatus",
        "taxReviewStatus",
        "allergenReviewStatus",
        "hygieneTemperatureReviewStatus",
        "sourceSecured",
        "publishApproved"
      ],
      properties: {
        priceReviewStatus: { enum: ["verified", "review_required"] },
        taxReviewStatus: { enum: ["verified", "review_required"] },
        allergenReviewStatus: { enum: ["verified", "review_required"] },
        hygieneTemperatureReviewStatus: { enum: ["verified", "review_required"] },
        sourceSecured: { type: "boolean" },
        publishApproved: { type: "boolean" }
      }
    }
  }
} as const;
