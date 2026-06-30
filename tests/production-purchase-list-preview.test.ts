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
        unit: "kg",
        sourceLabel: "Herkunft nicht dokumentiert"
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
        unit: "Stück",
        sourceLabel: "Herkunft nicht dokumentiert"
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
      { articleName: "Linsen", quantity: "5", unit: "kg", sourceLabel: "Herkunft nicht dokumentiert" },
      { articleName: "Karotten", quantity: "3", unit: "kg", sourceLabel: "Herkunft nicht dokumentiert" },
      { articleName: "Sellerie", quantity: "2", unit: "Bund", sourceLabel: "Herkunft nicht dokumentiert" },
      { articleName: "Petersilie", quantity: "-", unit: "-", sourceLabel: "Herkunft nicht dokumentiert" }
    ]);
  });

  it("shows source metadata for purchase preview items when available", () => {
    expect(
      getPurchaseListPreviewItems({
        items: [
          {
            articleName: "Tomaten",
            purchaseQty: 8,
            purchaseUnit: "kg",
            sourceRecipes: ["recipe-tomato-soup"],
            sourceRecipeMetadata: [
              {
                recipeId: "recipe-tomato-soup",
                recipeName: "Tomatensuppe",
                sourceTier: "internal_verified",
                originType: "internal_db",
                approvalState: "approved_internal",
                reference: "internal:tomato-soup"
              }
            ]
          }
        ]
      })
    ).toEqual([
      {
        articleName: "Tomaten",
        quantity: "8",
        unit: "kg",
        sourceLabel:
          "Tomatensuppe | recipe-tomato-soup | internal recipe, approved | internal_verified | approved_internal | internal:tomato-soup"
      }
    ]);
  });

  it("shows all source metadata entries for shared aggregated ingredients", () => {
    const preview = getPurchaseListPreviewItems({
      items: [
        {
          articleName: "Tomaten",
          purchaseQty: 12,
          purchaseUnit: "kg",
          sourceRecipes: ["recipe-tomato-soup", "recipe-bruschetta"],
          sourceRecipeMetadata: [
            {
              recipeId: "recipe-tomato-soup",
              recipeName: "Tomatensuppe",
              sourceTier: "internal_verified",
              originType: "internal_db",
              approvalState: "approved_internal",
              reference: "internal:tomato-soup"
            },
            {
              recipeId: "recipe-bruschetta",
              recipeName: "Bruschetta",
              sourceTier: "internal_verified",
              originType: "internal_db",
              approvalState: "approved_internal",
              reference: "internal:bruschetta"
            }
          ]
        }
      ]
    });

    expect(preview).toEqual([
      {
        articleName: "Tomaten",
        quantity: "12",
        unit: "kg",
        sourceLabel:
          "Tomatensuppe | recipe-tomato-soup | internal recipe, approved | internal_verified | approved_internal | internal:tomato-soup; " +
          "Bruschetta | recipe-bruschetta | internal recipe, approved | internal_verified | approved_internal | internal:bruschetta"
      }
    ]);
    expect(preview[0]?.sourceLabel).toContain("Tomatensuppe");
    expect(preview[0]?.sourceLabel).toContain("Bruschetta");
  });

  it("keeps mixed source metadata and source recipe fallbacks deterministic", () => {
    expect(
      getPurchaseListPreviewItems({
        items: [
          {
            articleName: "Tomaten",
            purchaseQty: 10,
            purchaseUnit: "kg",
            sourceRecipes: [
              "recipe-tomato-soup",
              "recipe-bruschetta",
              "recipe-tomato-soup"
            ],
            sourceRecipeMetadata: [
              {
                recipeId: "recipe-tomato-soup",
                recipeName: "Tomatensuppe",
                sourceTier: "internal_verified",
                originType: "internal_db",
                approvalState: "approved_internal",
                reference: "internal:tomato-soup"
              },
              "invalid"
            ]
          }
        ]
      })
    ).toEqual([
      {
        articleName: "Tomaten",
        quantity: "10",
        unit: "kg",
        sourceLabel:
          "Tomatensuppe | recipe-tomato-soup | internal recipe, approved | internal_verified | approved_internal | internal:tomato-soup; " +
          "Herkunft nicht dokumentiert (recipe-bruschetta)"
      }
    ]);
  });

  it("deduplicates exact duplicate source labels without hiding distinct sources", () => {
    expect(
      getPurchaseListPreviewItems({
        items: [
          {
            articleName: "Tomaten",
            purchaseQty: 8,
            purchaseUnit: "kg",
            sourceRecipeMetadata: [
              {
                recipeId: "recipe-tomato-soup",
                recipeName: "Tomatensuppe",
                sourceTier: "internal_verified",
                originType: "internal_db",
                approvalState: "approved_internal",
                reference: "internal:tomato-soup"
              },
              {
                recipeId: "recipe-tomato-soup",
                recipeName: "Tomatensuppe",
                sourceTier: "internal_verified",
                originType: "internal_db",
                approvalState: "approved_internal",
                reference: "internal:tomato-soup"
              }
            ]
          }
        ]
      })
    ).toEqual([
      {
        articleName: "Tomaten",
        quantity: "8",
        unit: "kg",
        sourceLabel:
          "Tomatensuppe | recipe-tomato-soup | internal recipe, approved | internal_verified | approved_internal | internal:tomato-soup"
      }
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
