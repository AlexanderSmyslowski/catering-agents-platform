import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductionPlanList } from "../backoffice-ui/src/production-plan-list.js";
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
  it("uses normalized spec ids for production plan labels", () => {
    const markup = renderToStaticMarkup(
      createElement(ProductionPlanList, {
        plans: [
          {
            planId: "plan-lunch",
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
    expect(markup).not.toContain("<strong>Produktionsplan</strong>");
  });

  it("uses normalized spec ids for current and archived purchase list labels", () => {
    const markup = renderToStaticMarkup(
      createElement(ProductionPurchaseListPanel, {
        purchaseListState: {
          currentPurchaseLists: [
            {
              purchaseListId: "purchase-lunch",
              eventSpecId: " spec-lunch ",
              totals: { itemCount: 2 }
            }
          ],
          archivedPurchaseLists: [
            {
              purchaseListId: "purchase-dinner",
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
    expect(markup).not.toContain("<strong>Einkaufsliste</strong>");
  });
});
