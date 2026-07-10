import { describe, expect, it } from "vitest";
import {
  buildProductionHistoryItems,
  buildProductionRouteFilterState
} from "../backoffice-ui/src/production-route-filter-state.js";

describe("production route filter state", () => {
  it("maps production route filter values and formats the production service summary", () => {
    const setSearch = (_value: string) => undefined;
    const openHistoryItem = (_specId: string) => undefined;

    expect(
      buildProductionRouteFilterState({
        isInitialProductionLoading: false,
        productionPlanCount: 3,
        purchaseListCount: 2,
        recipeCount: 12,
        approvedRecipeCount: 9,
        reviewRequiredRecipeCount: 1,
        productionServiceStatus: "ok",
        productionServiceCounts: {
          productionPlans: 3,
          purchaseLists: 2
        },
        filteredSpecs: [
          {
            specId: "spec-1",
            customer: { name: "Universität Heidelberg" },
            event: { type: "conference", date: "2026-09-03" },
            attendees: { expected: 90 },
            readiness: { status: "partial" }
          }
        ],
        openSpecForQuestions: openHistoryItem,
        search: "Lunch",
        setSearch
      })
    ).toEqual({
      isInitialProductionLoading: false,
      productionPlanCount: 3,
      purchaseListCount: 2,
      recipeCount: 12,
      approvedRecipeCount: 9,
      reviewRequiredRecipeCount: 1,
      productionServiceStatusLabel: "bereit",
      productionServiceCountsLabel: "Produktionspläne: 3 · Einkaufslisten: 2",
      historyItems: [
        {
          specId: "spec-1",
          label: "Universität Heidelberg · Konferenz · 90 Teilnehmer · 2026-09-03",
          readinessLabel: "teilweise vollständig"
        }
      ],
      openHistoryItem,
      search: "Lunch",
      setSearch
    });
  });

  it("keeps unknown production service status labels explicit", () => {
    const state = buildProductionRouteFilterState({
      isInitialProductionLoading: true,
      productionPlanCount: 0,
      purchaseListCount: 0,
      recipeCount: 0,
      approvedRecipeCount: 0,
      reviewRequiredRecipeCount: 0,
      productionServiceStatus: "degraded",
      productionServiceCounts: {},
      filteredSpecs: [],
      openSpecForQuestions: (_specId) => undefined,
      search: "",
      setSearch: (_value) => undefined
    });

    expect(state.isInitialProductionLoading).toBe(true);
    expect(state.productionServiceStatusLabel).toBe("degraded");
    expect(state.productionServiceCountsLabel).toBe("Keine Zähler");
  });

  it("orders history newest first and names jobs without technical ids", () => {
    const items = buildProductionHistoryItems([
      {
        specId: "spec-old",
        event: { type: "meeting", date: "2026-06-01" },
        attendees: { expected: 20 },
        readiness: { status: "complete" }
      },
      {
        specId: "spec-new",
        customer: { name: "ACME" },
        event: { type: "dinner", date: "2026-07-01" },
        attendees: { expected: 80 },
        readiness: { status: "partial" }
      }
    ]);

    expect(items.map((item) => item.specId)).toEqual(["spec-new", "spec-old"]);
    expect(items[0]?.label).toBe("ACME · Abendessen · 80 Teilnehmer · 2026-07-01");
    expect(items[0]?.label).not.toContain("spec-new");
  });
});
