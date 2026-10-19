import type { Uncertainty } from "./types.js";

export interface IntakeSignals {
  extractedFacts: string[];
  constraints: string[];
  uncertainties: Uncertainty[];
  attendeeCount?: number;
  approximateAttendeeCount?: boolean;
  eventDate?: string;
}

// Only an explicit labelled line supplies a customer identity; greetings,
// email signatures and dish descriptions are not reliable customer records.
export function extractLabeledCustomerName(text: string): string | undefined {
  const match = /^[ \t]*(?:Kunde|Kundenname|Auftraggeber)[ \t]*:[ \t]*([^\r\n]*)$/im.exec(text);
  const name = match?.[1]?.normalize("NFKC").replace(/\s+/gu, " ").trim();
  return name && name.length <= 320 ? name : undefined;
}

function addUniqueString(values: string[], value: string | undefined): void {
  if (!value) {
    return;
  }
  if (!values.includes(value)) {
    values.push(value);
  }
}

function addUniqueUncertainty(values: Uncertainty[], uncertainty: Uncertainty): void {
  if (
    !values.some(
      (entry) =>
        entry.field === uncertainty.field &&
        entry.message === uncertainty.message &&
        entry.severity === uncertainty.severity
    )
  ) {
    values.push(uncertainty);
  }
}

function normalizeSegment(segment: string): string {
  return segment.replace(/\s+/g, " ").trim();
}

function hasHedgeWords(segment: string): boolean {
  return /(?:\bca\.?\b|\bcirca\b|\betwa\b|\bungef(?:ä|ae)hr\b|\bknapp\b|\bwahrscheinlich\b|\beventuell\b|\bmöglicherweise\b|\bmoeglicherweise\b|\bvielleicht\b|\bvermutlich\b|\bnoch unklar\b|\bunklar\b|\boffen\b)/i.test(
    segment
  );
}

function toIsoTime(hour: string, minute?: string): string {
  return `${hour.padStart(2, "0")}:${minute ?? "00"}`;
}

function extractTimeHint(segment: string): string | undefined {
  const rangeMatch = segment.match(
    /\b(\d{1,2})(?::(\d{2}))?\s*(?:uhr)?\s*(?:bis|-|–|—|und)\s*(\d{1,2})(?::(\d{2}))?\b/i
  );
  if (rangeMatch) {
    return `${toIsoTime(rangeMatch[1], rangeMatch[2])}-${toIsoTime(rangeMatch[3], rangeMatch[4])}`;
  }

  const singleTimeMatch = segment.match(/\b(\d{1,2})(?::(\d{2}))?\s*uhr\b/i);
  if (singleTimeMatch) {
    return `${toIsoTime(singleTimeMatch[1], singleTimeMatch[2])}`;
  }

  if (/\b(?:vormittags|nachmittags|ab|bis|zwischen|frühestens|spaetestens|spätestens)\b/i.test(segment)) {
    return "zeitfenster";
  }

  return undefined;
}

export function isValidEventDate(value: string): boolean {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function extractDates(segment: string): string[] {
  const months: Record<string, string> = {januar:"01",februar:"02",märz:"03",maerz:"03",april:"04",mai:"05",juni:"06",
    juli:"07",august:"08",september:"09",oktober:"10",november:"11",dezember:"12"};
  return [...segment.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b|\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\b|\b(\d{1,2})\.?\s+(Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(20\d{2})\b/gi)]
    // Response deadlines are not event dates, even in the same paragraph.
    .filter(match => !/(?:\b(?:angebot|rückmeldung|rueckmeldung|antwort|frist|deadline)\b[^0-9.!?;\n]{0,80}\bbis(?:\s+(?:zum|spätestens|spaetestens))?|\b(?:frist|deadline|gesendet|sent)\s*:?)\s*$/i.test(segment.slice(0, match.index)))
    .map(match => match[1] ?? (match[5] ? `${match[7]}-${months[match[6].toLowerCase()]}-${match[5].padStart(2,"0")}` :
      `${match[4]}-${match[3].padStart(2, "0")}-${match[2].padStart(2, "0")}`));
}

function extractAttendeeObservation(segment: string):
  | { count: number; approximate: boolean; fact: string }
  | undefined {
  const normalized = normalizeSegment(segment);
  const hedge = hasHedgeWords(normalized);

  const rangeMatch = normalized.match(
    /\b(?:ca\.?|circa|etwa|ungef(?:ä|ae)hr|knapp)?\s*(\d{1,4})\s*(?:-|–|—|bis)\s*(\d{1,4})(?:\s*(?:gäste|gaeste|teilnehmer|personen|people))\b/i
  );
  if (rangeMatch) {
    const low = Number(rangeMatch[1]);
    const high = Number(rangeMatch[2]);
    if (Number.isFinite(low) && Number.isFinite(high) && low > 0 && high > 0) {
      const count = Math.round((low + high) / 2);
      return {
        count,
        approximate: true,
        fact: `attendees.expected≈${count}`
      };
    }
  }

  const approximateMatch = normalized.match(
    /\b(?:ca\.?|circa|etwa|ungef(?:ä|ae)hr|knapp)\s*(\d{1,4})(?:\s*(?:gäste|gaeste|teilnehmer|personen|people))?\b/i
  );
  if (approximateMatch) {
    const count = Number(approximateMatch[1]);
    if (Number.isFinite(count) && count > 0) {
      return {
        count,
        approximate: true,
        fact: `attendees.expected≈${count}`
      };
    }
  }

  const directMatch =
    normalized.match(/\b(?:für|fuer)\s+(\d{1,4})\s*(?:gäste|gaeste|teilnehmer|personen|people)?\b/i) ??
    normalized.match(/\b(\d{1,4})\s*(?:gäste|gaeste|teilnehmer|personen|people)\b/i);
  if (directMatch) {
    const count = Number(directMatch[1]);
    if (Number.isFinite(count) && count > 0) {
      return {
        count,
        approximate: hedge,
        fact: `attendees.expected=${count}`
      };
    }
  }

  return undefined;
}

const DIETARY_PATTERNS = [
  {
    canonical: "vegan",
    regex: /\bvegan(?:e|er|en|es)?\b/i
  },
  {
    canonical: "vegetarian",
    regex: /\bvegetarisch(?:e|er|en|es)?\b|\bvegetarian\b/i
  },
  {
    canonical: "gluten_free",
    regex: /\bglutenfrei\b|\bohne gluten\b/i
  },
  {
    canonical: "lactose_free",
    regex: /\blaktosefrei\b|\bohne laktose\b/i
  },
  {
    canonical: "nut_free",
    regex: /\bnussfrei\b|\b(?:ohne|keine(?:n|r)?|kein)\s+n(?:ü|ue|u)ss?e?\b|\ballergie[:\s-]*n(?:ü|ue|u)ss?e?\b/i
  },
  {
    canonical: "milk_free",
    regex: /\bmilchfrei\b|\b(?:ohne|keine(?:n|r)?|kein)\s+milch\b|\ballergie[:\s-]*milch\b/i
  }
] as const;

const requestLevelDietaryIntentPattern =
  /\b(?:bitte|muss|müssen|muessen|soll|sollen|sollte|sollten|alle|für alle|fuer alle|durchgehend|komplett|vollständig|vollstaendig|ausschließlich|ausschliesslich|restriktion|anforderung|allergie|intoleranz|ohne|kein|keine|keinen|frei|free)\b/i;

const globalMenuDietaryScopePattern =
  /\b(?:buffet|menü|menu|catering|event|veranstaltung|essen|lunch|dinner|angebot)\b/i;

const dietaryShareHeadingPattern =
  /^(?:vegan(?:e|er|en|es)?|vegetarisch(?:e|er|en|es)?|vegetarian)\s*(?:\|\s*)?\d{1,3}\s*%?$/i;

const dishContextPattern =
  /(?:quiche|hummus|gem(?:ü|ue)se|cups?|spie(?:ss|ß)e|brownie|bites?|tomaten|mozzarella|feta|kuchen|curry|reis|salat|suppe|bowl|tarte|pasta|nudel|kartoffel|kraut|zucchini|pilze|zuckerschoten|pak-choi|wildkr(?:ä|ae)uter|bulette|frikadelle|dessert|baguette|brot)/i;

function isComponentScopedDietarySegment(segment: string, canonical: string): boolean {
  if (canonical !== "vegan" && canonical !== "vegetarian") {
    return false;
  }

  if (dietaryShareHeadingPattern.test(segment)) {
    return true;
  }

  return dishContextPattern.test(segment) && !globalMenuDietaryScopePattern.test(segment);
}


function isGuestSubsetDietarySegment(segment: string, canonical: string): boolean {
  if (canonical === "vegan" || canonical === "vegetarian") return false;
  const pattern = DIETARY_PATTERNS.find(item => item.canonical === canonical);
  if (!pattern) return false;
  // Preserve German inflections in guest instructions without broadening
  // the canonical matcher that can assert a requirement for the whole menu.
  const guestDiet = pattern.regex.source.replaceAll(String.raw`frei\b`, String.raw`frei(?:e[nmrs]?)?\b`);
  const match = new RegExp(String.raw`\b[0-9]+\s+(?:gäste|gaeste|personen|teilnehmer)(?:\s+(?:benötigen|benoetigen|brauchen|wünschen|wuenschen|essen|sind|müssen|muessen|bitte)){0,2}\s+(?:${guestDiet})`, "i").exec(segment);
  if (!match || /\balle\s*$/i.test(segment.slice(0, match.index))) return false;
  const globalInSameClause = segment.split(/\b(?:und|aber|sowie)\b/i).some(clause =>
    pattern.regex.test(clause) && (
      /\b(?:gesamte[nmrs]?|komplette[nmrs]?|durchgehend|vollständig|vollstaendig|ausschließlich|ausschliesslich|alle)\b/i.test(clause)
      || new RegExp(String.raw`(?:Buffet|Menü|Menu|Catering|Event|Veranstaltung|Essen)\s+(?:muss|soll|sollte|müssen|muessen|sollen)\s+(?:${pattern.regex.source})`, "i").test(clause)
    )
  );
  return !globalInSameClause;
}

function shouldPromoteDietarySignalToConstraint(segment: string, canonical: string): boolean {
  if (isGuestSubsetDietarySegment(segment, canonical)) return false;
  if (canonical === "vegan" || canonical === "vegetarian") {
    const diet = canonical === "vegan" ? "vegan(?:e|er|en|es)?" : "(?:vegetarisch(?:e|er|en|es)?|vegetarian)";
    const explicitGlobal = /\b(?:gesamte[nmrs]?|komplett|durchgehend|ausschließlich|ausschliesslich|vollständig|vollstaendig)\b/i.test(segment)
      || /\b(?:alle Gäste|alle Gaeste|für alle|fuer alle)\b/i.test(segment)
      || new RegExp(diet+"\\s+(?:Buffet|Menü|Menu|Catering|Event|Veranstaltung|Essen)\\b", "i").test(segment)
      || new RegExp("(?:Buffet|Menü|Menu|Catering|Event|Veranstaltung|Essen)\\s+(?:muss|soll|sollte)\\s+(?:"+diet+")\\b", "i").test(segment);
    // Counts and guest choices describe part of a mixed menu. An explicit
    // whole-event mandate still takes precedence over that local wording.
    const portionOrGroup = new RegExp("\\b\\d+\\s+(?:Portion(?:en)?\\s+)?"+diet+"\\b", "i").test(segment)
      || new RegExp(diet+"\\s+(?:Optionen|Alternativen)\\b", "i").test(segment)
      || (/\b(?:Gäste|Gaeste|Personen)\b/i.test(segment)
        && new RegExp("(?:wählen|waehlen)\\s+"+diet+"\\b", "i").test(segment));
    if (portionOrGroup && !explicitGlobal) return false;
  }

  if (requestLevelDietaryIntentPattern.test(segment)) {
    return true;
  }

  if (globalMenuDietaryScopePattern.test(segment)) {
    return true;
  }

  return !isComponentScopedDietarySegment(segment, canonical);
}

function extractDietarySignals(segment: string): {
  confirmed: string[];
  tentative: string[];
} {
  const normalized = normalizeSegment(segment);
  const hedge = hasHedgeWords(normalized);
  const confirmed: string[] = [];
  const tentative: string[] = [];

  for (const pattern of DIETARY_PATTERNS) {
    if (!pattern.regex.test(normalized)) {
      continue;
    }

    if (hedge) {
      tentative.push(pattern.canonical);
    } else if (shouldPromoteDietarySignalToConstraint(normalized, pattern.canonical)) {
      confirmed.push(pattern.canonical);
    }
  }

  return { confirmed, tentative };
}

export function analyzeIntakeText(text: string): IntakeSignals {
  const extractedFacts: string[] = [];
  const constraints: string[] = [];
  const uncertainties: Uncertainty[] = [];
  const result: IntakeSignals = {
    extractedFacts,
    constraints,
    uncertainties
  };
  // Dates in a customer label or document header do not describe the event.
  const eventText = text.split(/\r?\n/).filter(line =>
    !/^[ \t]*(?:Kunde|Kundenname|Auftraggeber|Anfragedatum|Angebotsdatum|Rechnungsdatum|Erstellt(?: am)?|Gesendet|Sent|Stand|Nachprüfung)\s*:/i.test(line)
  ).join("\n");
  const segments = eventText.split(/[,;\n]+|(?<=[.!?])\s+(?=[A-ZÄÖÜ])/).map(normalizeSegment).filter(Boolean);
  // A day followed by a written month is one date, not two sentences.
  for (let index = 1; index < segments.length;) {
    const day = segments[index - 1].match(/\b(\d{1,2}\.)$/)?.[1];
    const month = segments[index].match(/^\p{L}+\s+20\d{2}\b/u)?.[0];
    if (day && month && extractDates(day + " " + month).length) {
      segments.splice(index - 1, 2, segments[index - 1] + " " + segments[index]);
    } else index += 1;
  }
  const dates = [...new Set(segments.flatMap(extractDates))];
  const selectedDate = dates.length === 1 && isValidEventDate(dates[0]) ? dates[0] : undefined;
  if (dates.length && !selectedDate) {
    addUniqueUncertainty(uncertainties, {
      field: "event.date", severity: "medium",
      message: "Mehrere oder ungültige Datumsangaben; Veranstaltungstermin nicht eindeutig.",
      suggestedQuestion: "Welches gültige Veranstaltungsdatum gilt verbindlich?"
    });
  }

  for (const segment of segments) {
    const attendee = extractAttendeeObservation(segment);
    if (attendee) {
      addUniqueString(extractedFacts, attendee.fact);
      if (result.attendeeCount === undefined) {
        result.attendeeCount = attendee.count;
      }
      if (attendee.approximate && result.approximateAttendeeCount === undefined) {
        result.approximateAttendeeCount = true;
      }
      if (attendee.approximate) {
        addUniqueUncertainty(uncertainties, {
          field: "attendees.expected",
          message: `Teilnehmerzahl nur ungefähr aus "${segment}" abgeleitet.`,
          severity: "medium",
          suggestedQuestion: "Wie viele Teilnehmer werden verbindlich erwartet?"
        });
      }
    }

    const date = selectedDate && extractDates(segment).includes(selectedDate) ? selectedDate : undefined;
    if (date) {
      addUniqueString(extractedFacts, `event.date=${date}`);
      if (result.eventDate === undefined) {
        result.eventDate = date;
      }
      if (hasHedgeWords(segment)) {
        addUniqueUncertainty(uncertainties, {
          field: "event.date",
          message: `Datum in "${segment}" wirkt nur als ungefähre Angabe.`,
          severity: "medium",
          suggestedQuestion: "Welches Datum gilt verbindlich?"
        });
      }
    }

    const timeHint = extractTimeHint(segment);
    if (timeHint) {
      addUniqueString(extractedFacts, `event.time=${timeHint}`);
      addUniqueUncertainty(uncertainties, {
        field: "event.schedule",
        message: `Zeitangabe in "${segment}" ist nicht als vollständiger Termin belastbar.`,
        severity: "low",
        suggestedQuestion: "Wie lautet das verbindliche Zeitfenster?"
      });
    }

    const labelledSchedule = /\b(?:Anlieferung|Lieferung|Aufbau|Abbau|Empfang|Abendbuffet|Buffet|Service|Beginn|Start|Ende|Abfahrt)\b/i.test(segment);
    if (labelledSchedule && (timeHint || /\b(?:[01]?\d|2[0-3]):[0-5]\d\b/.test(segment))) {
      // Keep the source wording through handoff and frozen snapshots;
      // parsing a clock time is not an agreed operational schedule.
      addUniqueString(constraints, `Zeit-/Logistikangabe aus Anfrage (ungeprüft): ${segment}`);
    }

    const subsetDietary = DIETARY_PATTERNS.some(pattern => isGuestSubsetDietarySegment(segment, pattern.canonical));
    if (subsetDietary || /schalenfrucht(?:vermeidung|allergie|frei)?/i.test(segment)) {
      // A subset request is not a free-from claim for the complete menu.
      addUniqueString(constraints, `Sonderkost angefragt; separat klären: ${segment}`);
      addUniqueUncertainty(uncertainties, {
        field: "productionConstraints",
        message: "Angefragte Sonderkostfälle benötigen eine gesonderte fachliche Klärung.",
        severity: "medium",
        suggestedQuestion: "Welche Maßnahmen und Freigaben gelten für die angefragten Sonderkostfälle?"
      });
    }
    const dietary = extractDietarySignals(segment);
    for (const constraint of dietary.confirmed) {
      addUniqueString(extractedFacts, `constraint=${constraint}`);
      if (!constraints.includes(constraint)) {
        constraints.push(constraint);
      }
    }

    if (dietary.tentative.length > 0) {
      addUniqueUncertainty(uncertainties, {
        field: "productionConstraints",
        message: `Ernährungs-/Allergieangabe in "${segment}" ist nur tentative formuliert.`,
        severity: "medium",
        suggestedQuestion: "Welche Ernährungs- oder Allergieanforderungen sind verbindlich?"
      });
    }
  }

  return result;
}
