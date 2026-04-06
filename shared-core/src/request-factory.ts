import { validateAcceptedEventSpec } from "./validation.js";
import { normalizeEventRequestToSpec } from "./rules/normalization.js";
import { withEvaluatedReadiness } from "./rules/readiness.js";
import type { AcceptedEventSpec, EventDemand, EventRequest } from "./types.js";
import { SCHEMA_VERSION } from "./types.js";

export function createEventRequestFromText(input: {
  requestId: string;
  channel: EventRequest["source"]["channel"];
  rawText: string;
  sourceRef?: string;
}): EventRequest {
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
        kind:
          input.channel === "email"
            ? "email"
            : input.channel === "pdf_upload"
              ? "pdf"
              : "text",
        content: input.rawText
      }
    ]
  };
}

export function createEventRequestFromManualForm(input: {
  requestId: string;
  eventType?: string;
  eventDate?: string;
  attendeeCount?: number;
  serviceForm?: string;
  menuItems?: string[];
  customerName?: string;
  venueName?: string;
  notes?: string;
}): EventRequest {
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

function eventDemandText(input: EventDemand): string {
  const lines = [
    input.eventType ? `Eventtyp: ${input.eventType}` : undefined,
    input.date ? `Datum: ${input.date}` : undefined,
    `Teilnehmer: ${input.pax}`,
    `Serviceform: ${input.serviceForm}`,
    `Wunsch: ${input.menuOrServiceWish}`,
    ...(input.restrictions ?? []).map((item) => `Einschraenkung: ${item}`)
  ].filter(Boolean);

  return lines.join("\n");
}

export function createAcceptedEventSpecFromEventDemand(input: EventDemand): AcceptedEventSpec {
  const eventRequest = createEventRequestFromText({
    requestId: input.demandId,
    channel: "api",
    rawText: eventDemandText(input)
  });

  eventRequest.event = {
    type: input.eventType,
    date: input.date,
    serviceForm: input.serviceForm
  };
  eventRequest.attendees = {
    expected: input.pax
  };
  eventRequest.constraints = input.restrictions;
  eventRequest.customer = input.customerType
    ? {
        segment: input.customerType
      }
    : undefined;

  const normalized = normalizeEventRequestToSpec(eventRequest, {
    sourceType: "manual_input",
    reference: input.demandId,
    commercialState: "manual"
  });

  const eventType = input.eventType?.trim() || normalized.event.type || normalized.servicePlan.eventType;
  const serviceForm = input.serviceForm.trim();

  const spec: AcceptedEventSpec = {
    ...normalized,
    ownershipContext: "customer",
    event: {
      ...normalized.event,
      type: eventType,
      date: input.date?.trim() || normalized.event.date,
      serviceForm
    },
    attendees: {
      ...normalized.attendees,
      expected: input.pax
    },
    budgetContext: input.budgetContext?.targetBudget
      ? {
          ...normalized.budgetContext,
          targetBudget: input.budgetContext.targetBudget
        }
      : normalized.budgetContext,
    customer: input.customerType
      ? {
          ...normalized.customer,
          segment: input.customerType
        }
      : normalized.customer,
    productionConstraints: input.restrictions,
    servicePlan: {
      ...normalized.servicePlan,
      eventType,
      serviceForm
    },
    menuPlan: normalized.menuPlan.map((item) => ({
      ...item,
      serviceStyle: serviceForm,
      desiredRecipeTags: eventType ? [eventType] : item.desiredRecipeTags,
      servings: input.pax
    }))
  };

  return validateAcceptedEventSpec(withEvaluatedReadiness(spec));
}
