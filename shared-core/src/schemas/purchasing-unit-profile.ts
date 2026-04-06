export const purchasingUnitProfileSchema = {
  $id: "https://schemas.catering.local/purchasing-unit-profile.json",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "scopeType",
    "scopeId",
    "baseUnit",
    "unitLabel",
    "unitSize",
    "sourceType",
    "isActive"
  ],
  properties: {
    id: { type: "string" },
    scopeType: { enum: ["ingredient"] },
    scopeId: { type: "string" },
    baseUnit: { type: "string", minLength: 1 },
    unitLabel: { type: "string", minLength: 1 },
    unitSize: { type: "number", exclusiveMinimum: 0 },
    sourceType: { type: "string", minLength: 1 },
    note: { type: "string" },
    isActive: { type: "boolean" }
  }
} as const;
