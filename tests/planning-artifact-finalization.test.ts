import { describe, expect, it, vi } from "vitest";
import {
  SCHEMA_VERSION,
  normalizeEventRequestToSpec,
  type AcceptedEventSpec,
  type ProductionPlan
} from "@catering/shared-core";

function eventSpec(): AcceptedEventSpec {
  return normalizeEventRequestToSpec({
    schemaVersion: SCHEMA_VERSION,
    requestId: "planning-finalization-1",
    source: {
      channel: "text",
      receivedAt: "2026-06-01T10:00:00.000Z"
    },
    rawInputs: [
      {
        kind: "text",
        content: "Business Lunch fuer 20 Personen mit Tomatensuppe."
      }
    ]
  });
}

function productionBatch(): ProductionPlan["productionBatches"][number] {
  return {
    batchId: "batch-1",
    componentId: "component-1",
    recipeId: "recipe-tomato-soup",
    scaledYield: {
      amount: 20,
      unit: "Portionen"
    },
    batchCount: 1,
    lossFactor: 1,
    station: "hot-kitchen",
    prepWindow: "2026-06-01 T-1",
    gnPlan: [{ container: "GN 1/1", count: 1 }],
    ingredients: [
      {
        ingredientId: "tomato",
        name: "Tomaten",
        quantity: { amount: 4, unit: "kg" },
        group: "produce",
        purchaseUnit: "kg",
        normalizedUnit: "kg"
      }
    ],
    steps: [{ index: 1, instruction: "Kochen." }]
  };
}

function baseInput(overrides: Record<string, unknown> = {}) {
  const spec = eventSpec();
  const batch = productionBatch();

  return {
    eventSpec: spec,
    readinessIssues: {
      unresolvedItems: [],
      warnings: [],
      blockingIssues: []
    },
    operationalArtifacts: {
      productionBatches: [batch],
      timeline: [{ label: "Tomatensuppe vorbereiten", at: "2026-06-01 T-1" }],
      kitchenSheets: [
        {
          title: "Tomatensuppe",
          componentId: "component-1",
          recipeId: "recipe-tomato-soup",
          productionQty: batch.scaledYield,
          station: "hot-kitchen",
          prepWindow: "2026-06-01 T-1",
          ingredients: batch.ingredients,
          steps: batch.steps,
          instructions: ["Kochen."]
        }
      ],
      procurementItems: []
    },
    recipeSelections: [
      {
        componentId: "component-1",
        recipeId: "recipe-tomato-soup",
        selectionReason: "Internes Rezept gewählt.",
        autoUsedInternetRecipe: false
      }
    ],
    ...overrides
  };
}

describe("planning artifact finalization", () => {
  it("builds a validated production plan and purchase list for a complete operational draft", async () => {
    const { buildFinalProductionArtifacts } = await import(
      "../production-service/src/rules/planning-artifact-finalization.js"
    );
    const artifacts = buildFinalProductionArtifacts(baseInput());

    expect(artifacts.productionPlan.planId).toBe(`plan-${artifacts.productionPlan.eventSpecId}`);
    expect(artifacts.productionPlan.isFallback).toBeUndefined();
    expect(artifacts.productionPlan.productionBatches).toHaveLength(1);
    expect(artifacts.purchaseList.eventSpecId).toBe(artifacts.productionPlan.eventSpecId);
    expect(artifacts.purchaseList.items.map((item) => item.ingredientId)).toEqual(["tomato"]);
  });

  it("deduplicates readiness issues and marks warning or blocking results as fallback", async () => {
    const { buildFinalProductionArtifacts } = await import(
      "../production-service/src/rules/planning-artifact-finalization.js"
    );
    const artifacts = buildFinalProductionArtifacts(
      baseInput({
        readinessIssues: {
          unresolvedItems: ["Rezept prüfen.", "Rezept prüfen."],
          warnings: ["Rezept prüfen.", "Rezept prüfen."],
          blockingIssues: []
        }
      })
    );

    expect(artifacts.productionPlan.isFallback).toBe(true);
    expect(artifacts.productionPlan.unresolvedItems).toEqual(["Rezept prüfen."]);
    expect(artifacts.productionPlan.warnings).toEqual(["Rezept prüfen."]);
    expect(artifacts.productionPlan.fallbackReason).toBe("Rezept prüfen.");
  });

  it("applies purchase coverage issues as blocking fallback annotations", async () => {
    vi.resetModules();
    vi.doMock("@catering/shared-core", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@catering/shared-core")>();
      return {
        ...actual,
        aggregatePurchaseList: (...args: Parameters<typeof actual.aggregatePurchaseList>) => {
          const list = actual.aggregatePurchaseList(...args);
          const items = list.items.filter((item) => item.ingredientId !== "tomato");
          return {
            ...list,
            items,
            totals: {
              itemCount: items.length,
              groups: [...new Set(items.map((item) => item.group))]
            }
          };
        }
      };
    });
    const { buildFinalProductionArtifacts } = await import(
      "../production-service/src/rules/planning-artifact-finalization.js"
    );
    const artifacts = buildFinalProductionArtifacts(
      baseInput()
    );

    expect(artifacts.productionPlan.isFallback).toBe(true);
    expect(artifacts.productionPlan.blockingIssues?.join(" ")).toContain("Einkaufsabdeckung fehlt");
    expect(artifacts.productionPlan.blockingIssues?.join(" ")).toContain("Tomaten");
    expect(artifacts.productionPlan.kitchenSheets[0].blockingNotes?.join(" ")).toContain("Tomaten");
    vi.doUnmock("@catering/shared-core");
  });
});
