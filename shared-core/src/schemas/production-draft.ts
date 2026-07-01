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
  properties: {
    schemaVersion: { type: "string" },
    draftId: { type: "string" },
    status: {
      enum: ["pending_review", "approved", "rejected", "superseded"]
    },
    createdAt: { type: "string" },
    supersedesDraftId: { type: "string" },
    source: {
      type: "object",
      additionalProperties: false,
      required: ["kind", "receivedAt"],
      properties: {
        kind: {
          enum: ["fixture", "manual_import", "ai_provider", "agent_cli", "local_provider"]
        },
        receivedAt: { type: "string" },
        sourceRef: { type: "string" },
        providerId: { type: "string" },
        modelId: { type: "string" },
        inputHash: { type: "string" },
        outputHash: { type: "string" },
        runId: { type: "string" }
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
      items: {
        type: "object",
        additionalProperties: false,
        required: ["cardId", "kind", "title", "summary", "decision"],
        properties: {
          cardId: { type: "string" },
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
          title: { type: "string" },
          summary: { type: "string" },
          decision: {
            enum: ["pending", "fits", "change_requested", "unclear", "blocked"]
          },
          targetPath: { type: "string" },
          targetId: { type: "string" },
          riskLevel: {
            enum: ["low", "medium", "high", "blocking"]
          },
          requiredApproval: { type: "boolean" },
          operatorComment: { type: "string" }
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
          items: { type: "string" }
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
        },
        {
          required: ["notes"],
          properties: {
            notes: { minItems: 1 }
          }
        }
      ]
    }
  }
} as const;
