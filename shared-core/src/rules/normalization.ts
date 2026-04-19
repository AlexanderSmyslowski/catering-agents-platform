import { analyzeIntakeText } from "../intake-signals.js";
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

type InferredMenuItem = Pick<MenuComponent, "label" | "menuCategory" | "dietaryTags">;

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
  const directMatch =
    text.match(/\b(?:für|fuer)\s+(\d{1,4})\s*(?:gäste|gaeste|teilnehmer|personen|people)?\b/i) ??
    text.match(/\b(\d{1,4})\s*(?:gäste|gaeste|teilnehmer|personen|people)\b/i);
  if (directMatch) {
    return Number(directMatch[1]);
  }

  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const scoredCandidates = lines.flatMap((line) => {
    const candidates = [...line.matchAll(/\b(\d{1,4})\s*x\b/gi)];
    if (candidates.length === 0) {
      return [];
    }

    const normalized = line.toLowerCase();
    return candidates.map((match) => {
      const count = Number(match[1]);
      let score = 0;

      if (count >= 20) {
        score += 3;
      }
      if (count <= 10) {
        score -= 4;
      }
      if (/(catering|get together|quick lunch|lunch|buffet|menü|menu|mittag)/i.test(normalized)) {
        score += 8;
      }
      if (/(teilnehmer|gäste|gaeste|personen|people)/i.test(normalized)) {
        score += 6;
      }
      if (/€|eur|gesamt/.test(normalized)) {
        score += 2;
      }
      if (/(lieferung|transport|personalkosten|stehtische|buffetinfrastruktur|tischdecken|geschirr|hauptspeisenteller|aufbau|abbau|umbau|rücklauf|husse|reinigungskosten)/i.test(normalized)) {
        score -= 7;
      }
      if (/(pax|personaleinsatz|stunden|stunde|\d+h\b|hall of fame)/i.test(normalized)) {
        score -= 8;
      }

      return {
        count,
        score
      };
    });
  });

  const bestCandidate = scoredCandidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return right.count - left.count;
  })[0];

  return bestCandidate && bestCandidate.score >= 5 ? bestCandidate.count : undefined;
}

function parseDate(text: string): string | undefined {
  return analyzeIntakeText(text).eventDate;
}

function sanitizeMenuLine(line: string): string {
  return line
    .replace(/\t+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[&•\-\s]+/, "")
    .replace(/\s*\|\s*$/, "")
    .trim();
}

function inferMenuCategoryFromText(
  line: string
): MenuComponent["menuCategory"] | undefined {
  if (/(^|[^a-z])(vegan)([^a-z]|$)/i.test(line)) {
    return "vegan";
  }
  if (/(vegetarisch|vegetarian)/i.test(line)) {
    return "vegetarian";
  }
  if (/(traditionell|klassisch|classic)/i.test(line)) {
    return "classic";
  }
  return undefined;
}

function requiresExplicitCategoryDecision(line: string): boolean {
  const normalized = sanitizeMenuLine(line).toLowerCase();
  return /^(brot(\s*&\s*baguette)?|baguette|br[öo]tchen|brotkorb|butter|dips?|saucen?)$/i.test(
    normalized
  );
}

function dietaryTagsForCategory(
  category?: MenuComponent["menuCategory"]
): string[] {
  if (category === "vegan") {
    return ["vegan"];
  }
  if (category === "vegetarian") {
    return ["vegetarian"];
  }
  return [];
}

function looksLikeMenuHeading(line: string): boolean {
  return /^(quick lunch|lunch|traditionell|vegan|vegetarisch|dessert|buffet|menü|menu)(\s*\|\s*\d+%?)?$/i.test(
    line
  );
}

function isMenuNoise(line: string): boolean {
  return /(?:uhr|gesamt|kosten|position|beschreibung|personalkosten|lieferung|transport|aufbau|abbau|umbau|rücklauf|personaleinsatz|hall of fame|hauptspeisenteller|stehttische|stehtische|geschirr|tischdecken|reinigungskosten|stunden|stunde)/i.test(
    line
  );
}

function extractStructuredMenuSection(text: string): InferredMenuItem[] {
  const sectionMatch = text.match(
    /\n\s*(?:QUICK\s+LUNCH|LUNCHBUFFET|LUNCHMENÜ|MITTAGESSEN|MENÜ|MENU|BUFFET)\s*\|?\s*([\s\S]{0,2500}?)(?:\n\s*KOSTENÜBERSICHT|\n\s*POSITIONBESCHREIBUNG|\n\s*GESAMTKOSTEN|\n\s*DETAILS\s*\|)/i
  );

  if (!sectionMatch?.[1]) {
    return [];
  }

  const lines = sectionMatch[1]
    .split(/\n+/)
    .map((line) => sanitizeMenuLine(line))
    .filter(Boolean);

  const detected: InferredMenuItem[] = [];
  let activeCategory: MenuComponent["menuCategory"] | undefined;

  for (const line of lines) {
    const headingCategory = inferMenuCategoryFromText(line);
    if (looksLikeMenuHeading(line) || /%/.test(line)) {
      activeCategory = headingCategory ?? activeCategory;
      continue;
    }
    if (isMenuNoise(line) || /^\d/.test(line) || /€/.test(line)) {
      continue;
    }
    if (!/[a-zäöüß]/i.test(line)) {
      continue;
    }

    const explicitCategory = inferMenuCategoryFromText(line);
    const lineCategory =
      explicitCategory ??
      (activeCategory && !requiresExplicitCategoryDecision(line) ? activeCategory : undefined);
    detected.push({
      label: line,
      menuCategory: lineCategory,
      dietaryTags: dietaryTagsForCategory(lineCategory)
    });
  }

  const byLabel = new Map<string, InferredMenuItem>();
  for (const item of detected) {
    byLabel.set(item.label, byLabel.get(item.label) ?? item);
  }

  return [...byLabel.values()];
}

function extractMenuItems(text: string, fallbackKeywords: string[]): InferredMenuItem[] {
  const structuredSectionLabels = extractStructuredMenuSection(text);
  if (structuredSectionLabels.length > 0) {
    return structuredSectionLabels.slice(0, 12);
  }

  const lines = text
    .split(/\n|,/)
    .map((line) => sanitizeMenuLine(line))
    .filter(Boolean);

  const detected = lines.flatMap((line) => {
    const directMatch = line.match(/\b(?:mit|includes?|serves?|menu|menü)\s+(.+)$/i);

    if (directMatch?.[1]) {
      return directMatch[1]
        .split(/\bund\b|&|\/|;/i)
        .map((entry) => sanitizeMenuLine(entry.replace(/\.$/, "")))
        .filter(Boolean)
        .map((label) => ({
          label,
          menuCategory: inferMenuCategoryFromText(label),
          dietaryTags: dietaryTagsForCategory(inferMenuCategoryFromText(label))
        }));
    }

    return /(buffet|salat|suppe|kaffee|croissant|dessert|fingerfood|wein|snack|menü|baguette|brot|kuchen|curry)/i.test(
      line
    ) && !isMenuNoise(line)
      ? [
          {
            label: line,
            menuCategory: inferMenuCategoryFromText(line),
            dietaryTags: dietaryTagsForCategory(inferMenuCategoryFromText(line))
          }
        ]
      : [];
  });

  if (detected.length > 0) {
    const byLabel = new Map<string, InferredMenuItem>();
    for (const item of detected) {
      byLabel.set(item.label, byLabel.get(item.label) ?? item);
    }
    return [...byLabel.values()].slice(0, 12);
  }

  return fallbackKeywords.map((label) => ({
    label,
    menuCategory: inferMenuCategoryFromText(label),
    dietaryTags: dietaryTagsForCategory(inferMenuCategoryFromText(label))
  }));
}

function detectCourse(label: string): string {
  if (/(dessert|kuchen|mousse|creme|tarte|brownie|schokolade|pudding)/i.test(label)) {
    return "dessert";
  }
  if (/(salat|suppe|starter)/i.test(label)) {
    return "starter";
  }
  return "main";
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

function uniqueUncertainties(base: Uncertainty[], additions: Uncertainty[]): Uncertainty[] {
  const result = [...base];
  for (const item of additions) {
    if (
      !result.some(
        (entry) =>
          entry.field === item.field &&
          entry.message === item.message &&
          entry.severity === item.severity
      )
    ) {
      result.push(item);
    }
  }
  return result;
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
  const signals = analyzeIntakeText(rawText);
  const explicitEventType = request.event?.type;
  const eventType = explicitEventType ?? detectEventType(rawText);
  const defaults = eventTypeDefaults[eventType] ?? eventTypeDefaults.meeting;
  const serviceForm = request.event?.serviceForm ?? detectServiceForm(rawText, eventType);
  const attendees = request.attendees?.expected ?? signals.attendeeCount ?? parseAttendees(rawText);
  const eventDate = request.event?.date ?? signals.eventDate ?? parseDate(rawText);
  const menuItems =
    request.source.channel === "manual_form" && (request.desiredCatering?.length ?? 0) > 0
      ? request.desiredCatering!.map((item) => ({
          label: item.label,
          menuCategory: inferMenuCategoryFromText(item.label),
          dietaryTags: item.dietaryTags ?? dietaryTagsForCategory(inferMenuCategoryFromText(item.label))
        }))
      : extractMenuItems(
          rawText,
          request.desiredCatering?.map((item) => item.label) ?? defaults.defaultMenuKeywords
        );

  const assumptions: Assumption[] = [];
  const uncertainties: Uncertainty[] = uniqueUncertainties(request.uncertainties ?? [], signals.uncertainties);

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
  if (
    !request.attendees?.expected &&
    (signals.uncertainties.some((item) => item.field === "attendees.expected") ||
      /(?:ca\.?|circa|etwa|ungef(?:ä|ae)hr|knapp|wahrscheinlich|eventuell|möglicherweise|moeglicherweise|vielleicht|vermutlich|unklar|offen|noch unklar)/i.test(rawText))
  ) {
    assumptions.push({
      code: "attendees_expected_approximate",
      message: "Participant count was only inferred approximately from the intake text.",
      applied: true
    });
  }

  if (!eventDate) {
    uncertainties.push({
      field: "event.date",
      message: "No exact event date could be extracted.",
      severity: "high",
      suggestedQuestion: "An welchem Datum findet das Event statt?"
    });
    uncertainties.push({
      field: "event.date_or_schedule",
      message: "No event date or schedule was found.",
      severity: "high",
      suggestedQuestion: "An welchem Datum oder in welchem Zeitfenster findet das Event statt?"
    });
  }

  const menuPlan: MenuComponent[] = menuItems.map((item, index) => ({
    componentId: `${slugify(item.label)}-${index + 1}`,
    label: item.label,
    course: detectCourse(item.label),
    menuCategory: item.menuCategory,
    serviceStyle: serviceForm,
    desiredRecipeTags: [eventType],
    servings: attendees,
    dietaryTags: item.dietaryTags ?? []
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
    productionConstraints: request.constraints ?? (signals.constraints.length > 0 ? signals.constraints : undefined),
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
