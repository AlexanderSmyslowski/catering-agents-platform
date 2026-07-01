import { describe, expect, it } from "vitest";
import { buildProductionUploadResultSummary } from "../backoffice-ui/src/production-upload-result-summary-state.js";

describe("production upload result summary state", () => {
  const focusedProductionSpec = {
    event: { type: "conference", date: "2026-07-15" },
    attendees: { expected: 90 },
    servicePlan: { serviceForm: "buffet" },
    customer: { name: "Universität Heidelberg" },
    venue: { name: "Neue Aula" },
    menuPlan: [
      {
        componentId: "component-1",
        label: "Lunchbuffet",
        menuCategory: "classic",
        productionDecision: { mode: "hybrid" }
      },
      {
        componentId: "component-2",
        label: "Dessert im Glas",
        menuCategory: "vegetarian",
        productionDecision: { mode: "external_finished" }
      }
    ]
  };

  it("builds a visible post-upload summary from the focused spec", () => {
    const summary = buildProductionUploadResultSummary({
      documentPhase: "done",
      productionWorkspaceCleared: false,
      focusedProductionSpec,
      productionQuestions: ["Welche Komponenten werden fertig zugekauft?"],
      productionAssumptions: ["Lunchbuffet als Hybrid-Produktion angenommen."],
      currentSpecPlans: [],
      currentSpecPurchaseLists: [],
      productionNextStep: {
        title: "Rückfragen beantworten",
        description: "Offene Angaben prüfen."
      }
    });

    expect(summary).toMatchObject({
      statusLabel: "Anfrage erfasst. Produktionsdaten prüfen.",
      facts: [
        { label: "Anlass", value: "Konferenz" },
        { label: "Personen", value: "90 Teilnehmer" },
        { label: "Datum", value: "2026-07-15" },
        { label: "Serviceform", value: "Buffet" },
        { label: "Kunde", value: "Universität Heidelberg" },
        { label: "Ort", value: "Neue Aula" }
      ],
      menuItems: [
        "Lunchbuffet · Klassisch · Hybrid",
        "Dessert im Glas · Vegetarisch · Fertigprodukt / extern"
      ],
      openItems: [
        "1 Rückfrage offen",
        "1 Annahme prüfen",
        "Produktionsplan noch nicht berechnet.",
        "Einkaufsliste entsteht erst nach der Berechnung."
      ],
      nextStepLabel: "Rückfragen beantworten: Offene Angaben prüfen."
    });
  });

  it("stays hidden until a completed upload has an active spec", () => {
    expect(
      buildProductionUploadResultSummary({
        documentPhase: "analysing",
        productionWorkspaceCleared: false,
        focusedProductionSpec,
        productionQuestions: [],
        productionAssumptions: [],
        currentSpecPlans: [],
        currentSpecPurchaseLists: [],
        productionNextStep: { title: "Warten", description: "Analyse läuft." }
      })
    ).toBeUndefined();
    expect(
      buildProductionUploadResultSummary({
        documentPhase: "done",
        productionWorkspaceCleared: true,
        focusedProductionSpec,
        productionQuestions: [],
        productionAssumptions: [],
        currentSpecPlans: [],
        currentSpecPurchaseLists: [],
        productionNextStep: { title: "Neu starten", description: "Datei einfügen." }
      })
    ).toBeUndefined();
  });
});
