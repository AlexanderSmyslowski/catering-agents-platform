import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  createEventRequestFromText,
  normalizeEventRequestToSpec,
  type AcceptedEventSpec,
  type Recipe,
  type RecipeSearchQuery,
  type WebRecipeCandidate
} from "@catering/shared-core";
import {
  buildProductionArtifacts,
  InMemoryRecipeRepository,
  RecipeDiscoveryService,
  type WebRecipeSearchProvider
} from "@catering/production-service";

class NoopWebRecipeProvider implements WebRecipeSearchProvider {
  calls: RecipeSearchQuery[] = [];

  async searchRecipes(query: RecipeSearchQuery): Promise<WebRecipeCandidate[]> {
    this.calls.push(query);
    return [];
  }
}

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-agents-gold-run-"));
}

function createInternalRecipe(): Recipe {
  return {
    schemaVersion: SCHEMA_VERSION,
    recipeId: "goldrun-vegetarische-tomatensuppe",
    name: "Vegetarische Tomatensuppe Bankett",
    source: {
      tier: "internal_verified",
      originType: "internal_db",
      reference: "internal/goldrun-vegetarische-tomatensuppe",
      retrievedAt: "2026-01-01T00:00:00.000Z",
      approvalState: "approved_internal",
      qualityScore: 0.97,
      fitScore: 0.96,
      extractionCompleteness: 1
    },
    baseYield: {
      servings: 10,
      unit: "Portionen"
    },
    ingredients: [
      {
        ingredientId: "goldrun-tomaten",
        name: "Tomaten",
        quantity: {
          amount: 2,
          unit: "kg"
        },
        group: "produce",
        purchaseUnit: "kg",
        normalizedUnit: "g"
      }
    ],
    steps: [
      {
        index: 1,
        instruction: "Tomaten garen, passieren und fuer das Buffet heisshalten."
      }
    ],
    scalingRules: {
      defaultLossFactor: 1.05,
      batchSize: 10
    },
    allergens: [],
    dietTags: ["vegetarian"]
  };
}

function createClassicCaesarRecipe(): Recipe {
  return {
    schemaVersion: SCHEMA_VERSION,
    recipeId: "goldrun-classic-caesar-bowl",
    name: "Caesar Bowl Classic",
    source: {
      tier: "internal_verified",
      originType: "internal_db",
      reference: "internal/goldrun-classic-caesar-bowl",
      retrievedAt: "2026-01-01T00:00:00.000Z",
      approvalState: "approved_internal",
      qualityScore: 0.95,
      fitScore: 0.94,
      extractionCompleteness: 1
    },
    baseYield: {
      servings: 10,
      unit: "Portionen"
    },
    ingredients: [
      {
        ingredientId: "goldrun-caesar-chicken",
        name: "Huhn",
        quantity: {
          amount: 1.5,
          unit: "kg"
        },
        group: "meat",
        purchaseUnit: "kg",
        normalizedUnit: "g"
      }
    ],
    steps: [
      {
        index: 1,
        instruction: "Huhn garen und mit Caesar-Zutaten anrichten."
      }
    ],
    scalingRules: {
      defaultLossFactor: 1.05,
      batchSize: 10
    },
    allergens: ["milk", "egg"],
    dietTags: []
  };
}

function applyGoldRunProductionDecisions(spec: AcceptedEventSpec): AcceptedEventSpec {
  return {
    ...spec,
    menuPlan: [
      {
        componentId: "goldrun-tomato-soup",
        label: "Vegetarische Tomatensuppe",
        menuCategory: "vegetarian",
        serviceStyle: "buffet",
        servings: spec.attendees.expected,
        productionDecision: {
          mode: "scratch"
        }
      },
      {
        componentId: "goldrun-mystery-bowl",
        label: "Mystery Bowl",
        menuCategory: "vegetarian",
        serviceStyle: "buffet",
        servings: spec.attendees.expected,
        productionDecision: {
          mode: "scratch",
          notes: "Aus Intake-Text getrennt; Rezept und fachliche Spezifikation offen."
        }
      },
      {
        componentId: "goldrun-vegan-caesar",
        label: "Vegane Caesar Bowl",
        menuCategory: "vegan",
        serviceStyle: "buffet",
        servings: spec.attendees.expected,
        recipeOverrideId: "goldrun-classic-caesar-bowl",
        productionDecision: {
          mode: "scratch",
          notes: "Bewusstes Override auf ein klassisches Rezept, um harte Menükategorie-Konflikte sichtbar zu machen."
        }
      }
    ]
  };
}

describe("production gold run", () => {
  it("turns a realistic lunch buffet intake into a plan with internal recipe, clarification and purchase list", async () => {
    const request = createEventRequestFromText({
      requestId: "goldrun-lunch-buffet-1",
      channel: "text",
      rawText:
        "Konferenz am 2026-09-18 fuer 80 Teilnehmer mit Lunchbuffet, Vegetarische Tomatensuppe und Mystery Bowl."
    });
    const acceptedSpec = normalizeEventRequestToSpec(request, {
      sourceType: "manual_input",
      reference: "goldrun-lunch-buffet-1",
      commercialState: "manual"
    });

    expect(request.rawInputs[0]).toMatchObject({
      kind: "text",
      content: expect.stringContaining("Vegetarische Tomatensuppe")
    });
    expect(acceptedSpec.readiness.status).toBe("complete");
    expect(acceptedSpec.event.date).toBe("2026-09-18");
    expect(acceptedSpec.attendees.expected).toBe(80);
    expect(acceptedSpec.event.serviceForm).toBe("buffet");
    expect(acceptedSpec.menuPlan.map((item) => item.label)).toEqual(
      expect.arrayContaining(["Lunchbuffet", "Vegetarische Tomatensuppe und Mystery Bowl."])
    );

    const productionSpec = applyGoldRunProductionDecisions(acceptedSpec);
    expect(productionSpec.menuPlan).toEqual([
      expect.objectContaining({
        componentId: "goldrun-tomato-soup",
        label: "Vegetarische Tomatensuppe",
        productionDecision: { mode: "scratch" }
      }),
      expect.objectContaining({
        componentId: "goldrun-mystery-bowl",
        label: "Mystery Bowl",
        productionDecision: expect.objectContaining({ mode: "scratch" })
      }),
      expect.objectContaining({
        componentId: "goldrun-vegan-caesar",
        label: "Vegane Caesar Bowl",
        menuCategory: "vegan",
        recipeOverrideId: "goldrun-classic-caesar-bowl"
      })
    ]);

    const dataRoot = createDataRoot();
    try {
      const repository = new InMemoryRecipeRepository([], { rootDir: dataRoot });
      await repository.save(createInternalRecipe());
      await repository.save(createClassicCaesarRecipe());
      const webProvider = new NoopWebRecipeProvider();
      const discovery = new RecipeDiscoveryService(repository, webProvider);

      const artifacts = await buildProductionArtifacts(productionSpec, discovery);
      const { productionPlan, purchaseList } = artifacts;

      const soupSelection = productionPlan.recipeSelections.find(
        (selection) => selection.componentId === "goldrun-tomato-soup"
      );
      const mysterySelection = productionPlan.recipeSelections.find(
        (selection) => selection.componentId === "goldrun-mystery-bowl"
      );
      const mysterySheet = productionPlan.kitchenSheets.find(
        (sheet) => sheet.componentId === "goldrun-mystery-bowl"
      );
      const blockedSheet = productionPlan.kitchenSheets.find(
        (sheet) => sheet.componentId === "goldrun-vegan-caesar"
      );
      const readinessByComponent = Object.fromEntries(
        (productionPlan.componentReadiness ?? []).map((component) => [
          component.componentId,
          component
        ])
      );

      expect(productionPlan.readiness.status).toBe("insufficient");
      expect(productionPlan.isFallback).toBe(true);
      expect(productionPlan.blockingIssues?.join(" ")).toContain("Harte Menükategorie vegan");
      expect(productionPlan.unresolvedItems.join(" ")).toContain("Mystery Bowl");
      expect(productionPlan.unresolvedItems.join(" ")).toContain("Harte Menükategorie vegan");
      expect(productionPlan.productionBatches).toHaveLength(1);
      expect(productionPlan.productionBatches[0]).toMatchObject({
        componentId: "goldrun-tomato-soup",
        recipeId: "goldrun-vegetarische-tomatensuppe"
      });
      expect(productionPlan.timeline).toEqual([]);
      expect(productionPlan.kitchenSheets).toHaveLength(3);
      expect(productionPlan.kitchenSheets[0].title).toContain("Vegetarische Tomatensuppe");

      expect(soupSelection).toMatchObject({
        componentId: "goldrun-tomato-soup",
        recipeId: "goldrun-vegetarische-tomatensuppe",
        sourceTier: "internal_verified",
        autoUsedInternetRecipe: false
      });
      expect(soupSelection?.selectionReason).toContain("interne");

      expect(mysterySelection).toMatchObject({
        componentId: "goldrun-mystery-bowl",
        autoUsedInternetRecipe: false
      });
      expect(mysterySelection?.recipeId).toBeUndefined();
      expect(mysterySelection?.selectionReason).toContain("belastbar validiert");

      expect(mysterySheet).toMatchObject({
        title: "Mystery Bowl - Rezeptklärung nötig",
        ingredients: [],
        steps: []
      });
      expect(mysterySheet?.blockingNotes?.join(" ")).toContain("belastbar validiert");
      expect(mysterySheet?.instructions.join(" ")).toContain("Aktuell geplant für 80 Portionen");

      expect(blockedSheet).toMatchObject({
        title: "Vegane Caesar Bowl - Rezeptklärung nötig",
        ingredients: [],
        steps: []
      });
      expect(blockedSheet?.blockingNotes?.join(" ")).toContain("Harte Menükategorie vegan");

      expect(readinessByComponent["goldrun-tomato-soup"]).toMatchObject({
        label: "Vegetarische Tomatensuppe",
        status: "operational",
        hasProductionBatch: true,
        hasKitchenSheet: true,
        includedInPurchaseList: true,
        blocksProduction: false
      });
      expect(readinessByComponent["goldrun-mystery-bowl"]).toMatchObject({
        label: "Mystery Bowl",
        status: "needs_clarification",
        hasProductionBatch: false,
        hasKitchenSheet: true,
        includedInPurchaseList: false,
        blocksProduction: false
      });
      expect(readinessByComponent["goldrun-vegan-caesar"]).toMatchObject({
        label: "Vegane Caesar Bowl",
        status: "blocked",
        hasProductionBatch: false,
        hasKitchenSheet: true,
        includedInPurchaseList: false,
        blocksProduction: true
      });

      expect(purchaseList.items.length).toBeGreaterThan(0);
      expect(purchaseList.items).toEqual([
        expect.objectContaining({
          displayName: "Tomaten",
          group: "produce",
          sourceRecipes: ["goldrun-vegetarische-tomatensuppe"]
        })
      ]);
      expect(purchaseList.totals.itemCount).toBe(1);
      expect(purchaseList.totals.groups).toEqual(["produce"]);
      expect(purchaseList.items[0].displayName).not.toContain("garen");
      expect(purchaseList.items.map((item) => item.displayName)).not.toContain("Huhn");

      expect(webProvider.calls.length).toBeGreaterThan(0);
      expect(webProvider.calls.every((call) => call.component.label === "Mystery Bowl")).toBe(true);
    } finally {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });
});
