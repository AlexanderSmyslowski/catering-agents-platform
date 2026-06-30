import { describe, expect, it, vi } from "vitest";
import {
  aggregatePurchaseList,
  formatRecipeSourceEvidenceLabel,
  SCHEMA_VERSION,
  validateProductionPlan,
  validatePurchaseList,
  type AcceptedEventSpec,
  type MenuComponent,
  type ProductionBatch,
  type ProductionPlan,
  type PurchaseList,
  type Recipe
} from "@catering/shared-core";
import {
  renderProductionPlanHtml,
  renderPurchaseListCsv
} from "@catering/print-export";
import { buildResolvedRecipePlanningArtifacts } from "../production-service/src/rules/planning-resolved-recipe-artifacts.js";
import { buildRecipeComponentPlanningArtifacts } from "../production-service/src/rules/planning-recipe-component-artifacts.js";
import type { RecipeDiscoveryService } from "../production-service/src/recipe-discovery/service.js";

function eventSpec(component: MenuComponent): AcceptedEventSpec {
  return {
    schemaVersion: SCHEMA_VERSION,
    specId: "spec-export-source",
    readiness: {
      status: "complete",
      reasons: []
    },
    lifecycle: {
      commercialState: "accepted"
    },
    event: {
      date: "2026-07-01"
    },
    attendees: {
      expected: 20
    },
    servicePlan: {
      eventType: "lunch",
      serviceForm: "buffet",
      modules: []
    },
    menuPlan: [component],
    sourceLineage: [
      {
        sourceType: "manual_input",
        reference: "test:export-source"
      }
    ]
  };
}

function component(): MenuComponent {
  return {
    componentId: "component-soup",
    label: "Tomato Soup",
    menuCategory: "vegetarian",
    productionDecision: {
      mode: "scratch"
    }
  };
}

function recipe(sourceOverrides: Partial<Recipe["source"]> = {}): Recipe {
  return {
    schemaVersion: SCHEMA_VERSION,
    recipeId: "recipe-tomato-soup",
    name: "Tomato Soup Export",
    source: {
      tier: "internal_verified",
      originType: "internal_db",
      reference: "internal:tomato-soup",
      retrievedAt: "2026-06-01T10:00:00.000Z",
      approvalState: "approved_internal",
      qualityScore: 0.98,
      fitScore: 0.95,
      extractionCompleteness: 1,
      ...sourceOverrides
    },
    baseYield: {
      servings: 10,
      unit: "servings"
    },
    ingredients: [
      {
        ingredientId: "tomato",
        name: "Tomatoes",
        quantity: {
          amount: 2,
          unit: "kg"
        },
        group: "produce"
      }
    ],
    steps: [
      {
        index: 1,
        instruction: "Cook tomatoes."
      }
    ],
    scalingRules: {
      defaultLossFactor: 1.05
    },
    allergens: [],
    dietTags: ["vegetarian"]
  };
}

function discoveryReturning(selectedRecipe: Recipe): RecipeDiscoveryService {
  return {
    resolveRecipe: vi.fn(async (menuComponent: MenuComponent) => ({
      recipe: selectedRecipe,
      selection: {
        componentId: menuComponent.componentId,
        recipeId: selectedRecipe.recipeId,
        selectionReason: "Test recipe selected.",
        autoUsedInternetRecipe: false,
        sourceTier: selectedRecipe.source.tier
      },
      unresolvedItems: []
    })),
    resolveRecipeOverride: vi.fn()
  } as unknown as RecipeDiscoveryService;
}

function withoutRecipeSource(batch: ProductionBatch): Omit<ProductionBatch, "recipeSource"> {
  const { recipeSource: _recipeSource, ...rest } = batch;
  return rest;
}

describe("export source metadata readability", () => {
  it("appends source metadata columns to purchase CSV without changing quantities", () => {
    const menuComponent = component();
    const artifacts = buildResolvedRecipePlanningArtifacts({
      eventSpec: eventSpec(menuComponent),
      component: menuComponent,
      recipe: recipe({
        tier: "internal_verified",
        originType: "internal_db",
        reference: "internal:tomato-soup",
        approvalState: "approved_internal"
      }),
      servings: 20
    });
    const purchaseList = aggregatePurchaseList("spec-export-source", [
      artifacts.batch
    ]);
    const csv = renderPurchaseListCsv(purchaseList);
    const [header, row] = csv.split("\n");

    expect(header).toBe(
      [
        "\"group\"",
        "\"item\"",
        "\"normalizedQty\"",
        "\"normalizedUnit\"",
        "\"purchaseQty\"",
        "\"purchaseUnit\"",
        "\"supplierHint\"",
        "\"source_recipes\"",
        "\"source_recipe_origins\"",
        "\"source_recipe_references\""
      ].join(",")
    );
    expect(row).toContain("\"4.2\"");
    expect(row).toContain("\"kg\"");
    expect(row).toContain("\"recipe-tomato-soup\"");
    expect(row).toContain("\"internal recipe, approved\"");
    expect(row).toContain("\"internal:tomato-soup\"");
  });

  it("does not use source metadata to alter batch or purchase calculations", () => {
    const menuComponent = component();
    const internalArtifacts = buildResolvedRecipePlanningArtifacts({
      eventSpec: eventSpec(menuComponent),
      component: menuComponent,
      recipe: recipe({
        tier: "internal_verified",
        originType: "internal_db",
        reference: "internal:tomato-soup",
        approvalState: "approved_internal"
      }),
      servings: 20
    });
    const reviewedWebArtifacts = buildResolvedRecipePlanningArtifacts({
      eventSpec: eventSpec(menuComponent),
      component: menuComponent,
      recipe: recipe({
        tier: "internal_approved",
        originType: "web",
        reference: "web:tomato-soup",
        url: "https://example.test/tomato-soup",
        publisher: "Example Recipes",
        approvalState: "approved_internal"
      }),
      servings: 20
    });
    const internalPurchase = aggregatePurchaseList("spec-export-source", [
      internalArtifacts.batch
    ]);
    const reviewedWebPurchase = aggregatePurchaseList("spec-export-source", [
      reviewedWebArtifacts.batch
    ]);

    expect(withoutRecipeSource(reviewedWebArtifacts.batch)).toEqual(
      withoutRecipeSource(internalArtifacts.batch)
    );
    expect(reviewedWebPurchase.items).toHaveLength(internalPurchase.items.length);
    expect(reviewedWebPurchase.items[0]?.normalizedQty).toBe(
      internalPurchase.items[0]?.normalizedQty
    );
    expect(reviewedWebPurchase.items[0]?.purchaseQty).toBe(
      internalPurchase.items[0]?.purchaseQty
    );
    expect(reviewedWebPurchase.items[0]?.normalizedUnit).toBe("kg");
    expect(reviewedWebPurchase.items[0]?.purchaseUnit).toBe("kg");
  });

  it("keeps reviewed web source metadata visible in production HTML and purchase CSV", () => {
    const menuComponent = component();
    const reviewedWebRecipe = recipe({
      tier: "internal_approved",
      originType: "web",
      reference: "web:tomato-soup",
      url: "https://example.test/tomato-soup",
      publisher: "Example Recipes",
      approvalState: "approved_internal"
    });
    const artifacts = buildResolvedRecipePlanningArtifacts({
      eventSpec: eventSpec(menuComponent),
      component: menuComponent,
      recipe: reviewedWebRecipe,
      servings: 20
    });
    const purchaseList = aggregatePurchaseList("spec-export-source", [
      artifacts.batch
    ]);
    const html = renderProductionPlanHtml({
      schemaVersion: SCHEMA_VERSION,
      planId: "plan-export-source",
      eventSpecId: "spec-export-source",
      readiness: {
        status: "complete",
        reasons: []
      },
      productionBatches: [artifacts.batch],
      timeline: [artifacts.timelineItem],
      kitchenSheets: [artifacts.kitchenSheet],
      recipeSelections: [],
      unresolvedItems: []
    });
    const csv = renderPurchaseListCsv(purchaseList);

    expect(html).toContain("Rezeptquelle:");
    expect(html).toContain("web recipe, reviewed");
    expect(html).toContain("Example Recipes");
    expect(html).toContain("https://example.test/tomato-soup");
    expect(csv).toContain("\"web recipe, reviewed\"");
    expect(csv).toContain(
      "\"Example Recipes | https://example.test/tomato-soup | web:tomato-soup\""
    );
  });

  it("renders explicit fallback text for legacy purchase items without source metadata", () => {
    const purchaseList: PurchaseList = {
      schemaVersion: SCHEMA_VERSION,
      purchaseListId: "purchase-legacy",
      eventSpecId: "spec-export-source",
      groupingMode: "group",
      items: [
        {
          ingredientId: "tomato",
          displayName: "Tomatoes",
          normalizedQty: 4.2,
          normalizedUnit: "kg",
          purchaseQty: 4.2,
          purchaseUnit: "kg",
          group: "produce",
          supplierHint: "Metro Fresh",
          sourceRecipes: ["legacy-recipe"],
          mappingConfidence: 0.95
        }
      ],
      totals: {
        itemCount: 1,
        groups: ["produce"]
      }
    };

    const csv = renderPurchaseListCsv(purchaseList);

    expect(csv).toContain("\"legacy-recipe\"");
    expect(csv).toContain("\"Herkunft nicht dokumentiert\"");
    expect(csv).toContain("\"Referenz nicht dokumentiert\"");
    expect(formatRecipeSourceEvidenceLabel(undefined, "legacy-recipe")).toBe(
      "Herkunft nicht dokumentiert (legacy-recipe)"
    );
  });

  it("keeps legacy production and purchase objects valid without optional source metadata", () => {
    const menuComponent = component();
    const artifacts = buildResolvedRecipePlanningArtifacts({
      eventSpec: eventSpec(menuComponent),
      component: menuComponent,
      recipe: recipe(),
      servings: 20
    });
    const legacyBatch = withoutRecipeSource(artifacts.batch);
    const { recipeSource: _sheetRecipeSource, ...legacyKitchenSheet } =
      artifacts.kitchenSheet;
    const legacyPlan: ProductionPlan = {
      schemaVersion: SCHEMA_VERSION,
      planId: "plan-legacy-source",
      eventSpecId: "spec-export-source",
      readiness: {
        status: "complete",
        reasons: []
      },
      productionBatches: [legacyBatch],
      timeline: [artifacts.timelineItem],
      kitchenSheets: [legacyKitchenSheet],
      recipeSelections: [],
      unresolvedItems: []
    };
    const legacyPurchaseList: PurchaseList = {
      schemaVersion: SCHEMA_VERSION,
      purchaseListId: "purchase-legacy-source",
      eventSpecId: "spec-export-source",
      groupingMode: "group",
      items: [
        {
          ingredientId: "tomato",
          displayName: "Tomatoes",
          normalizedQty: 4.2,
          normalizedUnit: "kg",
          purchaseQty: 4.2,
          purchaseUnit: "kg",
          group: "produce",
          supplierHint: "Metro Fresh",
          sourceRecipes: ["recipe-tomato-soup"],
          mappingConfidence: 0.95
        }
      ],
      totals: {
        itemCount: 1,
        groups: ["produce"]
      }
    };

    expect(validateProductionPlan(legacyPlan)).toBe(legacyPlan);
    expect(validatePurchaseList(legacyPurchaseList)).toBe(legacyPurchaseList);
    expect(renderProductionPlanHtml(legacyPlan)).toContain(
      "Herkunft nicht dokumentiert (recipe-tomato-soup)"
    );
    expect(renderPurchaseListCsv(legacyPurchaseList)).toContain(
      "\"Herkunft nicht dokumentiert\""
    );
    expect(renderPurchaseListCsv(legacyPurchaseList)).toContain(
      "\"Referenz nicht dokumentiert\""
    );
  });

  it("validates new optional source metadata in production and purchase schemas", () => {
    const menuComponent = component();
    const artifacts = buildResolvedRecipePlanningArtifacts({
      eventSpec: eventSpec(menuComponent),
      component: menuComponent,
      recipe: recipe({
        tier: "internal_approved",
        originType: "web",
        reference: "web:tomato-soup",
        url: "https://example.test/tomato-soup",
        publisher: "Example Recipes",
        approvalState: "approved_internal"
      }),
      servings: 20
    });
    const plan: ProductionPlan = {
      schemaVersion: SCHEMA_VERSION,
      planId: "plan-source-metadata",
      eventSpecId: "spec-export-source",
      readiness: {
        status: "complete",
        reasons: []
      },
      productionBatches: [artifacts.batch],
      timeline: [artifacts.timelineItem],
      kitchenSheets: [artifacts.kitchenSheet],
      recipeSelections: [],
      unresolvedItems: []
    };
    const purchaseList = aggregatePurchaseList("spec-export-source", [
      artifacts.batch
    ]);

    expect(validateProductionPlan(plan)).toBe(plan);
    expect(validatePurchaseList(purchaseList)).toBe(purchaseList);
    expect(purchaseList.items[0]?.sourceRecipeMetadata?.[0]?.url).toBe(
      "https://example.test/tomato-soup"
    );
  });

  it("keeps unreviewed web candidates blocked before exportable production artifacts", async () => {
    const menuComponent = component();
    const artifacts = await buildRecipeComponentPlanningArtifacts({
      eventSpec: eventSpec(menuComponent),
      component: menuComponent,
      servings: 20,
      discoveryService: discoveryReturning(
        recipe({
          tier: "internet_fallback",
          originType: "web",
          reference: "web:tomato-soup",
          approvalState: "auto_usable"
        })
      )
    });

    expect(artifacts.kind).toBe("unresolved");
    expect(artifacts.selection.autoUsedInternetRecipe).toBe(false);
  });
});
