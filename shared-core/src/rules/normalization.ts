import { eventTypeDefaults, eventTypeKeywords, infrastructureCatalog, serviceFormKeywords } from "../taxonomies/defaults.js";
import type {
  AcceptedEventSpec,
  Assumption,
  EventRequest,
  InfrastructureRequirement,
  MenuComponent,
  Uncertainty
} from "../types.js";
import { SCHEMA_VERSION } from "../types.js";
import { evaluateReadiness } from "./readiness.js";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function detectEventType(text: string): string {
  const normalized = text.toLowerCase();
  for (const [keyword, eventType] of Object.entries(eventTypeKeywords)) {
    if (normalized.includes(keyword)) {
      return eventType;
    }
  }
  return "meeting";
}

function detectServiceForm(text: string, eventType: string): string {
  const normalized = text.toLowerCase().replace(/\s+/g, "");
  for (const [keyword, serviceForm] of Object.entries(serviceFormKeywords)) {
    if (normalized.includes(keyword)) {
      return serviceForm;
    }
  }
  return eventTypeDefaults[eventType]?.serviceForm ?? "buffet";
}

function parseAttendees(text: string): number | undefined {
  const attendeeMatch =
    text.match(/(\d{1,4})\s*(gäste|gaeste|teilnehmer|personen|people)/i) ??
    text.match(/für\s+(\d{1,4})/i);
  return attendeeMatch ? Number(attendeeMatch[1]) : undefined;
}

function parseDate(text: string): string | undefined {
  const isoMatch = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoMatch) {
    return isoMatch[1];
  }

  const germanMatch = text.match(/\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\b/);
  if (!germanMatch) {
    return undefined;
  }

  const [, day, month, year] = germanMatch;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function extractMenuLabels(text: string, fallbackKeywords: string[]): string[] {
  const lines = text
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean);

  const detected = lines.flatMap((line) => {
    const directMatch = line.match(
      /\b(?:mit|includes?|serves?|menu|menü)\s+(.+)$/i
    );

    if (directMatch?.[1]) {
      return directMatch[1]
        .split(/\bund\b|&|\/|;/i)
        .map((entry) => entry.trim().replace(/\.$/, ""))
        .filter(Boolean);
    }

    return /(buffet|salat|suppe|kaffee|croissant|dessert|fingerfood|wein|snack|menü)/i.test(
      line
    )
      ? [line]
      : [];
  });

  if (detected.length > 0) {
    return detected.slice(0, 5);
  }

  return fallbackKeywords;
}

function inferInfrastructure(eventType: string, desiredInfrastructure?: InfrastructureRequirement[]): InfrastructureRequirement[] {
  const defaults = eventTypeDefaults[eventType]?.infrastructure ?? [];
  const base = defaults.map((code) => ({
    code,
    label: infrastructureCatalog[code as keyof typeof infrastructureCatalog] ?? code,
    quantity: 1,
    derived: true
  }));

  return [...base, ...(desiredInfrastructure ?? [])];
}

function uniqueByCode(items: InfrastructureRequirement[]): InfrastructureRequirement[] {
  const map = new Map<string, InfrastructureRequirement>();
  for (const item of items) {
    map.set(item.code, map.get(item.code) ?? item);
  }
  return [...map.values()];
}

export function normalizeEventRequestToSpec(
  request: EventRequest,
  opts?: {
    sourceType?: AcceptedEventSpec["sourceLineage"][number]["sourceType"];
    reference?: string;
    commercialState?: AcceptedEventSpec["lifecycle"]["commercialState"];
  }
): AcceptedEventSpec {
  const rawText = request.rawInputs.map((item) => item.content).join("\n");
  const explicitEventType = request.event?.type;
  const eventType = explicitEventType ?? detectEventType(rawText);
  const defaults = eventTypeDefaults[eventType] ?? eventTypeDefaults.meeting;
  const serviceForm = request.event?.serviceForm ?? detectServiceForm(rawText, eventType);
  const attendees = request.attendees?.expected ?? parseAttendees(rawText);
  const eventDate = request.event?.date ?? parseDate(rawText);
  const menuLabels = extractMenuLabels(
    rawText,
    request.desiredCatering?.map((item) => item.label) ?? defaults.defaultMenuKeywords
  );

  const assumptions: Assumption[] = [];
  const uncertainties: Uncertainty[] = request.uncertainties ? [...request.uncertainties] : [];

  if (!request.event?.type) {
    assumptions.push({
      code: "event_type_defaulted",
      message: `Event type inferred as ${eventType}.`,
      applied: true
    });
  }

  if (!request.event?.serviceForm) {
    assumptions.push({
      code: "service_form_defaulted",
      message: `Service form inferred as ${serviceForm}.`,
      applied: true
    });
  }

  if (!attendees) {
    uncertainties.push({
      field: "attendees.expected",
      message: "Participant count could not be extracted reliably.",
      severity: "high",
      suggestedQuestion: "Wie viele Teilnehmer werden verbindlich erwartet?"
    });
  }

  if (!eventDate) {
    uncertainties.push({
      field: "event.date",
      message: "No event date or service window was found.",
      severity: "high",
      suggestedQuestion: "An welchem Datum findet das Event statt?"
    });
  }

  const menuPlan: MenuComponent[] = menuLabels.map((label, index) => ({
    componentId: `${slugify(label)}-${index + 1}`,
    label,
    course:
      /dessert/i.test(label) ? "dessert" : /salat|suppe|starter/i.test(label) ? "starter" : "main",
    serviceStyle: serviceForm,
    desiredRecipeTags: [eventType],
    servings: attendees,
    dietaryTags: []
  }));

  const spec: AcceptedEventSpec = {
    schemaVersion: SCHEMA_VERSION,
    specId: `spec-${request.requestId}`,
    lifecycle: {
      commercialState: opts?.commercialState ?? "manual"
    },
    readiness: {
      status: "partial",
      reasons: []
    },
    sourceLineage: [
      {
        sourceType: opts?.sourceType ?? "manual_input",
        reference: opts?.reference ?? request.requestId
      }
    ],
    customer: request.customer,
    event: {
      title: request.event?.title,
      type: eventType,
      date: eventDate,
      durationHours: request.event?.durationHours ?? defaults.durationHours,
      schedule: request.event?.schedule,
      style: request.event?.style,
      atmosphere: request.event?.atmosphere,
      locale: request.event?.locale ?? "de-DE",
      serviceForm
    },
    attendees: {
      expected: attendees,
      guaranteed: request.attendees?.guaranteed,
      dietaryMix: request.attendees?.dietaryMix
    },
    venue: request.venue,
    servicePlan: {
      eventType,
      serviceForm,
      staffingStyle: serviceForm === "plated" ? "full_service" : "buffet_support",
      modules: []
    },
    menuPlan,
    infrastructurePlan: uniqueByCode(
      inferInfrastructure(eventType, request.desiredInfrastructure)
    ),
    productionConstraints: request.constraints,
    assumptions,
    uncertainties,
    evidence: request.rawInputs.map((raw, index) => ({
      kind: raw.kind === "pdf" ? "document_ref" : "text_excerpt",
      sourceId: raw.documentId ?? `raw-${index + 1}`,
      excerpt: raw.content.slice(0, 240),
      confidence: 0.75
    }))
  };

  const { readiness, missingFields } = evaluateReadiness(spec);
  return {
    ...spec,
    readiness,
    missingFields
  };
}
