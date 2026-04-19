function addUniqueString(values, value) {
    if (!value) {
        return;
    }
    if (!values.includes(value)) {
        values.push(value);
    }
}
function addUniqueUncertainty(values, uncertainty) {
    if (!values.some((entry) => entry.field === uncertainty.field && entry.message === uncertainty.message && entry.severity === uncertainty.severity)) {
        values.push(uncertainty);
    }
}
function normalizeSegment(segment) {
    return segment.replace(/\s+/g, " ").trim();
}
function hasHedgeWords(segment) {
    return /(?:\bca\.?\b|\bcirca\b|\betwa\b|\bungef(?:ä|ae)hr\b|\bknapp\b|\bwahrscheinlich\b|\beventuell\b|\bmöglicherweise\b|\bmoeglicherweise\b|\bvielleicht\b|\bvermutlich\b|\bnoch unklar\b|\bunklar\b|\boffen\b)/i.test(segment);
}
function toIsoTime(hour, minute) {
    return `${hour.padStart(2, "0")}:${minute ?? "00"}`;
}
function extractTimeHint(segment) {
    const rangeMatch = segment.match(/\b(\d{1,2})(?::(\d{2}))?\s*(?:uhr)?\s*(?:bis|-|–|—|und)\s*(\d{1,2})(?::(\d{2}))?\b/i);
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
function extractDate(segment) {
    const isoMatch = segment.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    if (isoMatch) {
        return isoMatch[1];
    }
    const germanMatch = segment.match(/\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\b/);
    if (!germanMatch) {
        return undefined;
    }
    const [, day, month, year] = germanMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}
function extractAttendeeObservation(segment) {
    const normalized = normalizeSegment(segment);
    const hedge = hasHedgeWords(normalized);
    const rangeMatch = normalized.match(/\b(?:ca\.?|circa|etwa|ungef(?:ä|ae)hr|knapp)?\s*(\d{1,4})\s*(?:-|–|—|bis)\s*(\d{1,4})(?:\s*(?:gäste|gaeste|teilnehmer|personen|people))\b/i);
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
    const approximateMatch = normalized.match(/\b(?:ca\.?|circa|etwa|ungef(?:ä|ae)hr|knapp)\s*(\d{1,4})(?:\s*(?:gäste|gaeste|teilnehmer|personen|people))?\b/i);
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
    const directMatch = normalized.match(/\b(?:für|fuer)\s+(\d{1,4})\s*(?:gäste|gaeste|teilnehmer|personen|people)?\b/i) ??
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
];
function extractDietarySignals(segment) {
    const normalized = normalizeSegment(segment);
    const hedge = hasHedgeWords(normalized);
    const confirmed = [];
    const tentative = [];
    for (const pattern of DIETARY_PATTERNS) {
        if (!pattern.regex.test(normalized)) {
            continue;
        }
        if (hedge) {
            tentative.push(pattern.canonical);
        }
        else {
            confirmed.push(pattern.canonical);
        }
    }
    return { confirmed, tentative };
}
export function analyzeIntakeText(text) {
    const extractedFacts = [];
    const constraints = [];
    const uncertainties = [];
    const result = {
        extractedFacts,
        constraints,
        uncertainties
    };
    const segments = text.split(/[,;\n]+/).map(normalizeSegment).filter(Boolean);
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
        const date = extractDate(segment);
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
