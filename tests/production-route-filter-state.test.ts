import { describe, expect, it } from "vitest";
import { buildProductionRouteFilterState } from "../backoffice-ui/src/production-route-filter-state.js";

describe("production route filter state", () => {
  it("maps production route filter values and formats the production service summary", () => {
    const setSearch = (_value: string) => undefined;

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
      search: "",
      setSearch: (_value) => undefined
    });

    expect(state.isInitialProductionLoading).toBe(true);
    expect(state.productionServiceStatusLabel).toBe("degraded");
    expect(state.productionServiceCountsLabel).toBe("Keine Zähler");
  });
});
