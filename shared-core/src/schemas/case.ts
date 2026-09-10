import { byoLlmDataClasses } from "../data-classification.js";

const businessId = { type: "string", pattern: "^[a-z0-9][a-z0-9_-]{1,63}$" } as const;
const identifier = { type: "string", minLength: 1, maxLength: 240 } as const;
const timestamp = { type: "string", format: "date-time", maxLength: 80 } as const;

const caseBaseRequired = [
  "schemaVersion",
  "businessId",
  "caseId",
  "displayName",
  "status",
  "version",
  "createdAt",
  "updatedAt",
  "product"
] as const;

const caseBaseProperties = {
  schemaVersion: { const: "1.0" },
  businessId,
  caseId: identifier,
  displayName: { type: "string", minLength: 1, maxLength: 320 },
  status: { enum: ["open", "completed", "archived"] },
  version: { type: "integer", minimum: 1, maximum: 2_147_483_647 },
  createdAt: timestamp,
  updatedAt: timestamp,
  copiedFromCaseId: identifier
} as const;

export const caseSchema = {
  $id: "https://schemas.catering.local/case.json",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $defs: {
    caseSourceRef: {
      type: "object",
      additionalProperties: false,
      required: ["sourceId", "dataClass", "addedAt"],
      properties: {
        sourceId: identifier,
        documentId: identifier,
        requestId: identifier,
        filename: { type: "string", minLength: 1, maxLength: 512 },
        mimeType: { type: "string", minLength: 1, maxLength: 160 },
        sha256: { type: "string", pattern: "^[a-f0-9]{64}$" },
        dataClass: { enum: byoLlmDataClasses },
        addedAt: timestamp
      }
    },
    caseRevisionRef: {
      type: "object",
      additionalProperties: false,
      required: ["artifactType", "artifactId", "revision", "createdAt"],
      properties: {
        artifactType: { enum: ["OfferDraft", "ProductionDraft"] },
        artifactId: identifier,
        revision: { type: "integer", minimum: 1, maximum: 2_147_483_647 },
        createdAt: timestamp,
        supersedesArtifactId: identifier
      }
    },
    caseEvent: {
      type: "object",
      additionalProperties: false,
      required: ["businessId", "eventId", "caseId", "sequence", "at", "role", "kind", "text"],
      properties: {
        businessId,
        eventId: identifier,
        caseId: identifier,
        sequence: { type: "integer", minimum: 1, maximum: 2_147_483_647 },
        at: timestamp,
        role: { enum: ["user", "assistant", "system"] },
        kind: {
          enum: [
            "case_created",
            "case_copied",
            "source_added",
            "instruction",
            "draft_created",
            "review_decision",
            "revision_created",
            "approval",
            "result",
            "legacy_unverified",
            "error"
          ]
        },
        text: { type: "string", minLength: 1, maxLength: 10_000 },
        visibility: { enum: ["operational", "commercial"] },
        sourceId: identifier,
        artifactId: identifier,
        sourceRef: { $ref: "#/$defs/caseSourceRef" },
        revisionRef: { $ref: "#/$defs/caseRevisionRef" }
      },
      allOf: [
        {
          if: { properties: { kind: { const: "source_added" } }, required: ["kind"] },
          then: { required: ["sourceRef"] }
        },
        {
          if: { properties: { kind: { const: "revision_created" } }, required: ["kind"] },
          then: { required: ["revisionRef"] }
        },
        {
          if: {
            properties: {
              kind: {
                enum: ["case_copied", "draft_created", "review_decision", "approval", "result", "legacy_unverified"]
              }
            },
            required: ["kind"]
          },
          then: { required: ["artifactId"] }
        }
      ]
    },
    offerCase: {
      type: "object",
      additionalProperties: false,
      required: caseBaseRequired,
      properties: {
        ...caseBaseProperties,
        product: { const: "offer" },
        approvedOfferId: identifier,
        productionHandoffId: identifier
      }
    },
    productionCase: {
      type: "object",
      additionalProperties: false,
      required: caseBaseRequired,
      properties: {
        ...caseBaseProperties,
        product: { const: "production" },
        productionHandoffId: identifier,
        sourceSpecId: identifier,
        approvedProductionSpecId: identifier,
        currentPlanId: identifier,
        currentPurchaseListId: identifier
      }
    }
  }
} as const;
