import { analyzeIntakeText } from "./intake-signals.js";
import { SCHEMA_VERSION } from "./types.js";
export function createEventRequestFromText(input) {
    const signals = analyzeIntakeText(input.rawText);
    return {
        schemaVersion: SCHEMA_VERSION,
        requestId: input.requestId,
        source: {
            channel: input.channel,
            receivedAt: new Date().toISOString(),
            sourceRef: input.sourceRef
        },
        rawInputs: [
            {
                kind: input.channel === "email"
                    ? "email"
                    : input.channel === "pdf_upload"
                        ? "pdf"
                        : "text",
                content: input.rawText
            }
        ],
        extractedFacts: signals.extractedFacts,
        constraints: signals.constraints.length > 0 ? signals.constraints : undefined,
        uncertainties: signals.uncertainties.length > 0 ? signals.uncertainties : undefined
    };
}
export function createEventRequestFromManualForm(input) {
    const normalizedMenuItems = (input.menuItems ?? []).map((item) => item.trim()).filter(Boolean);
    const summaryLines = [
        input.eventType ? `Eventtyp: ${input.eventType}` : undefined,
        input.eventDate ? `Datum: ${input.eventDate}` : undefined,
        input.attendeeCount ? `Teilnehmer: ${input.attendeeCount}` : undefined,
        input.serviceForm ? `Serviceform: ${input.serviceForm}` : undefined,
        input.notes?.trim() ? `Notizen: ${input.notes.trim()}` : undefined
    ].filter(Boolean);
    return {
        schemaVersion: SCHEMA_VERSION,
        requestId: input.requestId,
        source: {
            channel: "manual_form",
            receivedAt: new Date().toISOString()
        },
        rawInputs: [
            {
                kind: "form",
                content: summaryLines.join("\n")
            }
        ],
        customer: input.customerName?.trim()
            ? {
                name: input.customerName.trim()
            }
            : undefined,
        event: {
            type: input.eventType?.trim(),
            date: input.eventDate?.trim(),
            serviceForm: input.serviceForm?.trim()
        },
        attendees: {
            expected: input.attendeeCount
        },
        venue: input.venueName?.trim()
            ? {
                name: input.venueName.trim()
            }
            : undefined,
        desiredCatering: normalizedMenuItems.map((label) => ({
            label,
            category: "menu_item"
        })),
        constraints: input.notes?.trim() ? [input.notes.trim()] : undefined
    };
}
