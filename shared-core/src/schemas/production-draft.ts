export const productionDraftSchema = {
  $id: "https://schemas.catering.local/production-draft.json",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "draftId",
    "status",
    "createdAt",
    "source",
    "guardrails",
    "reviewCards",
    "draftArtifacts"
  ],
  allOf: [
    {
      if: {
        required: ["source"],
        properties: {
          source: {
            required: ["kind"],
            properties: {
              kind: { enum: ["ai_provider", "agent_cli", "local_provider"] }
            }
          }
        }
      },
      then: {
        properties: {
          source: {
            required: ["providerId", "modelId", "inputHash", "outputHash"]
          }
        }
      }
    },
    {
      if: {
        required: ["status"],
        properties: {
          status: { const: "approved" }
        }
      },
      then: {
        required: ["approvedBy", "approvedAt"]
      }
    }
  ],
  properties: {
    schemaVersion: { type: "string", maxLength: 32 },
    draftId: { type: "string", maxLength: 160 },
    status: {
      enum: ["pending_review", "approved", "rejected", "superseded"]
    },
    createdAt: { type: "string", maxLength: 80 },
    supersedesDraftId: { type: "string", maxLength: 160 },
    approvedBy: { type: "string", maxLength: 160 },
    approvedAt: { type: "string", maxLength: 80 },
    appliedBy: { type: "string", maxLength: 160 },
    appliedAt: { type: "string", maxLength: 80 },
    appliedArtifactIds: {
      type: "object",
      additionalProperties: false,
      properties: {
        specId: { type: "string", maxLength: 160 },
        planId: { type: "string", maxLength: 160 },
        purchaseListId: { type: "string", maxLength: 160 }
      }
    },
    source: {
      type: "object",
      additionalProperties: false,
      required: ["kind", "receivedAt"],
      properties: {
        kind: {
          enum: ["fixture", "manual_import", "ai_provider", "agent_cli", "local_provider"]
        },
        receivedAt: { type: "string", maxLength: 80 },
        sourceRef: { type: "string", maxLength: 500 },
        providerId: { type: "string", maxLength: 120 },
        modelId: { type: "string", maxLength: 160 },
        inputHash: { type: "string", maxLength: 160 },
        outputHash: { type: "string", maxLength: 160 },
        runId: { type: "string", maxLength: 160 }
      }
    },
    guardrails: {
      type: "object",
      additionalProperties: false,
      required: [
        "draftOnly",
        "humanApprovalRequired",
        "writesProductObjects",
        "rawProviderPayloadStored",
        "knowledgeWritePolicy"
      ],
      properties: {
        draftOnly: { const: true },
        humanApprovalRequired: { const: true },
        writesProductObjects: { const: false },
        rawProviderPayloadStored: { const: false },
        knowledgeWritePolicy: {
          enum: ["none", "reviewed_only"]
        }
      }
    },
    reviewCards: {
      type: "array",
      minItems: 1,
      maxItems: 200,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["cardId", "kind", "title", "summary", "decision"],
        properties: {
          cardId: { type: "string", maxLength: 160 },
          kind: {
            enum: [
              "event_data",
              "menu_component",
              "recipe",
              "quantity",
              "purchase_item",
              "mise_en_place",
              "timeline",
              "risk",
              "open_question",
              "source_note"
            ]
          },
          decision: {
            enum: ["pending", "fits", "change_requested", "unclear", "blocked"]
          },
          title: { type: "string", maxLength: 160 },
          summary: { type: "string", maxLength: 1000 },
          targetPath: { type: "string", maxLength: 240 },
          targetId: { type: "string", maxLength: 160 },
          riskLevel: {
            enum: ["low", "medium", "high", "blocking"]
          },
          requiredApproval: { type: "boolean" },
          operatorComment: { type: "string", maxLength: 1000 },
          decidedBy: { type: "string", maxLength: 160 },
          decidedAt: { type: "string", maxLength: 80 }
        }
      }
    },
    draftArtifacts: {
      type: "object",
      additionalProperties: false,
      properties: {
        eventSpec: {
          $ref: "https://schemas.catering.local/accepted-event-spec.json"
        },
        productionPlan: {
          $ref: "https://schemas.catering.local/production-plan.json"
        },
        purchaseList: {
          $ref: "https://schemas.catering.local/purchase-list.json"
        },
        recipes: {
          type: "array",
          items: {
            $ref: "https://schemas.catering.local/recipe.json"
          }
        },
        openQuestions: {
          type: "array",
          items: {
            $ref: "https://schemas.catering.local/common.json#/$defs/uncertainty"
          }
        },
        notes: {
          type: "array",
          maxItems: 50,
          items: { type: "string", maxLength: 1000 }
        }
      },
      anyOf: [
        { required: ["eventSpec"] },
        { required: ["productionPlan"] },
        { required: ["purchaseList"] },
        {
          required: ["recipes"],
          properties: {
            recipes: { minItems: 1 }
          }
        },
        {
          required: ["openQuestions"],
          properties: {
            openQuestions: { minItems: 1 }
          }
        }
      ]
    }
  }
} as const;
