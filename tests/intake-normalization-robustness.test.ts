import { describe, expect, it } from "vitest";
import {
  createEventRequestFromText,
  normalizeEventRequestToSpec
} from "@catering/shared-core";

function assumptionCodes(spec: ReturnType<typeof normalizeEventRequestToSpec>): string[] {
  return spec.assumptions?.map((assumption) => assumption.code) ?? [];
}

function uncertaintyFields(spec: ReturnType<typeof normalizeEventRequestToSpec>): string[] {
  return spec.uncertainties?.map((uncertainty) => uncertainty.field) ?? [];
}

describe("intake normalization robustness", () => {
  it.each([
    {
      name: "extracts a clear attendee count, a date, and confirmed dietary constraints",
      text: "Konferenz am 2026-07-03 fuer 60 Teilnehmer. Bitte vegetarisch und ohne Nuesse.",
      expectedAttendees: 60,
      expectedFacts: ["event.date=2026-07-03", "attendees.expected=60", "constraint=vegetarian", "constraint=nut_free"],
      expectedConstraints: ["vegetarian", "nut_free"],
      expectedUncertainties: [],
      expectedReadiness: "complete"
    },
    {
      name: "keeps approximate counts explicit and marks tentative diet wording as unclear",
      text: "ca. 50 Personen, wahrscheinlich vegetarisch, eventuell glutenfrei, Datum noch unklar.",
      expectedAttendees: 50,
      expectedFacts: ["attendees.expected≈50"],
      expectedConstraints: [],
      expectedUncertainties: ["attendees.expected", "event.date", "productionConstraints"],
      expectedReadiness: "insufficient"
    },
    {
      name: "uses the midpoint for a numeric range and keeps a confirmed vegan constraint",
      text: "40-50 Gäste, veganes Buffet, Termin 2026-06-12.",
      expectedAttendees: 45,
      expectedFacts: ["attendees.expected≈45", "event.date=2026-06-12", "constraint=vegan"],
      expectedConstraints: ["vegan"],
      expectedUncertainties: ["attendees.expected"],
      expectedReadiness: "complete"
    },
    {
      name: "accepts a rough count while keeping time hints separate from hard facts",
      text: "knapp 30 Teilnehmer, laktosefrei und ohne Nuesse, Start 10 Uhr, Datum 03.07.2026.",
      expectedAttendees: 30,
      expectedFacts: ["attendees.expected≈30", "event.date=2026-07-03", "constraint=lactose_free", "constraint=nut_free"],
      expectedConstraints: ["lactose_free", "nut_free"],
      expectedUncertainties: ["attendees.expected", "event.schedule"],
      expectedReadiness: "complete"
    },
    {
      name: "keeps mixed dietary requirements explicit while still treating the date as missing",
      text: "60 Personen, vegetarisch und laktosefrei, wahrscheinlich Buffet, noch kein Termin.",
      expectedAttendees: 60,
      expectedFacts: ["attendees.expected=60", "constraint=vegetarian", "constraint=lactose_free"],
      expectedConstraints: ["vegetarian", "lactose_free"],
      expectedUncertainties: ["event.date"],
      expectedReadiness: "insufficient"
    },
    {
      name: "stays insufficient when both the date and the attendee count are unclear",
      text: "Event ohne Datum fuer unklare Teilnehmerzahl.",
      expectedAttendees: undefined,
      expectedFacts: [],
      expectedConstraints: [],
      expectedUncertainties: ["event.date_or_schedule", "attendees.expected"],
      expectedReadiness: "insufficient"
    },
    {
      name: "keeps a hedged date explicit while still extracting a numeric count",
      text: "Vielleicht ist es der 2026-08-20, fuer 75 Personen mit Lunchbuffet.",
      expectedAttendees: 75,
      expectedFacts: ["attendees.expected=75", "event.date=2026-08-20"],
      expectedConstraints: [],
      expectedUncertainties: ["event.date"],
      expectedReadiness: "complete"
    },
    {
      name: "does not crash on several conditions in one sentence",
      text: "40 Personen, Termin 2026-09-01, von 10 Uhr bis 12 Uhr und spaeter noch einmal 13 Uhr bis 14 Uhr, vegetarisch.",
      expectedAttendees: 40,
      expectedFacts: ["attendees.expected=40", "event.date=2026-09-01", "constraint=vegetarian"],
      expectedConstraints: ["vegetarian"],
      expectedUncertainties: ["event.schedule"],
      expectedReadiness: "complete"
    },
    {
      name: "keeps multiple confirmed dietary constraints separate from an open date",
      text: "ca. 80 Gäste; vegan; glutenfrei; Allergie: Nüsse; Zeitpunkt offen; Lunchbuffet.",
      expectedAttendees: 80,
      expectedFacts: ["attendees.expected≈80", "constraint=vegan", "constraint=gluten_free", "constraint=nut_free"],
      expectedConstraints: ["vegan", "gluten_free", "nut_free"],
      expectedUncertainties: ["attendees.expected", "event.date_or_schedule"],
      expectedReadiness: "insufficient"
    },
    {
      name: "prefers the clearer explicit count over a hedged alternative count",
      text: "45 Personen bzw. vielleicht 60, aber 45 ist wahrscheinlicher. Datum 2026-10-10.",
      expectedAttendees: 45,
      expectedFacts: ["attendees.expected=45", "event.date=2026-10-10"],
      expectedConstraints: [],
      expectedUncertainties: ["attendees.expected"],
      expectedReadiness: "complete"
    }
  ])(
    "$name",
    ({
      text,
      expectedAttendees,
      expectedFacts,
      expectedConstraints,
      expectedUncertainties,
      expectedReadiness
    }) => {
      const request = createEventRequestFromText({
        requestId: "dirty-intake-1",
        channel: "text",
        rawText: text
      });
      const spec = normalizeEventRequestToSpec(request);

      if (expectedAttendees === undefined) {
        expect(spec.attendees.expected).toBeUndefined();
      } else {
        expect(spec.attendees.expected).toBe(expectedAttendees);
      }

      if (expectedFacts.length > 0) {
        expect(request.extractedFacts ?? []).toEqual(expect.arrayContaining(expectedFacts));
      }

      if (expectedConstraints.length > 0) {
        expect(request.constraints ?? []).toEqual(expect.arrayContaining(expectedConstraints));
      }

      if (expectedUncertainties.length > 0) {
        expect(uncertaintyFields(spec)).toEqual(expect.arrayContaining(expectedUncertainties));
      }

      if (expectedReadiness) {
        expect(spec.readiness.status).toBe(expectedReadiness);
      }

      if (/ca\.|knapp|40-50|45 ist wahrscheinlicher|Vielleicht/i.test(text)) {
        expect(assumptionCodes(spec)).toContain("attendees_expected_approximate");
      }
    }
  );
});
