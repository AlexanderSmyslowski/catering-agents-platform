export const commonSchema = {
  $id: "https://schemas.catering.local/common.json",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $defs: {
    money: {
      type: "object",
      additionalProperties: false,
      required: ["amount", "currency"],
      properties: {
        amount: { type: "number" },
        currency: { type: "string", minLength: 3 }
      }
    },
    quantity: {
      type: "object",
      additionalProperties: false,
      required: ["amount", "unit"],
      properties: {
        amount: { type: "number" },
        unit: { type: "string" },
        approx: { type: "boolean" }
      }
    },
    evidence: {
      type: "object",
      additionalProperties: false,
      required: ["kind", "sourceId", "confidence"],
      properties: {
        kind: { enum: ["text_excerpt", "document_ref", "inferred"] },
        sourceId: { type: "string" },
        excerpt: { type: "string" },
        confidence: { type: "number", minimum: 0, maximum: 1 }
      }
    },
    assumption: {
      type: "object",
      additionalProperties: false,
      required: ["code", "message", "applied"],
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        applied: { type: "boolean" }
      }
    },
    uncertainty: {
      type: "object",
      additionalProperties: false,
      required: ["field", "message", "severity"],
      properties: {
        field: { type: "string" },
        message: { type: "string" },
        severity: { enum: ["low", "medium", "high"] },
        suggestedQuestion: { type: "string" }
      }
    },
    readiness: {
      type: "object",
      additionalProperties: false,
      required: ["status", "reasons"],
      properties: {
        status: { enum: ["complete", "partial", "insufficient"] },
        reasons: {
          type: "array",
          items: { type: "string" }
        }
      }
    },
    customer: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string" },
        segment: {
          enum: ["company", "university", "public", "private", "unknown"]
        },
        contactName: { type: "string" },
        email: { type: "string", format: "email" },
        phone: { type: "string" }
      }
    },
    eventScheduleItem: {
      type: "object",
      additionalProperties: false,
      required: ["label"],
      properties: {
        label: { type: "string" },
        start: { type: "string" },
        end: { type: "string" }
      }
    },
    eventInfo: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        type: { type: "string" },
        date: { type: "string" },
        durationHours: { type: "number", minimum: 0 },
        schedule: {
          type: "array",
          items: { $ref: "#/$defs/eventScheduleItem" }
        },
        style: { type: "string" },
        atmosphere: { type: "string" },
        locale: { type: "string" },
        serviceForm: { type: "string" }
      }
    },
    attendees: {
      type: "object",
      additionalProperties: false,
      properties: {
        expected: { type: "integer", minimum: 0 },
        guaranteed: { type: "integer", minimum: 0 },
        dietaryMix: {
          type: "object",
          additionalProperties: { type: "integer", minimum: 0 }
        }
      }
    },
    venue: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string" },
        address: { type: "string" },
        indoor: { type: "boolean" },
        kitchenAccess: { type: "boolean" }
      }
    },
    cateringRequirement: {
      type: "object",
      additionalProperties: false,
      required: ["label", "category"],
      properties: {
        label: { type: "string" },
        category: { type: "string" },
        quantity: { $ref: "#/$defs/quantity" },
        dietaryTags: {
          type: "array",
          items: { type: "string" }
        }
      }
    },
    infrastructureRequirement: {
      type: "object",
      additionalProperties: false,
      required: ["code", "label"],
      properties: {
        code: { type: "string" },
        label: { type: "string" },
        quantity: { type: "integer", minimum: 0 },
        derived: { type: "boolean" }
      }
    },
    serviceModule: {
      type: "object",
      additionalProperties: false,
      required: ["moduleId", "label", "category"],
      properties: {
        moduleId: { type: "string" },
        label: { type: "string" },
        category: { type: "string" },
        quantity: { type: "integer", minimum: 0 },
        pricing: { $ref: "#/$defs/money" },
        notes: {
          type: "array",
          items: { type: "string" }
        }
      }
    },
    menuComponent: {
      type: "object",
      additionalProperties: false,
      required: ["componentId", "label"],
      properties: {
        componentId: { type: "string" },
        label: { type: "string" },
        course: { type: "string" },
        menuCategory: { enum: ["classic", "vegetarian", "vegan"] },
        serviceStyle: { type: "string" },
        desiredRecipeTags: {
          type: "array",
          items: { type: "string" }
        },
        servings: { type: "integer", minimum: 0 },
        dietaryTags: {
          type: "array",
          items: { type: "string" }
        },
        productionDecision: {
          type: "object",
          additionalProperties: false,
          properties: {
            mode: {
              enum: ["scratch", "hybrid", "convenience_purchase", "external_finished"]
            },
            purchasedElements: {
              type: "array",
              items: { type: "string" }
            },
            notes: { type: "string" }
          }
        }
      }
    },
    pricingSummary: {
      type: "object",
      additionalProperties: false,
      required: ["subtotal"],
      properties: {
        subtotal: { $ref: "#/$defs/money" },
        perPerson: { $ref: "#/$defs/money" },
        notes: {
          type: "array",
          items: { type: "string" }
        }
      }
    },
    sourceLineage: {
      type: "object",
      additionalProperties: false,
      required: ["sourceType", "reference"],
      properties: {
        sourceType: {
          enum: ["offer_service", "manual_input", "pdf", "email", "web_import"]
        },
        reference: { type: "string" }
      }
    },
    ingredientLine: {
      type: "object",
      additionalProperties: false,
      required: ["ingredientId", "name", "quantity", "group"],
      properties: {
        ingredientId: { type: "string" },
        name: { type: "string" },
        quantity: { $ref: "#/$defs/quantity" },
        group: { type: "string" },
        purchaseUnit: { type: "string" },
        normalizedUnit: { type: "string" }
      }
    },
    recipeStep: {
      type: "object",
      additionalProperties: false,
      required: ["index", "instruction"],
      properties: {
        index: { type: "integer", minimum: 1 },
        instruction: { type: "string" },
        durationMinutes: { type: "integer", minimum: 0 }
      }
    },
    recipeSource: {
      type: "object",
      additionalProperties: false,
      required: [
        "tier",
        "originType",
        "reference",
        "retrievedAt",
        "approvalState",
        "qualityScore",
        "fitScore",
        "extractionCompleteness"
      ],
      properties: {
        tier: {
          enum: [
            "internal_verified",
            "digitized_cookbook",
            "internal_approved",
            "internet_fallback"
          ]
        },
        originType: {
          enum: ["internal_db", "cookbook", "approved_import", "web"]
        },
        reference: { type: "string" },
        url: { type: "string" },
        publisher: { type: "string" },
        retrievedAt: { type: "string" },
        approvalState: {
          enum: [
            "approved_internal",
            "auto_usable",
            "review_required",
            "rejected"
          ]
        },
        qualityScore: { type: "number", minimum: 0, maximum: 1 },
        fitScore: { type: "number", minimum: 0, maximum: 1 },
        extractionCompleteness: { type: "number", minimum: 0, maximum: 1 },
        licenseNote: { type: "string" }
      }
    }
  }
} as const;
