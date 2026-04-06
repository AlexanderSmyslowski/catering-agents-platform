export const acceptedEventSpecSchema = {
  $id: "https://schemas.catering.local/accepted-event-spec.json",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "specId",
    "ownershipContext",
    "lifecycle",
    "readiness",
    "sourceLineage",
    "event",
    "attendees",
    "servicePlan",
    "menuPlan"
  ],
  properties: {
    schemaVersion: { type: "string" },
    specId: { type: "string" },
    ownershipContext: {
      $ref: "https://schemas.catering.local/common.json#/$defs/ownershipContext"
    },
    lifecycle: {
      type: "object",
      additionalProperties: false,
      required: ["commercialState"],
      properties: {
        commercialState: {
          enum: ["quoted", "accepted", "manual", "provisional"]
        }
      }
    },
    readiness: {
      $ref: "https://schemas.catering.local/common.json#/$defs/readiness"
    },
    sourceLineage: {
      type: "array",
      minItems: 1,
      items: {
        $ref: "https://schemas.catering.local/common.json#/$defs/sourceLineage"
      }
    },
    customer: { $ref: "https://schemas.catering.local/common.json#/$defs/customer" },
    event: { $ref: "https://schemas.catering.local/common.json#/$defs/eventInfo" },
    attendees: { $ref: "https://schemas.catering.local/common.json#/$defs/attendees" },
    venue: { $ref: "https://schemas.catering.local/common.json#/$defs/venue" },
    servicePlan: {
      type: "object",
      additionalProperties: false,
      required: ["eventType", "serviceForm", "modules"],
      properties: {
        eventType: { type: "string" },
        serviceForm: { type: "string" },
        staffingStyle: { type: "string" },
        modules: {
          type: "array",
          items: {
            $ref: "https://schemas.catering.local/common.json#/$defs/serviceModule"
          }
        }
      }
    },
    menuPlan: {
      type: "array",
      items: {
        $ref: "https://schemas.catering.local/common.json#/$defs/menuComponent"
      }
    },
    infrastructurePlan: {
      type: "array",
      items: {
        $ref: "https://schemas.catering.local/common.json#/$defs/infrastructureRequirement"
      }
    },
    budgetContext: {
      type: "object",
      additionalProperties: false,
      properties: {
        targetBudget: {
          $ref: "https://schemas.catering.local/common.json#/$defs/money"
        },
        pricingSummary: {
          $ref: "https://schemas.catering.local/common.json#/$defs/pricingSummary"
        }
      }
    },
    productionConstraints: {
      type: "array",
      items: { type: "string" }
    },
    assumptions: {
      type: "array",
      items: {
        $ref: "https://schemas.catering.local/common.json#/$defs/assumption"
      }
    },
    missingFields: {
      type: "array",
      items: { type: "string" }
    },
    uncertainties: {
      type: "array",
      items: {
        $ref: "https://schemas.catering.local/common.json#/$defs/uncertainty"
      }
    },
    evidence: {
      type: "array",
      items: {
        $ref: "https://schemas.catering.local/common.json#/$defs/evidence"
      }
    }
  }
} as const;
