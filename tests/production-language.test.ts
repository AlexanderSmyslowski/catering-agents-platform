import { describe, expect, it } from "vitest";
import {
  buildProductionAssumptions,
  buildProductionQuestions,
  getSpecLabel
} from "../backoffice-ui/src/production-language.js";

describe("production language helpers", () => {
  it("shows missing production decision and category per affected position", () => {
    const questions = buildProductionQuestions({
      readiness: { status: "insufficient" },
      event: {
        type: "coffee_break"
      },
      attendees: {
        expected: 35
      },
      servicePlan: {
        serviceForm: "coffee_break"
      },
      menuPlan: [
        {
          componentId: "coffee-break-station",
          label: "Coffee Break Station",
          menuCategory: "classic"
        },
        {
          componentId: "savoury-snack",
          label: "Savoury Snack",
          productionDecision: {
            mode: "hybrid"
          }
        }
      ]
    });

    expect(questions).toContain(
      "Coffee Break Station: Herstellungsentscheidung fehlt. Bitte Eigenproduktion, Hybrid, Convenience-Zukauf oder Fertigprodukt festlegen."
    );
    expect(questions).toContain("Savoury Snack: Kategorie fehlt. Bitte klassisch, vegetarisch oder vegan festlegen.");
    expect(questions.join(" ")).not.toContain("Bitte je Gericht festlegen");
    expect(questions.join(" ")).not.toContain("Bitte je Gericht kennzeichnen");
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
