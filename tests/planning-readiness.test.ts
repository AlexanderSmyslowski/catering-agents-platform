import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  normalizeEventRequestToSpec,
  type AcceptedEventSpec,
  type ProductionPlan,
  type PurchaseList
} from "@catering/shared-core";
import {
  isBlockingPlanningIssue,
  purchaseCoverageBlockingIssues,
  summarizeFallbackReason,
  uniquePlanningMessages,
  withPurchaseCoverageBlockingIssues
} from "../production-service/src/rules/planning-readiness.js";

function eventSpec(): AcceptedEventSpec {
  return normalizeEventRequestToSpec({
    schemaVersion: SCHEMA_VERSION,
    requestId: "planning-readiness-1",
    source: {
      channel: "text",
      receivedAt: "2026-03-10T10:00:00.000Z"
    },
    rawInputs: [
      {
        kind: "text",
        content: "Business Lunch fuer 20 Personen mit Gemuesepfanne."
      }
    ]
  });
}

function productionPlan(): ProductionPlan {
  return {
    schemaVersion: SCHEMA_VERSION,
    planId: "plan-1",
    eventSpecId: "spec-1",
    readiness: {
      status: "complete",
      reasons: []
    },
    productionBatches: [
      {
        batchId: "batch-1",
        componentId: "component-1",
        recipeId: "recipe-1",
        scaledYield: {
          amount: 20,
          unit: "Portionen"
        },
        batchCount: 1,
        lossFactor: 1,
        station: "hot-kitchen",
        prepWindow: "2026-03-10 T-1",
        gnPlan: [
          {
            container: "GN 1/1",
            count: 1
          }
        ],
        ingredients: [
          {
            ingredientId: "zucchini",
            name: "Zucchini",
            quantity: {
              amount: 2,
              unit: "kg"
            },
            group: "produce",
            purchaseUnit: "kg",
            normalizedUnit: "kg"
          }
        ],
        steps: [
          {
            index: 1,
            instruction: "Schneiden"
          },
          {
            index: 2,
            instruction: "Braten"
          }
        ]
      }
    ],
    kitchenSheets: [
      {
        title: "Gemuesepfanne",
        componentId: "component-1",
        productionQty: {
          amount: 20,
          unit: "Portionen"
        },
        station: "hot-kitchen",
        prepWindow: "2026-03-10 T-1",
        ingredients: [
          {
            ingredientId: "zucchini",
            name: "Zucchini",
            quantity: {
              amount: 2,
              unit: "kg"
            },
            group: "produce",
            purchaseUnit: "kg",
            normalizedUnit: "kg"
          }
        ],
        steps: [
          {
            index: 1,
            instruction: "Schneiden"
          },
          {
            index: 2,
            instruction: "Braten"
          }
        ],
        instructions: ["Schneiden", "Braten"]
      }
    ],
    recipeSelections: [
      {
        componentId: "component-1",
        recipeId: "recipe-1",
        selectionReason: "Testrezept",
        autoUsedInternetRecipe: false
      }
    ],
    timeline: [],
    unresolvedItems: [],
    warnings: [],
    blockingIssues: [],
    isFallback: false
  };
}

function emptyPurchaseList(): PurchaseList {
  return {
    schemaVersion: SCHEMA_VERSION,
    purchaseListId: "purchase-1",
    eventSpecId: "spec-1",
    items: [],
    groupingMode: "group",
    totals: {
      itemCount: 0,
      groups: []
    }
  };
}

describe("planning readiness helpers", () => {
  it("classifies hard planning issues as blocking", () => {
    expect(isBlockingPlanningIssue("Herstellungsentscheidung fehlt. Bitte Eigenproduktion klären.")).toBe(true);
    expect(isBlockingPlanningIssue("Websuche fehlgeschlagen: Rezept")).toBe(true);
    expect(isBlockingPlanningIssue("Internet-Rezept muss manuell geprüft werden.")).toBe(false);
  });

  it("summarizes fallback reasons from blocking issues before warnings", () => {
    expect(summarizeFallbackReason(["Blocker"], ["Warnung"])).toBe("Blocker");
    expect(summarizeFallbackReason([], ["Warnung"])).toBe("Warnung");
    expect(summarizeFallbackReason([], [])).toContain("deterministischen Fallback");
  });

  it("keeps planning messages unique without reordering them", () => {
    expect(uniquePlanningMessages(["Blocker A", "Warnung B", "Blocker A", "Warnung C"])).toEqual([
      "Blocker A",
      "Warnung B",
      "Warnung C"
    ]);
  });

  it("reports missing purchase coverage with ingredient and source references", () => {
    const issues = purchaseCoverageBlockingIssues(productionPlan(), emptyPurchaseList());

    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("Zucchini");
    expect(issues[0]).toContain("component-1/recipe-1/batch-1");
  });

  it("marks a plan as fallback and annotates kitchen sheets when purchase coverage is missing", () => {
    const issue = "Einkaufsabdeckung fehlt für produktionsrelevante Zutaten: Zucchini.";
    const updated = withPurchaseCoverageBlockingIssues(eventSpec(), productionPlan(), [issue]);

    expect(updated.isFallback).toBe(true);
    expect(updated.fallbackReason).toBe(issue);
    expect(updated.blockingIssues).toContain(issue);
    expect(updated.unresolvedItems).toContain(issue);
    expect(updated.kitchenSheets[0].blockingNotes).toContain(issue);
    expect(updated.readiness.status).toBe("insufficient");
  });
});
