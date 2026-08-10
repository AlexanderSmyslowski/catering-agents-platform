export const approvalRequestSchema = {
  $id: "https://schemas.catering.local/approval-request.json",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "approvalRequestId",
    "businessId",
    "target",
    "decision",
    "requestedAt",
    "decidedAt",
    "decidedBy"
  ],
  properties: {
    schemaVersion: { const: "1.0" },
    approvalRequestId: { type: "string", minLength: 1, maxLength: 650 },
    businessId: {
      type: "string",
      pattern: "^[a-z0-9][a-z0-9_-]{1,63}$"
    },
    target: {
      type: "object",
      additionalProperties: false,
      required: ["kind", "artifactId", "revision"],
      properties: {
        kind: { enum: ["offer_draft", "production_draft"] },
        artifactId: { type: "string", minLength: 1, maxLength: 160, pattern: ".*\\S.*" },
        revision: { type: "integer", minimum: 1, maximum: 2147483647 }
      }
    },
    decision: { enum: ["approved", "rejected"] },
    selectedVariantId: { type: "string", minLength: 1, maxLength: 160, pattern: ".*\\S.*" },
    requestedAt: { type: "string", format: "date-time", maxLength: 80 },
    decidedAt: { type: "string", format: "date-time", maxLength: 80 },
    decidedBy: {
      type: "object",
      additionalProperties: false,
      required: ["name", "role", "source"],
      properties: {
        name: { type: "string", minLength: 1, maxLength: 160, pattern: ".*\\S.*" },
        role: {
          enum: [
            "intake_operator",
            "offer_operator",
            "production_operator",
            "operations_audit_operator"
          ]
        },
        source: {
          enum: [
            "trusted-proxy:x-catering-actor-name",
            "dev-header:x-actor-name",
            "dev-default",
            "service-default",
            "untrusted"
          ]
        }
      }
    },
    comment: { type: "string", minLength: 1, maxLength: 1000 }
  }
};
