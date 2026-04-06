export const yieldProfileSchema = {
  $id: "https://schemas.catering.local/yield-profile.json",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "scopeType",
    "scopeId",
    "yieldFactor",
    "sourceType",
    "isActive"
  ],
  properties: {
    id: { type: "string" },
    scopeType: {
      type: "string",
      enum: ["ingredient"]
    },
    scopeId: { type: "string" },
    yieldFactor: {
      type: "number",
      exclusiveMinimum: 0,
      maximum: 1
    },
    sourceType: { type: "string" },
    note: { type: "string" },
    isActive: { type: "boolean" }
  }
} as const;
