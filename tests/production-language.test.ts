import { describe, expect, it } from "vitest";
import {
  buildProductionAssumptions,
  buildProductionQuestions,
  getSpecLabel
} from "../backoffice-ui/src/production-language.js";

describe("production language helpers", () => {
  it("translates production questions into clear German without raw field keys", () => {
    const questions = buildProductionQuestions({
      readiness: { status: "insufficient" },
      event: {
        type: "lunch"
      },
      attendees: {},
      servicePlan: {},
      menuPlan: [
        {
          componentId: "quiche-1",
          label: "Quiche"
        }
      ],
      missingFields: ["attendees.expected", "servicePlan.serviceForm", "menuPlan"]
    });

    expect(questions).toContain("Mit welcher verbindlichen Teilnehmerzahl soll kalkuliert und produziert werden?");
    expect(questions).toContain("Welche Serviceform gilt: Buffet, Menü, Flying oder Ausgabe?");
    expect(questions).toContain(
      "Bitte je Gericht festlegen, ob es eigenproduziert, hybrid gefertigt, als Convenience-Komponente zugekauft oder als Fertigprodukt beschafft wird."
    );
    expect(questions).toContain(
      "Bitte je Gericht kennzeichnen, ob es klassisch, vegetarisch oder vegan ist, wenn das aus dem Angebot nicht eindeutig hervorgeht."
    );
    expect(questions.join(" ")).not.toContain("attendees.expected");
    expect(questions.join(" ")).not.toContain("servicePlan.serviceForm");
  });

  it("translates inferred assumptions into German", () => {
    const assumptions = buildProductionAssumptions({
      event: {
        type: "lunch",
        serviceForm: "buffet"
      },
      servicePlan: {
        serviceForm: "buffet"
      },
      assumptions: [
        { code: "event_type_defaulted", message: "Event type inferred as lunch.", applied: true },
        { code: "service_form_defaulted", message: "Service form inferred as buffet.", applied: true }
      ]
    });

    expect(assumptions).toEqual([
      "Veranstaltungstyp als Lunch abgeleitet.",
      "Serviceform als Buffet abgeleitet."
    ]);
  });

  it("builds German labels for specs with lunch events", () => {
    const label = getSpecLabel({
      event: {
        type: "lunch",
        date: "2026-03-04"
      },
      attendees: {
        expected: 120
      }
    });

    expect(label).toBe("Lunch · 120 Teilnehmer · 2026-03-04");
  });
});
