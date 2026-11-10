import { analyzeIntakeText, parseCountedDishLine } from "../intake-signals.js";
import { eventTypeDefaults, eventTypeKeywords, infrastructureCatalog, serviceFormKeywords } from "../taxonomies/defaults.js";
import { formatEventTypeLabel, formatServiceFormLabel } from "../taxonomies/labels.js";
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

type InferredMenuItem = Pick<MenuComponent, "label" | "menuCategory" | "dietaryTags" | "servings"> & { dietaryReviewNote?: string };

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
    text.match(/\b(?:für|fuer)\s+(\d{1,4})\s*(?:gästen?|gaesten?|teilnehmer|personen|people)?\b/i) ??
    text.match(/\b(\d{1,4})\s*(?:gästen?|gaesten?|teilnehmer|personen|people)\b/i);
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
  if (/(^|[^a-z])(vegan(?:e[nmrs]?)?)([^a-z]|$)/i.test(line)) {
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

function inferMenuItemFromLabel(label: string): InferredMenuItem {
  const menuCategory = inferMenuCategoryFromText(label);
  return {
    label,
    menuCategory,
    dietaryTags: dietaryTagsForCategory(menuCategory)
  };
}

function extractInlineMenuMarkerItems(text: string): InferredMenuItem[] {
  const markerMatch = text.match(/\b(?:menu|menü)\s*:\s*([^\n.]+)/i);
  if (!markerMatch?.[1]) {
    return [];
  }

  const labels = markerMatch[1]
    .split(/\s*,\s*|\bund\b|&|\/|;/i)
    .map((entry) => sanitizeMenuLine(entry.replace(/\.$/, "")))
    .filter((entry) => entry.length > 0 && !isMenuNoise(entry));

  return labels.map((label) => inferMenuItemFromLabel(label));
}

// Only clear list introductions count as explicit dishes; a guest count after
// “mit” is not a menu. Portions remain unknown unless each is stated.
function extractExplicitUncountedMenu(text: string): InferredMenuItem[] {
  const hasMenuHeading = /(?:^|\n)\s*(?:menü|menu)\s*:/iu.test(text);
  const section = /(?:^|\n)\s*(?:menü|menu)\s*:\s*\n((?:[ \t]*[-•][ \t]*[^\n]+(?:\n|$))+)/iu.exec(text);
  const inline = /(?:^|\n)\s*(?:menü|menu)\s*:[ \t]*([^\n.!?]+)/iu.exec(text);
  const intro = /(?:\bmit\s+(?!\d)|\b(?:wir\s+)?hätten\s+gern\s+|\b(?:wir\s+)?haetten\s+gern\s+)([^\n.!?]+)/iu.exec(text);
  const source = hasMenuHeading ? section?.[1] ?? inline?.[1] : intro?.[1];
  if (!source) return [];
  const chunks = source.split(/\s*,\s*|\s*;\s*|\n/iu).map(sanitizeMenuLine).filter(Boolean);
  const parts = chunks.flatMap(chunk => {
    const and = /\s+und\s+/iu.exec(chunk);
    return and && !/\bmit\b/iu.test(chunk.slice(0, and.index))
      ? [chunk.slice(0, and.index), chunk.slice(and.index + and[0].length)].map(sanitizeMenuLine)
      : [chunk];
  });
  const food = /(?:suppe|ragout|quiche|mousse|salat|gemüse|gemuese|kuchen|dessert|pasta|nudel|kartoffel|fleisch|fisch|hähnchen|haehnchen|braten|bratling|curry|risotto|creme|obst|käse|kaese|brot|canap|torte|eintopf)/iu;
  const nonFood = /\b(?:bühne|buehne|licht|ton|technik|personal|servicekräfte|servicekraefte|gäste|gästen|gaeste|gaesten|personen|teilnehmer|uhr)\b/iu;
  if (parts.length < 2 || parts.some(item => nonFood.test(item) || isMenuNoise(item))) return [];
  if (!parts.some(item => food.test(item))) return [];
  if (parts.length > 100) throw Object.assign(new Error("Mehr als 100 Gerichte erkannt. Bitte das Menü in kleinere, eindeutig prüfbare Listen aufteilen."), { statusCode: 422 });
  if (parts.some(item => item.length > 120 || /\d/iu.test(item))) return [];
  return parts.map(inferMenuItemFromLabel);
}

function extractQuantifiedMenuItems(text: string): InferredMenuItem[] {
  // Only explicit dish counts establish portions. Guest subgroups, gram weights
  // and staff counts must not become additional menu servings.
  const countedLines = [...text.matchAll(/^[^\r\n]+/gm)].flatMap(match => {
    const parsed = parseCountedDishLine(match[0]);
    return parsed ? [{ index: match.index!, length: match[0].length, ...parsed }] : [];
  });
  const namedLines = countedLines.filter(line => !line.isHeading && !isMenuNoise(line.label));
  // A following "und/sowie N Portionen …" starts another dish with its own
  // count; ordinary "mit … und …" dish names contain no second count.
  const prefixed = [...text.matchAll(/\b(\d{1,5})[ \t]+Portion(?:en)?[ \t]+(.+?)(?=,?[ \t]*(?:,|\bund\b|\bsowie\b)[ \t]*\d{1,5}[ \t]+Portion|[;.\r\n]|$)/gi)]
    .filter((match) => Number(match[1]) > 0)
    .filter(match => !countedLines.some(line => match.index! >= line.index && match.index! < line.index + line.length))
    .map(match => ({ index: match.index!, item: { ...inferMenuItemFromLabel(sanitizeMenuLine(match[2]!)), servings: Number(match[1]) } }));
  const suffixed = namedLines.map(line => {
    const label = sanitizeMenuLine(line.label);
    const inferred = inferMenuItemFromLabel(label);
    const statedCategory = line.dietaryLabel ? inferMenuCategoryFromText(line.dietaryLabel) : undefined;
    const needsReview = statedCategory !== undefined && statedCategory !== inferred.menuCategory;
    const menuCategory = needsReview ? undefined : inferred.menuCategory;
    return { index: line.index, item: { ...inferred, servings: line.servings, menuCategory, dietaryTags: dietaryTagsForCategory(menuCategory),
      ...(needsReview ? { dietaryReviewNote: `Ernährungsangabe für ${label}: ${line.dietaryLabel}. Kennzeichnung vor Freigabe anhand des Rezepts prüfen.` } : {}) } };
  });
  return [...prefixed, ...suffixed].sort((left, right) => left.index - right.index).map(({ item }) => item);
}

function inferManualMenuItem(label: string): InferredMenuItem {
  label = label.replace(/[^\S\r\n]+/gu, " ");
  if ([...label.matchAll(/\d+\s*(?:Portionen?|Stück(?:e)?|Personen)\b/giu)].length > 1) {
    throw Object.assign(new Error("Mehrere Mengen in einer Menüzeile erkannt. Bitte jedes Gericht mit seiner Menge in einer eigenen Zeile angeben."), { statusCode: 422 });
  }
  if (/\d[ \t]*[–—-][ \t]*\d+[ \t]+(?:Portionen?|Stück(?:e)?|Personen)\b/iu.test(label)) {
    throw Object.assign(new Error("Mengenbereich erkannt. Bitte für jedes Gericht eine feste Portions- oder Stückzahl angeben."), { statusCode: 422 });
  }
  const colon = parseCountedDishLine(label);
  if (colon && !colon.isHeading) {
    const item = extractQuantifiedMenuItems(label)[0];
    if (item) return item;
  }
  const prefix = /^(\d{1,5})[ \t]+Portion(?:en)?[ \t]+(.+)$/iu.exec(label);
  if (prefix && Number(prefix[1]) > 0 && !/\d.*\bPortion/iu.test(prefix[2]!)) {
    const heading = parseCountedDishLine(`${prefix[2]}: ${prefix[1]} Portionen`);
    if (heading && !heading.isHeading) return { ...inferMenuItemFromLabel(prefix[2]!.trim()), servings: Number(prefix[1]) };
  }
  const suffix = /^(.*?)\s+[–—-]\s*(\d{1,5})\s+(?:Portionen?|Stück(?:e)?)(?:\s+insgesamt)?\s*$/iu.exec(label);
  if (suffix && Number(suffix[2]) > 0) {
    const heading = parseCountedDishLine(`${suffix[1]}: ${suffix[2]} Portionen`);
    if (heading && !heading.isHeading) return { ...inferMenuItemFromLabel(suffix[1]!.trim()), servings: Number(suffix[2]) };
  }
  if (/(?:\d.*(?:Portionen?|Stück(?:e)?|Personen)\b|\bPortionen?\s*:)/iu.test(label)) {
    throw Object.assign(new Error(`Menge für „${label}“ ist nicht eindeutig. Bitte ein Gericht je Zeile mit einer festen Menge angeben, z. B. „Salat – 50 Portionen“.`), { statusCode: 422 });
  }
  return inferMenuItemFromLabel(label);
}

function extractMenuItems(text: string, fallbackKeywords: string[]): InferredMenuItem[] {
  const quantified = extractQuantifiedMenuItems(text);
  if (quantified.length > 0) return quantified;

  const structuredSectionLabels = extractStructuredMenuSection(text);
  if (structuredSectionLabels.length > 0) {
    return structuredSectionLabels.slice(0, 12);
  }

  const inlineMenuMarkerLabels = extractInlineMenuMarkerItems(text);
  if (inlineMenuMarkerLabels.length > 0) {
    return inlineMenuMarkerLabels.slice(0, 12);
  }

  const lines = text
    .split(/\n|,/)
    .map((line) => sanitizeMenuLine(line))
    .filter(Boolean);

  const detected = lines.flatMap((line) => {
    const directMatch = line.match(/\b(?:mit|includes?|serves?|menu|menü)\s+(.+)$/i);

    if (directMatch?.[1] && !/\b(?:bühne|buehne|licht|ton|technik|personal|gäste|gästen|gaeste|gaesten|personen)\b/iu.test(directMatch[1])) {
      return directMatch[1]
        .split(/\bund\b|&|\/|;/i)
        .map((entry) => sanitizeMenuLine(entry.replace(/\.$/, "")))
        .filter(Boolean)
        .map((label) => inferMenuItemFromLabel(label));
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
  const explicitUncountedMenu = request.source.channel === "manual_form" ? [] : extractExplicitUncountedMenu(rawText);
  const quantifiedMenu = extractQuantifiedMenuItems(rawText);
  const menuItems: InferredMenuItem[] =
    request.source.channel === "manual_form" && (request.desiredCatering?.length ?? 0) > 0
      ? request.desiredCatering!.map(item => {
          const inferred = inferManualMenuItem(item.label);
          return { ...inferred, dietaryTags: item.dietaryTags ?? inferred.dietaryTags };
        })
      : quantifiedMenu.length ? quantifiedMenu : explicitUncountedMenu.length ? explicitUncountedMenu : extractMenuItems(
          rawText,
          request.desiredCatering?.map((item) => item.label) ?? defaults.defaultMenuKeywords
        );

  const assumptions: Assumption[] = menuItems.some((item) => item.servings !== undefined)
    ? [{ code: "explicit_menu_portions", message: "Gerichte und Portionszahlen aus ausdrücklichen Portionsangaben übernommen; übrige Leistungen vor Freigabe ergänzen und prüfen.", applied: true }]
    : [];
  if (explicitUncountedMenu.length && quantifiedMenu.length === 0) assumptions.push({ code: "explicit_menu_items", message: "Gerichte aus der Anfrage übernommen; Portionszahlen je Gericht sind noch offen.", applied: true });
  const uncertainties: Uncertainty[] = uniqueUncertainties(request.uncertainties ?? [], signals.uncertainties);
  if (explicitUncountedMenu.length && quantifiedMenu.length === 0) uncertainties.push({ field: "menuPlan.servings", message: "Die Portionszahlen je Gericht wurden nicht genannt.", severity: "medium", suggestedQuestion: "Wie viele Portionen werden je Gericht benötigt?" });
  for (const item of menuItems) {
    if (item.dietaryReviewNote) uncertainties.push({ field: "menuPlan", message: item.dietaryReviewNote, severity: "medium", suggestedQuestion: `Welche Ernährungskennzeichnung gilt nach Rezeptprüfung für ${item.label}?` });
  }

  if (!request.event?.type && !Object.keys(eventTypeKeywords).some(keyword => rawText.toLowerCase().includes(keyword))) {
    uncertainties.push({ field: "event.type", message: "Der Anlass ist nicht eindeutig angegeben.", severity: "medium", suggestedQuestion: "Welcher Anlass gilt?" });
  }
  if (!request.event?.serviceForm && !Object.keys(serviceFormKeywords).some(keyword => rawText.toLowerCase().replace(/\s+/g, "").includes(keyword))) {
    uncertainties.push({ field: "event.serviceForm", message: "Die Serviceform ist nicht eindeutig angegeben.", severity: "medium", suggestedQuestion: "Welche Serviceform gilt?" });
  }
  if (!request.event?.type) {
    assumptions.push({
      code: "event_type_defaulted",
      message: uncertainties.some(item => item.field === "event.type") ? "Anlass nicht angegeben; vorläufigen Standard bitte prüfen." : `Eventtyp aus dem Anfragetext abgeleitet: ${formatEventTypeLabel(eventType) ?? eventType}.`,
      applied: true
    });
  }

  if (!request.event?.serviceForm) {
    assumptions.push({
      code: "service_form_defaulted",
      message: uncertainties.some(item => item.field === "event.serviceForm") ? "Serviceform nicht angegeben; vorläufigen Standard bitte prüfen." : `Serviceform aus dem Anfragetext abgeleitet: ${formatServiceFormLabel(serviceForm) ?? serviceForm}.`,
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
    signals.approximateAttendeeCount === true
  ) {
    assumptions.push({
      code: "attendees_expected_approximate",
      message: "Teilnehmerzahl nur näherungsweise aus dem Anfragetext abgeleitet.",
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
    servings: explicitUncountedMenu.length && !quantifiedMenu.length ? item.servings : item.servings ?? attendees,
    dietaryTags: item.dietaryTags ?? []
  }));

  const mergeUniqueStrings = (primary: string[] | undefined, secondary: string[]): string[] | undefined => {
    const merged = [...new Set([...(primary ?? []), ...secondary])];
    return merged.length > 0 ? merged : undefined;
  };

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
    productionConstraints: mergeUniqueStrings(request.constraints, signals.constraints),
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
