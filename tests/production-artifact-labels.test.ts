import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductionPlanDownloadCard } from "../backoffice-ui/src/production-plan-download-card.js";
import { ProductionPlanList } from "../backoffice-ui/src/production-plan-list.js";
import { ProductionObjectsPanel } from "../backoffice-ui/src/production-objects-panel.js";
import { ProductionPurchaseListPanel } from "../backoffice-ui/src/production-purchase-list-panel.js";

const lunchSpec = {
  specId: "spec-lunch",
  event: {
    type: "lunch",
    date: "2026-06-18"
  },
  attendees: {
    expected: 40
  }
};

const dinnerSpec = {
  specId: "spec-dinner",
  event: {
    type: "dinner",
    date: "2026-06-19"
  },
  attendees: {
    expected: 24
  }
};

describe("production artifact labels", () => {
  it("offers each selected-plan document once without reselecting the only current plan", () => {
    const plan = {
      planId: "plan-lunch",
      eventSpecId: "spec-lunch",
      readiness: { status: "complete" },
      productionBatches: [], kitchenSheets: [], recipeSelections: [], unresolvedItems: []
    };
    const markup = renderToStaticMarkup(createElement(ProductionObjectsPanel, {
      progressState: { planPhase: "idle", planProgress: 0 },
      objectsState: {
        focusedProductionSpec: lunchSpec, productionWorkspaceCleared: false,
        currentSpecPlans: [plan], selectedPlan: plan, selectedPlanSpec: lunchSpec,
        selectedPlanComponentsById: new Map(), archivedPlans: [], specById: new Map([["spec-lunch", lunchSpec]])
      },
      objectsActions: { setSelectedPlanId: () => undefined }, submitting: false
    }));
    expect(markup.match(/href="\/api\/exports\/v1\/exports\/production-plans\/plan-lunch\/html"/g)).toHaveLength(1);
    expect(markup).not.toContain("Einzelheiten");
    expect(markup).toContain("Fachliche Rückfragen und Freigaben separat prüfen.");
  });

  it("uses normalized spec ids for production plan labels", () => {
    const markup = renderToStaticMarkup(
      createElement(ProductionPlanList, {
        plans: [
          {
            planId: " plan-lunch-list ",
            eventSpecId: " spec-lunch ",
            readiness: { status: "complete" },
            productionBatches: [],
            kitchenSheets: [],
            recipeSelections: [],
            unresolvedItems: []
          }
        ],
        specById: new Map([["spec-lunch", lunchSpec]]),
        submitting: false,
        setSelectedPlanId: () => undefined
      })
    );

    expect(markup).toContain("Lunch · 40 Teilnehmer · 2026-06-18");
    expect(markup).toContain('href="/api/exports/v1/exports/production-plans/plan-lunch-list/html"');
    expect(markup).not.toContain("<strong>Produktionsplan</strong>");
  });

  it("keeps the other plan exports available when the selected plan has its document card", () => {
    const markup = renderToStaticMarkup(createElement(ProductionPlanList, {
      plans: [{ planId: " plan-lunch ", eventSpecId: "spec-lunch" }, { planId: "plan-dinner", eventSpecId: "spec-dinner" }],
      specById: new Map([["spec-lunch", lunchSpec], ["spec-dinner", dinnerSpec]]),
      selectedPlanId: " plan-lunch ", submitting: false, setSelectedPlanId: () => undefined
    }));
    expect(markup).not.toContain('href="/api/exports/v1/exports/production-plans/plan-lunch/html"');
    expect(markup).toContain('href="/api/exports/v1/exports/production-plans/plan-dinner/html"');
    expect(markup.match(/<button/g)).toHaveLength(2);
  });

  it("keeps current plan choices when another or an archived plan is selected", () => {
    for (const multiple of [false, true]) {
      const current = { planId: "plan-lunch", eventSpecId: "spec-lunch" };
      const other = { planId: "plan-dinner", eventSpecId: "spec-dinner" };
      const markup = renderToStaticMarkup(createElement(ProductionObjectsPanel, {
        progressState: { planPhase: "idle", planProgress: 0 },
        objectsState: {
          focusedProductionSpec: lunchSpec, productionWorkspaceCleared: false,
          currentSpecPlans: multiple ? [current, other] : [current], selectedPlan: other, selectedPlanSpec: dinnerSpec,
          selectedPlanComponentsById: new Map(), archivedPlans: multiple ? [] : [other],
          specById: new Map([["spec-lunch", lunchSpec], ["spec-dinner", dinnerSpec]])
        },
        objectsActions: { setSelectedPlanId: () => undefined }, submitting: false
      }));
      expect(markup).toContain("Einzelheiten");
      expect(markup).toContain('href="/api/exports/v1/exports/production-plans/plan-lunch/html"');
      expect(markup.match(/href="\/api\/exports\/v1\/exports\/production-plans\/plan-dinner\/html"/g)).toHaveLength(1);
    }
  });

  it("keeps ids in export URLs but not in the production download context label", () => {
    const markup = renderToStaticMarkup(
      createElement(ProductionPlanDownloadCard, {
        selectedPlan: {
          planId: " plan-lunch ",
          eventSpecId: " spec-lunch ",
          readiness: { status: "complete" },
          productionBatches: [],
          kitchenSheets: [],
          recipeSelections: [],
          unresolvedItems: []
        },
        selectedPlanSpec: lunchSpec
      })
    );

    expect(markup).toContain("Plan-Kontext: aktueller Produktionsplan");
    expect(markup).toContain("Berechnungshinweise: keine");
    expect(markup).toContain("Fachliche Rückfragen und Freigaben separat prüfen.");
    expect(markup).not.toContain("Offene Punkte: keine");
    expect(markup).toContain("Produktionsmappe öffnen");
    expect(markup).toContain("für aktuellen Produktionsplan");
    expect(markup).toContain('href="/api/exports/v1/exports/production-plans/plan-lunch/html"');
    expect(markup).not.toContain("Plan-Kontext: planId");
    expect(markup).not.toContain("Spezifikation spec-lunch");
  });

  it("uses normalized spec ids for current and archived purchase list labels", () => {
    const markup = renderToStaticMarkup(
      createElement(ProductionPurchaseListPanel, {
        purchaseListState: {
          currentPurchaseLists: [
            {
              purchaseListId: " purchase-lunch ",
              eventSpecId: " spec-lunch ",
              totals: { itemCount: 2 }
            }
          ],
          archivedPurchaseLists: [
            {
              purchaseListId: " purchase-dinner ",
              eventSpecId: " spec-dinner ",
              totals: { itemCount: 3 }
            }
          ],
          specById: new Map([
            ["spec-lunch", lunchSpec],
            ["spec-dinner", dinnerSpec]
          ]),
          statusLabel: "1 Einkaufsliste"
        }
      })
    );

    expect(markup).toContain("Lunch · 40 Teilnehmer · 2026-06-18");
    expect(markup).toContain("Abendessen · 24 Teilnehmer · 2026-06-19");
    expect(markup).toContain('href="/api/exports/v1/exports/purchase-lists/purchase-lunch/csv?format=excel-de"');
    expect(markup).toContain('href="/api/exports/v1/exports/purchase-lists/purchase-dinner/csv?format=excel-de"');
    expect(markup).not.toContain("<strong>Einkaufsliste</strong>");
  });

  it("does not offer purchase-list exports for lists without positions", () => {
    const markup = renderToStaticMarkup(
      createElement(ProductionPurchaseListPanel, {
        purchaseListState: {
          currentPurchaseLists: [
            {
              purchaseListId: "purchase-empty",
              eventSpecId: "spec-lunch",
              totals: { itemCount: 0 },
              items: []
            }
          ],
          archivedPurchaseLists: [],
          specById: new Map([["spec-lunch", lunchSpec]]),
          statusLabel: "1 Liste ohne Positionen"
        }
      })
    );

    expect(markup).toContain("Keine Einkaufspositionen ermittelt.");
    expect(markup).toContain("Export erst verfügbar, wenn Einkaufspositionen ermittelt sind.");
    expect(markup).not.toContain("Einkaufsliste exportieren");
    expect(markup).not.toContain("/api/exports/v1/exports/purchase-lists/purchase-empty/csv");
  });
});
