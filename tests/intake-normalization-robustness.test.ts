import { readFileSync } from "node:fs";
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

  it("carries an explicit customer line through normalization without guessing a greeting or consuming the next line", () => {
    const spec = normalizeEventRequestToSpec(createEventRequestFromText({ requestId: "named-source", channel: "text",
      rawText: "Kunde: SYNTHETISCHES Wissenschaftsforum\nEmpfang für 100 Gäste am 12.11.2026." }));
    expect(spec.customer?.name).toBe("SYNTHETISCHES Wissenschaftsforum");
    for (const rawText of ["Hallo Frau Beispiel, wir planen einen Empfang.", "Kunde:\nEmpfang für 100 Gäste.", `Kunde: ${"x".repeat(321)}`]) {
      expect(createEventRequestFromText({ requestId: "unknown-customer", channel: "text", rawText }).customer).toBeUndefined();
    }
  });

  it("keeps dish-level vegan and vegetarian labels out of global production constraints", () => {
    const request = createEventRequestFromText({
      requestId: "mixed-diet-menu-1",
      channel: "text",
      rawText: [
        "Empfang am 2026-06-18 fuer 75 Teilnehmer.",
        "Mini-Quiche Spinat Feta;",
        "Hummus-Gemuese-Cups vegan;",
        "Tomaten-Mozzarella-Spiesse vegetarisch;",
        "Brownie-Bites."
      ].join(" ")
    });
    const spec = normalizeEventRequestToSpec(request);

    expect(request.extractedFacts ?? []).not.toEqual(
      expect.arrayContaining(["constraint=vegan", "constraint=vegetarian"])
    );
    expect(request.constraints ?? []).not.toEqual(
      expect.arrayContaining(["vegan", "vegetarian"])
    );
    expect(spec.productionConstraints ?? []).not.toEqual(
      expect.arrayContaining(["vegan", "vegetarian"])
    );
  });

  it("does not turn explicit mixed-menu portions and guest subgroups into a global vegan mandate", () => {
    const rawText = "SYNTHETISCHER TESTAUFTRAG – KEIN ECHTER KUNDE. Kunde TEST NÜRNBERG Wissenschaftsforum, test-catering@example.invalid. Wissenschaftliche Abendveranstaltung am 12.11.2026 in Nürnberg für 100 Erwachsene. Empfang 18:00–19:00 mit 200 kleinen Canapés à 25–35 g, davon 100 vegan und 100 vegetarisch. Abendbuffet 19:00–21:00: 55 Portionen Hähnchenragout, 25 Portionen vegetarische Gemüsebratlinge, 20 Portionen veganes Linsenragout; jeweils 150 g gegarte Hauptkomponente. Für alle 100 Gäste je 180 g gegarte Rosmarinkartoffeln und 150 g gegartes Ofengemüse. Dessert: 80 Quarkcreme und 20 vegane Fruchtkompotte à 100 g. Gäste: 60 omnivor, 25 vegetarisch, 15 vegan; fünf omnivore Gäste wählen veganes Hauptgericht und Dessert. Insgesamt 100 Hauptgerichte und Desserts, Diätuntergruppen nicht addieren. Vier Gäste benötigen glutenfreie Speisen, drei dürfen keine Schalenfrüchte erhalten; Gruppen können sich überschneiden. Konkrete Allergene, Lieferantendeklarationen und Kreuzkontakte vor Freigabe klären; keine unbelegte Allergenfreiheit. Für glutenfreie Gäste geeignete getrennte Empfangshäppchen und Hauptgerichte vorsehen. Personalannahme: zwei Küchenkräfte je acht Stunden, vier Servicekräfte je sechs Stunden und eine Fahrkraft fünf Stunden, zusammen 45 Stunden. Logistik: Warm- und Kühltransport, getrennte beschriftete Sonderkost, GN-Behälter, Warmhaltung und Geschirr. Anlieferung 16:30, Aufbau bis 17:45, Abbau ab 21:00. Budgetrahmen 6.500 EUR netto einschließlich Personal und Logistik. Umsatzsteuer und Bruttopreis aus bestehender tatsächlicher Kalkulation ausweisen; keine fingierten Rezept- oder Einkaufspreise. Vollständiges Angebot, nachvollziehbare Leistungen, Ernährungskennzeichnung, Allergene, Personal und Transport; offene Annahmen sichtbar klären. Ausschließlich diesen Testauftrag bearbeiten.";
    const request = createEventRequestFromText({ requestId: "nue-mixed-100", channel: "text", rawText });
    const spec = normalizeEventRequestToSpec(request);
    expect(spec.productionConstraints ?? []).not.toContain("vegan");
    expect(spec.productionConstraints ?? []).not.toContain("vegetarian");
    expect(spec.menuPlan.map(item => item.servings)).toEqual([55, 25, 20]);
  });

  it.each(["Das gesamte Buffet muss vegan sein.", "Das Buffet muss vegan sein und glutenfreie Optionen bieten.", "Bitte veganes Buffet mit glutenfreien Alternativen.", "Wir wählen ein veganes Buffet.", "Alle Gäste erhalten ausschließlich vegane Speisen.", "25 vegane Portionen; das gesamte Catering muss vegan sein.", "25 vegane Portionen. Das gesamte Buffet muss vegan sein.", "25 vegane Portionen, das Buffet muss vegan sein."])(
    "retains an explicit global vegan mandate: %s", rawText => {
      expect(createEventRequestFromText({ requestId: "global-vegan", channel: "text", rawText }).constraints).toContain("vegan");
    }
  );

  it("retains hard allergy constraints alongside portion-scoped diet labels", () => {
    const request = createEventRequestFromText({ requestId: "allergy-mixed", channel: "text",
      rawText: "25 Portionen vegetarische Bratlinge, 20 Portionen veganes Linsenragout. Allergie: keine Milch, ohne Gluten." });
    expect(request.constraints).toEqual(expect.arrayContaining(["milk_free", "gluten_free"]));
  });

  it("extracts comma-separated dishes after an inline menu marker", () => {
    const request = createEventRequestFromText({
      requestId: "inline-menu-marker-1",
      channel: "text",
      rawText:
        "Lunch am 2026-08-12 für 42 Teilnehmer als Buffet. Menü: Tomatensuppe, Pasta, Salat, Kaffee. Lieferung um 11:30 Uhr, Service ab 12:00 Uhr."
    });
    const spec = normalizeEventRequestToSpec(request);

    expect(spec.attendees.expected).toBe(42);
    expect(spec.event.date).toBe("2026-08-12");
    expect(spec.menuPlan.map((component) => component.label)).toEqual([
      "Tomatensuppe",
      "Pasta",
      "Salat",
      "Kaffee"
    ]);
    expect(spec.menuPlan.map((component) => component.label).join(" ")).not.toContain("Lunch am");
    expect(spec.menuPlan.map((component) => component.label).join(" ")).not.toContain("Lieferung");
  });
  it("retains the exact synthetic 100-guest request's special diets and labelled schedule as unapproved source instructions", () => {
    const text = readFileSync(new URL("./fixtures/synthetic-100-guest-request.txt", import.meta.url), "utf8");
    const request = createEventRequestFromText({ requestId: "exact-source-context", channel: "text", rawText: text });
    const spec = normalizeEventRequestToSpec(request);
    const notes = spec.productionConstraints?.join("\n") ?? "";
    for (const detail of ["4 Gäste benötigen glutenfreie Sonderkost", "3 Gäste Schalenfruchtvermeidung", "Empfang 18:00–19:00", "Abendbuffet 19:00–21:00", "Anlieferung 16:30", "Aufbau 17:45", "Abbau 21:00"]) {
      expect(notes).toContain(detail);
    }
    expect(spec.productionConstraints).not.toContain("gluten_free");
    expect(spec.productionConstraints).not.toContain("nut_free");
    expect(spec.uncertainties?.some(item => item.field === "productionConstraints")).toBe(true);
    expect(spec.uncertainties?.some(item => item.field === "event.schedule")).toBe(true);
    expect(spec.attendees.expected).toBe(100);
  });

  it.each(["glutenfreie", "glutenfreies", "laktosefreie", "milchfreie", "nussfreie"])(
    "retains inflected guest-subset instructions without creating a global free-from claim: %s", word => {
      const text = `4 Gäste benötigen ${word} Sonderkost.`;
      const request = createEventRequestFromText({ requestId: "inflected-subset", channel: "text", rawText: text });
      expect(request.constraints?.join(" ")).toContain(text);
      expect(request.constraints?.filter(value => ["gluten_free", "lactose_free", "milk_free", "nut_free"].includes(value))).toEqual([]);
    }
  );

  it("does not turn unscoped gluten-free options into a whole-menu requirement", () => {
    const request = createEventRequestFromText({ requestId: "free-from-options", channel: "text", rawText: "Bitte glutenfreie Optionen zum Buffet anbieten." });
    expect(request.constraints ?? []).not.toContain("gluten_free");
  });

  it("retains guest-subset special diets as open instructions without declaring the entire menu free-from", () => {
    const request = createEventRequestFromText({ requestId: "subset-dietary", channel: "text", rawText: "Wissenschaftsabend am 12.11.2026 für 100 Gäste. 4 Gäste glutenfrei, 3 Schalenfruchtvermeidung. Empfang 18:00–19:00." });
    const spec = normalizeEventRequestToSpec(request);
    expect(spec.productionConstraints?.join(" ")).toContain("4 Gäste glutenfrei");
    expect(spec.productionConstraints?.join(" ")).toContain("3 Schalenfruchtvermeidung");
    expect(spec.productionConstraints).not.toContain("gluten_free");
    expect(spec.uncertainties?.some(item => item.field === "productionConstraints")).toBe(true);
    expect(spec.attendees.expected).toBe(100);
  });

  it.each([
    { text: "Für 100 Gäste muss das komplette Buffet glutenfrei sein.", expected: ["gluten_free"] },
    { text: "Das gesamte Buffet muss vegan sein und 4 Gäste benötigen glutenfrei.", expected: ["vegan"], excluded: "gluten_free" },
    { text: "Für alle 100 Gäste glutenfrei.", expected: ["gluten_free"] },
    { text: "Das Buffet muss glutenfrei sein und 4 Gäste benötigen glutenfrei.", expected: ["gluten_free"] },
    { text: "4 Gäste glutenfrei und das gesamte Buffet muss glutenfrei sein.", expected: ["gluten_free"] }
  ])("preserves explicit global requirements: $text", ({ text, expected, excluded }) => {
    const request = createEventRequestFromText({ requestId: "global-dietary-scope", channel: "text", rawText: text });
    const spec = normalizeEventRequestToSpec(request);
    expect(spec.productionConstraints).toEqual(expect.arrayContaining(expected));
    if (excluded) expect(spec.productionConstraints).not.toContain(excluded);
  });

});
