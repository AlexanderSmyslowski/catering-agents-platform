import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type AcceptedEventSpec } from "@catering/shared-core";
import {
  bakerPurchaseComponent,
  bakerPurchaseConstraintConflictReason,
  bakerPurchasedElements,
  isBakerPurchaseLabel,
  procurementItemsForComponent
} from "../production-service/src/rules/procurement-rules.js";

function component(
  label: string,
  productionDecision?: AcceptedEventSpec["menuPlan"][number]["productionDecision"]
): AcceptedEventSpec["menuPlan"][number] {
  return {
    componentId: `component-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    label,
    course: "side",
    serviceStyle: "buffet",
    menuCategory: "classic",
    dietaryTags: [],
    productionDecision
  };
}

describe("production procurement rules", () => {
  it("builds procurement items for hybrid and convenience purchases", () => {
    const items = procurementItemsForComponent(
      component("Quiche", {
        mode: "hybrid",
        purchasedElements: ["TK-Quiche Boden"]
      }),
      42
    );

    expect(items).toEqual([
      expect.objectContaining({
        ingredientId: "proc-component-quiche-tk-quiche-boden-1",
        displayName: "TK-Quiche Boden für Quiche",
        normalizedQty: 42,
        normalizedUnit: "portion",
        purchaseQty: 42,
        purchaseUnit: "portion",
        supplierHint: "Metro Convenience",
        sourceRecipes: ["procurement:component-quiche"],
        mappingConfidence: 0.7
      })
    ]);
  });

  it("builds one finished-product procurement item for external finished components", () => {
    const items = procurementItemsForComponent(
      component("Mini Desserts", {
        mode: "external_finished"
      }),
      60
    );

    expect(items).toEqual([
      expect.objectContaining({
        ingredientId: "proc-component-mini-desserts-finished",
        displayName: "Mini Desserts",
        supplierHint: "Metro / externer Lieferant",
        sourceRecipes: ["procurement:component-mini-desserts"],
        mappingConfidence: 0.65
      })
    ]);
  });

  it("recognizes clear baker purchase labels and derives purchased elements", () => {
    expect(isBakerPurchaseLabel("Klassisch Brot & Baguette")).toBe(true);
    expect(isBakerPurchaseLabel("Focaccia")).toBe(false);
    expect(bakerPurchasedElements("Brot & Baguette")).toEqual(["Baguette", "Brot"]);
    expect(bakerPurchasedElements("Brötchen")).toEqual(["Brötchen"]);
  });

  it("turns baker labels into convenience purchase components", () => {
    expect(bakerPurchaseComponent(component("Brotkorb"))).toEqual(
      expect.objectContaining({
        menuCategory: "classic",
        productionDecision: {
          mode: "convenience_purchase",
          purchasedElements: ["Brotkorb"],
          notes: undefined
        }
      })
    );
  });

  it("blocks baker purchase when gluten-free constraints are active", () => {
    expect(
      bakerPurchaseConstraintConflictReason(component("Brot & Baguette"), ["gluten_free"])
    ).toContain("gluten_free");
    expect(bakerPurchaseConstraintConflictReason(component("Brot & Baguette"), [])).toBeUndefined();
  });

  it("does not emit procurement items for scratch components", () => {
    expect(procurementItemsForComponent(component("Gemuesepfanne", { mode: "scratch" }), 30)).toEqual([]);
  });
});
