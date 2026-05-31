import { describe, expect, it } from "vitest";
import {
  getPurchaseListPreviewItems,
  getPurchaseListQualityWarnings
} from "../backoffice-ui/src/production-purchase-list-preview.js";

describe("production purchase list preview", () => {
  it("reads the canonical purchase list item fields used by production exports", () => {
    expect(
      getPurchaseListPreviewItems({
        items: [
          {
            articleName: "Tomaten",
            purchaseQty: 8,
            purchaseUnit: "kg"
          }
        ]
      })
    ).toEqual([
      {
        articleName: "Tomaten",
        quantity: "8",
        unit: "kg"
      }
    ]);
  });

  it("keeps legacy positions and nested quantity shapes visible in the current UI preview", () => {
    expect(
      getPurchaseListPreviewItems({
        positions: [
          {
            displayName: "Baguette",
            quantity: {
              amount: 40,
              unit: "Stück"
            }
          }
        ]
      })
    ).toEqual([
      {
        articleName: "Baguette",
        quantity: "40",
        unit: "Stück"
      }
    ]);
  });

  it("uses fallback labels for partial entries and limits the preview to five valid rows", () => {
    const preview = getPurchaseListPreviewItems({
      entries: [
        "invalid",
        { ingredientName: "Linsen", amount: 5, unit: "kg" },
        { label: "Karotten", qty: 3, normalizedUnit: "kg" },
        { name: "Sellerie", normalizedQty: 2, purchaseUnit: "Bund" },
        { displayName: "Petersilie" },
        { articleName: "Reis", purchaseQty: 7, purchaseUnit: "kg" },
        { articleName: "Zu viel", purchaseQty: 1, purchaseUnit: "kg" }
      ]
    });

    expect(preview).toEqual([
      { articleName: "Linsen", quantity: "5", unit: "kg" },
      { articleName: "Karotten", quantity: "3", unit: "kg" },
      { articleName: "Sellerie", quantity: "2", unit: "Bund" },
      { articleName: "Petersilie", quantity: "-", unit: "-" }
    ]);
  });

  it("flags recipe instructions that leaked into purchase list item names", () => {
    expect(
      getPurchaseListQualityWarnings({
        items: [
          { displayName: "Baguette", purchaseQty: 120, purchaseUnit: "Stück" },
          { displayName: "Mix veal, breadcrumbs and eggs.", purchaseQty: 16.2, purchaseUnit: "pcs" },
          { articleName: "Boil potatoes.", purchaseQty: 12, purchaseUnit: "pcs" }
        ]
      })
    ).toEqual([
      {
        code: "instruction_like_purchase_item",
        itemCount: 2,
        examples: ["Mix veal, breadcrumbs and eggs.", "Boil potatoes."]
      }
    ]);
  });

  it("keeps ordinary procurement labels quiet", () => {
    expect(
      getPurchaseListQualityWarnings({
        items: [
          { displayName: "Baguette für Brotstation", purchaseQty: 120, purchaseUnit: "Stück" },
          { articleName: "Olivenöl", purchaseQty: 1, purchaseUnit: "l" }
        ]
      })
    ).toEqual([]);
  });
});
