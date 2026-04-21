import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  createEventRequestFromManualForm,
  createEventRequestFromText,
  normalizeEventRequestToSpec,
  type Recipe
} from "@catering/shared-core";
import {
  InMemoryRecipeRepository,
  RecipeDiscoveryService,
  buildProductionArtifacts
} from "@catering/production-service";

class EmptyWebProvider {
  async searchRecipes() {
    return [];
  }
}

type Summary = {
  intakeReadiness: string;
  planReadiness: string;
  isFallback: boolean;
  hasBlockingIssues: boolean;
  productionBatches: number;
  kitchenSheets: number;
  purchaseItems: number;
  menuLabels: string[];
  productionConstraints: string[];
  eventType: string;
  serviceForm: string;
  assumptionCodes: string[];
  uncertaintyFields: string[];
};

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-agents-e2e-"));
}

function operationalSummary(summary: Summary) {
  return {
    intakeReadiness: summary.intakeReadiness,
    planReadiness: summary.planReadiness,
    isFallback: summary.isFallback,
    hasBlockingIssues: summary.hasBlockingIssues,
    productionBatches: summary.productionBatches,
    kitchenSheets: summary.kitchenSheets,
    purchaseItems: summary.purchaseItems,
    menuLabels: summary.menuLabels,
    serviceForm: summary.serviceForm
  };
}

function createRecipe(recipe: {
  recipeId: string;
  name: string;
  ingredientName: string;
  dietTags?: string[];
  ingredientId?: string;
}): Recipe {
  return {
    schemaVersion: SCHEMA_VERSION,
    recipeId: recipe.recipeId,
    name: recipe.name,
    source: {
      tier: "internal_verified",
      originType: "internal_db",
      reference: `internal/${recipe.recipeId}`,
      retrievedAt: "2026-01-01T00:00:00.000Z",
      approvalState: "approved_internal",
      qualityScore: 0.96,
      fitScore: 0.96,
      extractionCompleteness: 1
    },
    baseYield: {
      servings: 10,
      unit: "Portionen"
    },
    ingredients: [
      {
        ingredientId: recipe.ingredientId ?? `${recipe.recipeId}-ingredient`,
        name: recipe.ingredientName,
        quantity: {
          amount: 1,
          unit: "kg"
        },
        group: "main",
        purchaseUnit: "kg",
        normalizedUnit: "g"
      }
    ],
    steps: [
      {
        index: 1,
        instruction: `Zubereitung von ${recipe.name}.`
      }
    ],
    scalingRules: {
      defaultLossFactor: 1.05,
      batchSize: 10
    },
    allergens: [],
    dietTags: recipe.dietTags ?? []
  };
}

function createDiscoveryService(repository: InMemoryRecipeRepository): RecipeDiscoveryService {
  return new RecipeDiscoveryService(repository, new EmptyWebProvider());
}

async function runParityFlow(
  request:
    | ReturnType<typeof createEventRequestFromText>
    | ReturnType<typeof createEventRequestFromManualForm>,
  recipe: Parameters<typeof createRecipe>[0]
): Promise<Summary> {
  const spec = normalizeEventRequestToSpec(request);
  const dataRoot = createDataRoot();

  try {
    const repository = new InMemoryRecipeRepository([], { rootDir: dataRoot });
    await repository.save(createRecipe(recipe));

    const discovery = createDiscoveryService(repository);
    const plannedSpec = {
      ...spec,
      menuPlan: spec.menuPlan.map((item) => ({
        ...item,
        productionDecision: {
          mode: "scratch" as const
        }
      }))
    };
    const artifacts = await buildProductionArtifacts(plannedSpec, discovery);

    return {
      intakeReadiness: spec.readiness.status,
      planReadiness: artifacts.productionPlan.readiness.status,
      isFallback: artifacts.productionPlan.isFallback === true,
      hasBlockingIssues: (artifacts.productionPlan.blockingIssues?.length ?? 0) > 0,
      productionBatches: artifacts.productionPlan.productionBatches.length,
      kitchenSheets: artifacts.productionPlan.kitchenSheets.length,
      purchaseItems: artifacts.purchaseList.items.length,
      menuLabels: spec.menuPlan.map((item) => item.label),
      productionConstraints: spec.productionConstraints ?? [],
      eventType: spec.event.type ?? "",
      serviceForm: spec.event.serviceForm ?? "",
      assumptionCodes: spec.assumptions?.map((assumption) => assumption.code) ?? [],
      uncertaintyFields: spec.uncertainties?.map((uncertainty) => uncertainty.field) ?? []
    };
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
}

describe("manual form intake to production e2e", () => {
  it("keeps a realistic manual form request consistent end to end", async () => {
    const request = createEventRequestFromManualForm({
      requestId: "manual-e2e-positive-1",
      eventDate: "2026-07-12",
      attendeeCount: 48,
      serviceForm: "buffet",
      menuItems: ["Vegetarische Tomatensuppe"],
      notes: "Bitte vegetarisch"
    });
    const spec = normalizeEventRequestToSpec(request);

    expect(request.source.channel).toBe("manual_form");
    expect(request.rawInputs[0].kind).toBe("form");
    expect(request.rawInputs[0].content).toContain("Notizen: Bitte vegetarisch");
    expect(request.constraints ?? []).toEqual(expect.arrayContaining(["Bitte vegetarisch"]));
    expect(spec.event.date).toBe("2026-07-12");
    expect(spec.attendees.expected).toBe(48);
    expect(spec.event.serviceForm).toBe("buffet");
    expect(spec.menuPlan).toHaveLength(1);
    expect(spec.menuPlan[0].label).toBe("Vegetarische Tomatensuppe");
    expect(spec.productionConstraints ?? []).toEqual(expect.arrayContaining(["vegetarian"]));
    expect(spec.readiness.status).toBe("complete");

    const dataRoot = createDataRoot();
    try {
      const repository = new InMemoryRecipeRepository([], { rootDir: dataRoot });
      await repository.save(
        createRecipe({
          recipeId: "tomatensuppe-manual",
          name: "Tomatensuppe",
          ingredientName: "Tomaten",
          dietTags: ["vegetarian"]
        })
      );

      const plannedSpec = {
        ...spec,
        menuPlan: spec.menuPlan.map((item) => ({
          ...item,
          productionDecision: {
            mode: "scratch" as const
          }
        }))
      };
      const discovery = createDiscoveryService(repository);
      const artifacts = await buildProductionArtifacts(plannedSpec, discovery);

      expect(artifacts.productionPlan.readiness.status).toBe("complete");
      expect(artifacts.productionPlan.isFallback).not.toBe(true);
      expect(artifacts.productionPlan.blockingIssues ?? []).toHaveLength(0);
      expect(artifacts.productionPlan.recipeSelections).toHaveLength(1);
      expect(artifacts.productionPlan.productionBatches).toHaveLength(1);
      expect(artifacts.productionPlan.kitchenSheets).toHaveLength(1);
      expect(artifacts.productionPlan.kitchenSheets[0].title).toContain("Tomatensuppe");
      expect(artifacts.productionPlan.timeline[0].label).toContain("Tomatensuppe");
      expect(artifacts.purchaseList.items.length).toBeGreaterThan(0);
      expect(artifacts.purchaseList.items[0].displayName).toContain("Tomaten");
      expect(artifacts.purchaseList.totals.itemCount).toBeGreaterThan(0);
    } finally {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });

  it("turns a manual form conflict into a blocking fallback without operational artifacts", async () => {
    const request = createEventRequestFromManualForm({
      requestId: "manual-e2e-negative-1",
      eventDate: "2026-07-13",
      attendeeCount: 36,
      serviceForm: "buffet",
      menuItems: ["Klassisch Brot & Baguette"],
      notes: "Bitte glutenfrei"
    });
    const spec = normalizeEventRequestToSpec(request);

    expect(request.source.channel).toBe("manual_form");
    expect(request.rawInputs[0].content).toContain("Notizen: Bitte glutenfrei");
    expect(request.constraints ?? []).toEqual(expect.arrayContaining(["Bitte glutenfrei"]));
    expect(spec.event.date).toBe("2026-07-13");
    expect(spec.attendees.expected).toBe(36);
    expect(spec.event.serviceForm).toBe("buffet");
    expect(spec.menuPlan).toHaveLength(1);
    expect(spec.menuPlan[0].label).toBe("Klassisch Brot & Baguette");
    expect(spec.productionConstraints ?? []).toEqual(expect.arrayContaining(["gluten_free"]));
    expect(spec.readiness.status).toBe("complete");

    const dataRoot = createDataRoot();
    try {
      const repository = new InMemoryRecipeRepository([], { rootDir: dataRoot });
      await repository.save(
        createRecipe({
          recipeId: "bread-baguette-manual",
          name: "Bread & Baguette",
          ingredientName: "Weizenmehl",
          dietTags: []
        })
      );

      const plannedSpec = {
        ...spec,
        menuPlan: spec.menuPlan.map((item) => ({
          ...item,
          productionDecision: {
            mode: "scratch" as const
          }
        }))
      };
      const discovery = createDiscoveryService(repository);
      const artifacts = await buildProductionArtifacts(plannedSpec, discovery);

      expect(artifacts.productionPlan.isFallback).toBe(true);
      expect(artifacts.productionPlan.readiness.status).toBe("insufficient");
      expect(artifacts.productionPlan.blockingIssues?.join(" ")).toContain("gluten_free");
      expect(artifacts.productionPlan.fallbackReason).toContain("gluten_free");
      expect(artifacts.productionPlan.recipeSelections).toHaveLength(1);
      expect(artifacts.productionPlan.recipeSelections[0].selectionReason).toContain("gluten_free");
      expect(artifacts.productionPlan.productionBatches).toHaveLength(0);
      expect(artifacts.productionPlan.kitchenSheets).toHaveLength(0);
      expect(artifacts.productionPlan.timeline).toHaveLength(0);
      expect(artifacts.purchaseList.items).toHaveLength(0);
      expect(artifacts.purchaseList.totals.itemCount).toBe(0);
    } finally {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });

  describe("intake path parity e2e", () => {
    it.each([
      {
        name: "planbarer Inhalt bleibt über Text und Manual Form operativ gleichgerichtet",
        textRequest: {
          requestId: "parity-positive-text-1",
          rawText:
            "Konferenz am 2026-07-12 fuer 48 Teilnehmer. Bitte vegetarisch. Buffet mit Vegetarische Tomatensuppe."
        },
        manualRequest: {
          requestId: "parity-positive-form-1",
          eventType: "Konferenz",
          eventDate: "2026-07-12",
          attendeeCount: 48,
          serviceForm: "buffet",
          menuItems: ["Vegetarische Tomatensuppe"],
          notes: "Bitte vegetarisch"
        },
        recipe: {
          recipeId: "parity-vegetarische-tomatensuppe",
          name: "Vegetarische Tomatensuppe",
          ingredientName: "Tomaten",
          dietTags: ["vegetarian"]
        },
        expected: {
          intakeReadiness: "complete",
          planReadiness: "complete",
          isFallback: false,
          hasBlockingIssues: false,
          productionBatches: 1,
          kitchenSheets: 1,
          menuLabels: ["Vegetarische Tomatensuppe"]
        }
      },
      {
        name: "problematischer Inhalt endet über Text und Manual Form konsistent blockiert",
        textRequest: {
          requestId: "parity-negative-text-1",
          rawText:
            "Konferenz am 2026-07-13 fuer 36 Teilnehmer. Bitte glutenfrei. Buffet mit Brot-Baguette."
        },
        manualRequest: {
          requestId: "parity-negative-form-1",
          eventType: "Konferenz",
          eventDate: "2026-07-13",
          attendeeCount: 36,
          serviceForm: "buffet",
          menuItems: ["Brot-Baguette"],
          notes: "Bitte glutenfrei"
        },
        recipe: {
          recipeId: "parity-brot-baguette",
          name: "Brot-Baguette",
          ingredientName: "Weizenmehl"
        },
        expected: {
          intakeReadiness: "complete",
          planReadiness: "insufficient",
          isFallback: true,
          hasBlockingIssues: true,
          productionBatches: 0,
          kitchenSheets: 0,
          menuLabels: ["Brot-Baguette"]
        }
      }
    ])("$name", async ({ textRequest, manualRequest, recipe, expected }) => {
      const textSummary = await runParityFlow(
        createEventRequestFromText({
          requestId: textRequest.requestId,
          channel: "text",
          rawText: textRequest.rawText
        }),
        recipe
      );
      const manualSummary = await runParityFlow(createEventRequestFromManualForm(manualRequest), recipe);

      expect(operationalSummary(textSummary)).toEqual(operationalSummary(manualSummary));
      expect(textSummary).toMatchObject(expected);

      if (expected.isFallback) {
        expect(textSummary.purchaseItems).toBe(0);
      } else {
        expect(textSummary.purchaseItems).toBeGreaterThan(0);
      }

      expect(textSummary.menuLabels).toEqual(expected.menuLabels);
    });
  });

  describe("acceptance smoke e2e", () => {
    it("keeps a typical internal lunch meeting operatively usable across text and manual form", async () => {
      const textSummary = await runParityFlow(
        createEventRequestFromText({
          requestId: "acceptance-smoke-text-1",
          channel: "text",
          rawText:
            "Internes Mittagessen am 2026-07-18, ca. 45 Personen, gegen 12:30 Uhr, bitte vegetarisch und glutenfrei, mit Vegetarische Tomatensuppe."
        }),
        {
          recipeId: "acceptance-smoke-tomatensuppe",
          name: "Vegetarische Tomatensuppe",
          ingredientName: "Tomaten",
          dietTags: ["vegetarian", "gluten_free"]
        }
      );

      const manualSummary = await runParityFlow(
        createEventRequestFromManualForm({
          requestId: "acceptance-smoke-form-1",
          eventType: "lunch",
          eventDate: "2026-07-18",
          attendeeCount: 45,
          serviceForm: "buffet",
          menuItems: ["Vegetarische Tomatensuppe"],
          notes: "gegen 12:30 Uhr, bitte vegetarisch und glutenfrei"
        }),
        {
          recipeId: "acceptance-smoke-tomatensuppe",
          name: "Vegetarische Tomatensuppe",
          ingredientName: "Tomaten",
          dietTags: ["vegetarian", "gluten_free"]
        }
      );

      expect(operationalSummary(textSummary)).toEqual(operationalSummary(manualSummary));
      expect(textSummary.intakeReadiness).toBe("complete");
      expect(textSummary.planReadiness).toBe("complete");
      expect(textSummary.isFallback).toBe(false);
      expect(textSummary.hasBlockingIssues).toBe(false);
      expect(textSummary.productionBatches).toBe(1);
      expect(textSummary.kitchenSheets).toBe(1);
      expect(textSummary.purchaseItems).toBeGreaterThan(0);
      expect(textSummary.menuLabels).toEqual(["Vegetarische Tomatensuppe"]);
      expect(textSummary.productionConstraints).toEqual(
        expect.arrayContaining(["vegetarian", "gluten_free"])
      );
      expect(textSummary.serviceForm).toBe("buffet");
      expect(textSummary.eventType).toBe("lunch");
      expect(textSummary.assumptionCodes).toEqual(
        expect.arrayContaining(["attendees_expected_approximate"])
      );
      expect(textSummary.uncertaintyFields).toEqual(
        expect.arrayContaining(["event.schedule", "attendees.expected"])
      );
      expect(textSummary.uncertaintyFields).not.toContain("event.date_or_schedule");
    });
  });
});

