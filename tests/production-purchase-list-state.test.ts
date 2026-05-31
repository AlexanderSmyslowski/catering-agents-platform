import { describe, expect, it } from "vitest";
import { buildProductionPurchaseListState } from "../backoffice-ui/src/production-purchase-list-state.js";

describe("production purchase list state", () => {
  it("maps current and archived purchase lists into panel state without recomputing behavior", () => {
    const currentPurchaseList = { purchaseListId: "purchase-current", eventSpecId: "spec-1" };
    const archivedPurchaseList = { purchaseListId: "purchase-archived", eventSpecId: "spec-2" };
    const specById = new Map([["spec-1", { specId: "spec-1" }]]);

    const purchaseListState = buildProductionPurchaseListState({
      currentSpecPurchaseLists: [currentPurchaseList],
      archivedPurchaseLists: [archivedPurchaseList],
      specById,
      purchaseZoneStatusLabel: "1 aktuelle Einkaufsliste"
    });

    expect(purchaseListState.currentPurchaseLists).toEqual([currentPurchaseList]);
    expect(purchaseListState.archivedPurchaseLists).toEqual([archivedPurchaseList]);
    expect(purchaseListState.specById).toBe(specById);
    expect(purchaseListState.statusLabel).toBe("1 aktuelle Einkaufsliste");
  });

  it("keeps empty current and archived lists distinct", () => {
    const specById = new Map<string, Record<string, unknown>>();

    const purchaseListState = buildProductionPurchaseListState({
      currentSpecPurchaseLists: [],
      archivedPurchaseLists: [],
      specById,
      purchaseZoneStatusLabel: "noch keine Liste"
    });

    expect(purchaseListState.currentPurchaseLists).toEqual([]);
    expect(purchaseListState.archivedPurchaseLists).toEqual([]);
    expect(purchaseListState.specById).toBe(specById);
  });
});
