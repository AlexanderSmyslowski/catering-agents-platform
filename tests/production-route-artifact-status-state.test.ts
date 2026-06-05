import { describe, expect, it } from "vitest";
import {
  countPurchaseListItems,
  formatProductionHandoffContextLabel,
  formatProductionHandoffExportLabel,
  formatProductionIntakeOriginLabel,
  formatPurchaseZoneStatusLabel
} from "../backoffice-ui/src/production-route-artifact-status-state.js";

describe("production route artifact status state", () => {
  it("counts purchase list items from totals and item arrays", () => {
    expect(
      countPurchaseListItems([
        { totals: { itemCount: 4 } },
        { items: [{ id: "a" }, { id: "b" }] },
        { totals: { itemCount: "ignored" } }
      ])
    ).toBe(6);
  });

  it("formats purchase zone and handoff export labels", () => {
    expect(formatPurchaseZoneStatusLabel({ purchaseListCount: 0, itemCount: 0 })).toBe("noch keine Liste");
    expect(formatPurchaseZoneStatusLabel({ purchaseListCount: 2, itemCount: 9 })).toBe("2 Listen · 9 Positionen");

    expect(formatProductionHandoffExportLabel({ hasSelectedPlan: false, purchaseListCount: 0 })).toBe(
      "Produktionsblatt offen · Einkaufsliste offen"
    );
    expect(formatProductionHandoffExportLabel({ hasSelectedPlan: true, purchaseListCount: 1 })).toBe(
      "Produktionsblatt vorhanden · Einkaufsliste vorhanden"
    );
  });

  it("formats intake origin and handoff context labels", () => {
    expect(
      formatProductionIntakeOriginLabel({
        intakeRequestDetail: {
          requestId: "request-1",
          source: { channel: "text", receivedAt: "2026-05-26T01:00:00.000Z" }
        }
      })
    ).toBe("text · 2026-05-26T01:00:00.000Z · request-1");
    expect(formatProductionIntakeOriginLabel({ currentIntakeRequestId: " request-2 " })).toBe(
      "Intake-Anfrage request-2"
    );
    expect(formatProductionIntakeOriginLabel({ currentIntakeRequestId: "   " })).toBe("kein Intake-Ursprung verknüpft");

    expect(
      formatProductionHandoffContextLabel({
        selectedPlan: { planId: "plan-1", eventSpecId: "spec-1" },
        selectedPlanSpec: { specId: "spec-fallback" },
        purchaseLists: [{ purchaseListId: "purchase-1" }]
      })
    ).toBe("planId plan-1 · specId spec-1 · purchaseListId purchase-1");
  });
});
