import { describe, expect, it } from "vitest";
import { buildProductionPurchaseListPanelState } from "../backoffice-ui/src/production-purchase-list-panel-state.js";

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

describe("production purchase list panel state", () => {
  it("maps current and archived purchase lists into stable render labels", () => {
    expect(
      buildProductionPurchaseListPanelState({
        currentPurchaseLists: [
          {
            purchaseListId: " purchase-lunch ",
            eventSpecId: " spec-lunch ",
            totals: { itemCount: 2 },
            items: [{ articleName: "Glutenfreies Baguette", quantity: { amount: 3, unit: "Stk" } }]
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
      })
    ).toEqual({
      currentLists: [
        {
          key: " purchase-lunch ",
          title: "Lunch · 40 Teilnehmer · 2026-06-18",
          itemCountLabel: "Positionen: 2",
          contextLabel: "Aktueller Vorgang",
          canExport: true,
          exportUnavailableLabel: "Export erst verfügbar, wenn Einkaufspositionen ermittelt sind.",
          exportUrl: "/api/exports/v1/exports/purchase-lists/purchase-lunch/csv",
          exportContextLabel: "für aktuellen Vorgang",
          warnings: [],
          previewItems: [
            {
              key: " purchase-lunch -0",
              articleName: "Glutenfreies Baguette",
              quantityLabel: "Menge: 3",
              unitLabel: "Einheit: Stk",
              sourceLabel: "Rezeptquelle: Quelle offen"
            }
          ]
        }
      ],
      archivedLists: [
        {
          key: " purchase-dinner ",
          title: "Abendessen · 24 Teilnehmer · 2026-06-19",
          helperLabel: "Ältere Einkaufsliste aus anderem Vorgang - nicht aktueller Vorgang.",
          itemCountLabel: "Positionen: 3",
          canExport: true,
          exportUnavailableLabel: "Export erst verfügbar, wenn Einkaufspositionen ermittelt sind.",
          exportUrl: "/api/exports/v1/exports/purchase-lists/purchase-dinner/csv",
          exportContextLabel: "aus älterem Vorgang"
        }
      ],
      showArchivedLists: true
    });
  });

  it("surfaces instruction-like purchase items as stale-data warnings", () => {
    expect(
      buildProductionPurchaseListPanelState({
        currentPurchaseLists: [
          {
            purchaseListId: "purchase-1",
            eventSpecId: "spec-lunch",
            totals: { itemCount: 1 },
            items: [{ articleName: "Mix veal, breadcrumbs and eggs." }]
          }
        ],
        archivedPurchaseLists: [],
        specById: new Map([["spec-lunch", lunchSpec]]),
        statusLabel: "1 Einkaufsliste"
      }).currentLists[0]?.warnings
    ).toEqual([
      {
        key: "instruction_like_purchase_item",
        label:
          "Prüfhinweis: 1 mögliche Rezept-Arbeitsschritte als Einkaufspositionen erkannt. " +
          "Für das Rehearsal als lokalen Stale-Datenbefund markieren; Beispiele: Mix veal, breadcrumbs and eggs.."
      }
    ]);
  });

  it("marks current purchase lists with zero items as empty for the operator", () => {
    expect(
      buildProductionPurchaseListPanelState({
        currentPurchaseLists: [
          {
            purchaseListId: "purchase-empty",
            eventSpecId: "spec-lunch",
            totals: { itemCount: 0 }
          }
        ],
        archivedPurchaseLists: [],
        specById: new Map([["spec-lunch", lunchSpec]]),
        statusLabel: "1 Liste ohne Positionen"
      }).currentLists[0]
    ).toMatchObject({
      itemCountLabel: "Keine Einkaufspositionen ermittelt.",
      canExport: false,
      exportUnavailableLabel: "Export erst verfügbar, wenn Einkaufspositionen ermittelt sind.",
      exportUrl: undefined
    });
  });

  it("keeps empty archived lists hidden and preserves current-list fallback labels", () => {
    expect(
      buildProductionPurchaseListPanelState({
        currentPurchaseLists: [
          {
            purchaseListId: "",
            eventSpecId: "",
            totals: {}
          }
        ],
        archivedPurchaseLists: [],
        specById: new Map(),
        statusLabel: "noch keine Liste"
      })
    ).toEqual({
      currentLists: [
        {
          key: "",
          title: "Einkaufsliste",
          itemCountLabel: "Positionen: -",
          contextLabel: "Aktueller Vorgang",
          canExport: false,
          exportUnavailableLabel: "Export erst verfügbar, wenn Einkaufspositionen ermittelt sind.",
          exportUrl: undefined,
          exportContextLabel: "für aktuellen Vorgang",
          warnings: [],
          previewItems: []
        }
      ],
      archivedLists: [],
      showArchivedLists: false
    });
  });
});
