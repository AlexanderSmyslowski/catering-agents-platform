export const eventRequestSchema = {
    $id: "https://schemas.catering.local/event-request.json",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    required: ["schemaVersion", "requestId", "source", "rawInputs"],
    properties: {
        schemaVersion: { type: "string" },
        requestId: { type: "string" },
        source: {
            type: "object",
            additionalProperties: false,
            required: ["channel", "receivedAt"],
            properties: {
                channel: {
                    enum: ["agent1_json", "manual_form", "email", "pdf_upload", "text", "api"]
                },
                receivedAt: { type: "string" },
                sourceRef: { type: "string" }
            }
        },
        rawInputs: {
            type: "array",
            minItems: 1,
            items: {
                type: "object",
                additionalProperties: false,
                required: ["kind", "content"],
                properties: {
                    kind: { enum: ["text", "email", "pdf", "json", "form"] },
                    content: { type: "string" },
                    mimeType: { type: "string" },
                    documentId: { type: "string" }
                }
            }
        },
        customer: { $ref: "https://schemas.catering.local/common.json#/$defs/customer" },
        event: { $ref: "https://schemas.catering.local/common.json#/$defs/eventInfo" },
        attendees: { $ref: "https://schemas.catering.local/common.json#/$defs/attendees" },
        venue: { $ref: "https://schemas.catering.local/common.json#/$defs/venue" },
        desiredCatering: {
            type: "array",
            items: {
                $ref: "https://schemas.catering.local/common.json#/$defs/cateringRequirement"
            }
        },
        desiredInfrastructure: {
            type: "array",
            items: {
                $ref: "https://schemas.catering.local/common.json#/$defs/infrastructureRequirement"
            }
        },
        constraints: {
            type: "array",
            items: { type: "string" }
        },
        extractedFacts: {
            type: "array",
            items: { type: "string" }
        },
        uncertainties: {
            type: "array",
            items: {
                $ref: "https://schemas.catering.local/common.json#/$defs/uncertainty"
            }
        }
    }
};
