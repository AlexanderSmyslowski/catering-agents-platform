import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  parseUploadedRecipeText,
  type AcceptedEventSpec,
  type MenuComponent,
  type RecipeSearchQuery,
  type WebRecipeCandidate
} from "@catering/shared-core";
import {
  InMemoryRecipeRepository,
  RecipeDiscoveryService,
  type WebRecipeSearchProvider
} from "@catering/production-service";

class CountingWebProvider implements WebRecipeSearchProvider {
  calls = 0;

  async searchRecipes(_query: RecipeSearchQuery): Promise<WebRecipeCandidate[]> {
    this.calls += 1;
    return [];
  }
}

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-recipe-discovery-service-"));
}

function component(): MenuComponent {
  return {
    componentId: "component-kalbsbuletten",
    label: "Kalbsbuletten",
    menuCategory: "classic",
    productionDecision: {
      mode: "scratch"
    }
  };
}

function eventSpec(menuComponent: MenuComponent): AcceptedEventSpec {
  return {
    schemaVersion: SCHEMA_VERSION,
    specId: "spec-recipe-discovery-service",
    event: {
      date: "2026-06-25"
    },
    servicePlan: {
      eventType: "lunch",
      serviceForm: "buffet"
    },
    attendees: {
      expected: 40
    },
    menuPlan: [menuComponent]
  } as unknown as AcceptedEventSpec;
}

describe("recipe discovery service", () => {
  it("does not call the web provider when an internal recipe wins", async () => {
    const dataRoot = createDataRoot();
    const repository = new InMemoryRecipeRepository([], { rootDir: dataRoot });
    const provider = new CountingWebProvider();
    const recipe = parseUploadedRecipeText({
      recipeName: "Kalbsbuletten",
      filename: "kalbsbuletten.pdf",
      sourceRef: "test:kalbsbuletten",
      text: [
        "Kalbsbuletten",
        "Zutaten",
        "1 kg Kalbsgehacktes",
        "250 g Zwiebeln",
        "Zubereitung",
        "1. Masse mischen.",
        "2. Kalbsbuletten formen und braten."
      ].join("\n")
    });
    await repository.save(recipe);
    await repository.reviewRecipe(recipe.recipeId, { decision: "approve" });

    const menuComponent = component();
    const discovery = new RecipeDiscoveryService(repository, provider);
    const resolution = await discovery.resolveRecipe(menuComponent, eventSpec(menuComponent));

    expect(provider.calls).toBe(0);
    expect(resolution.recipe?.recipeId).toBe(recipe.recipeId);
    expect(resolution.selection).toMatchObject({
      componentId: menuComponent.componentId,
      recipeId: recipe.recipeId,
      autoUsedInternetRecipe: false,
      sourceTier: "internal_approved"
    });
    expect(resolution.selection.searchTrace).toContain("Interne Kandidaten: Kalbsbuletten");
    expect(resolution.selection.searchTrace).toContain("Interner Treffer gewählt: Kalbsbuletten.");

    rmSync(dataRoot, { recursive: true, force: true });
  });
});
