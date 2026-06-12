import { describe, expect, it } from "vitest";
import {
  buildProductionAssumptions,
  buildProductionQuestions
} from "../backoffice-ui/src/production-question-language-state.js";

describe("production question language state", () => {
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

  it("keeps clear Brot/Baguette quiet as an implicit baker purchase unless gluten-free blocks it", () => {
    const baseSpec = {
      readiness: { status: "complete" },
      event: {
        type: "lunch",
        date: "2026-03-04"
      },
      attendees: {
        expected: 120
      },
      servicePlan: {
        serviceForm: "buffet"
      },
      menuPlan: [
        {
          componentId: "brot-baguette",
          label: "BROT & BAGUETTE"
        }
      ]
    };

    expect(buildProductionQuestions(baseSpec)).toEqual([]);
    expect(
      buildProductionQuestions({
        ...baseSpec,
        productionConstraints: ["gluten_free"]
      })
    ).toEqual([
      "BROT & BAGUETTE: Herstellungsentscheidung fehlt. Bitte Eigenproduktion, Hybrid, Convenience-Zukauf oder Fertigprodukt festlegen.",
      "BROT & BAGUETTE: Kategorie fehlt. Bitte klassisch, vegetarisch oder vegan festlegen."
    ]);
  });

  it("calls out Focaccia as a hybrid sourcing clarification", () => {
    const questions = buildProductionQuestions({
      readiness: { status: "insufficient" },
      event: {
        type: "lunch",
        date: "2026-03-04"
      },
      attendees: {
        expected: 80
      },
      servicePlan: {
        serviceForm: "buffet"
      },
      menuPlan: [
        {
          componentId: "focaccia",
          label: "Focaccia",
          menuCategory: "classic"
        }
      ]
    });

    expect(questions).toEqual([
      "Focaccia: Hybridfall. Bitte bewusst entscheiden, ob Eigenproduktion, Bäcker-Zukauf, Convenience-Zukauf oder Fertigprodukt gilt."
    ]);
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
        {
          code: "event_type_defaulted",
          message: "Eventtyp aus dem Anfragetext abgeleitet: Lunch.",
          applied: true
        },
        {
          code: "service_form_defaulted",
          message: "Serviceform aus dem Anfragetext abgeleitet: Buffet.",
          applied: true
        }
      ]
    });

    expect(assumptions).toEqual([
      "Veranstaltungstyp als Lunch abgeleitet.",
      "Serviceform als Buffet abgeleitet."
    ]);
  });
});
