export const eventDemandSchema = {
  $id: "https://schemas.catering.local/event-demand.json",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "demandId", "pax", "serviceForm", "menuOrServiceWish"],
  properties: {
    schemaVersion: { type: "string" },
    demandId: { type: "string" },
    pax: { type: "integer", minimum: 1 },
    serviceForm: { type: "string", minLength: 1 },
    menuOrServiceWish: { type: "string", minLength: 1 },
    eventType: { type: "string" },
    date: { type: "string" },
    budgetContext: {
      type: "object",
      additionalProperties: false,
      properties: {
        targetBudget: {
          $ref: "https://schemas.catering.local/common.json#/$defs/money"
        }
      }
    },
    customerType: {
      enum: ["company", "university", "public", "private", "unknown"]
    },
    restrictions: {
      type: "array",
      items: { type: "string" }
    }
  }
} as const;
