import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  normalizeEventRequestToSpec,
  parseUploadedRecipeText,
  type AcceptedEventSpec,
  type EventRequest,
  type RecipeSearchQuery,
  type WebRecipeCandidate
} from "@catering/shared-core";
import {
  InMemoryRecipeRepository,
  RecipeDiscoveryService,
  type WebRecipeSearchProvider
} from "@catering/production-service";
import { recipeSuggestionsForComponent } from "../backoffice-ui/src/production-recipe-suggestions.js";

class EmptyWebProvider implements WebRecipeSearchProvider {
  async searchRecipes(_query: RecipeSearchQuery): Promise<WebRecipeCandidate[]> {
    return [];
  }
}

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-recipe-alias-parity-"));
}

function baseEventRequest(label: string): EventRequest {
  return {
    schemaVersion: SCHEMA_VERSION,
    requestId: `request-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    source: {
      channel: "text",
      receivedAt: "2026-03-10T10:00:00.000Z"
    },
    rawInputs: [
      {
        kind: "text",
        content: `Konferenz am 2026-05-12 fuer 60 Teilnehmer. Buffet mit ${label}.`
      }
    ]
  };
}

function singleComponentSpec(
  label: string,
  category: "classic" | "vegetarian" | "vegan"
): AcceptedEventSpec {
  const spec = normalizeEventRequestToSpec(baseEventRequest(label));

  return {
    ...spec,
    menuPlan: [
      {
        ...spec.menuPlan[0],
        label,
        menuCategory: category,
        dietaryTags: category === "classic" ? [] : [category],
        productionDecision: {
          mode: "scratch"
        }
      }
    ]
  };
}

describe("production recipe alias parity", () => {
  const cases = [
    {
      componentLabel: "Hummus vegan",
      category: "vegan" as const,
      recipeName: "Humus Tahini Dip vegan",
      filename: "internes-rezept-481.pdf",
      sourceRef: "test:middle-east-dip-vegan",
      text: [
        "Humus Tahini Dip vegan",
        "Zutaten",
        "1 kg Kichererbsen",
        "250 g Tahini",
        "80 ml Zitronensaft",
        "Zubereitung",
        "1. Humus vegan mixen.",
        "2. Mit Tahini und Zitronensaft abschmecken."
      ].join("\n")
    },
    {
      componentLabel: "Gemuesepfanne vegan",
      category: "vegan" as const,
      recipeName: "Gemüsepfanne Zucchini Pilze Pak Choi vegan",
      filename: "internes-rezept-482.pdf",
      sourceRef: "test:vegetable-pan-vegan",
      text: [
        "Gemüsepfanne Zucchini Pilze Pak Choi vegan",
        "Zutaten",
        "2 kg Zucchini",
        "1 kg Pilze",
        "800 g Pak Choi",
        "500 g Zuckerschoten",
        "Zubereitung",
        "1. Gemüse schneiden.",
        "2. Gemüsepfanne vegan braten."
      ].join("\n")
    },
    {
      componentLabel: "Obstspiesse vegan",
      category: "vegan" as const,
      recipeName: "Fruit Skewers vegan",
      filename: "internes-rezept-483.pdf",
      sourceRef: "test:coffee-break-fruit-skewers",
      text: [
        "Fruit Skewers vegan",
        "Zutaten",
        "3 kg Melone",
        "2 kg Trauben",
        "2 kg Beeren",
        "1 kg Apfel",
        "Zubereitung",
        "1. Obst waschen und schneiden.",
        "2. Obstspiesse stecken.",
        "3. Gekuehlt bereitstellen."
      ].join("\n")
    }
  ];

  it.each(cases)(
    "keeps backend discovery and UI suggestions aligned for $componentLabel",
    async ({ componentLabel, category, recipeName, filename, sourceRef, text }) => {
      const dataRoot = createDataRoot();
      const repository = new InMemoryRecipeRepository([], { rootDir: dataRoot });
      const recipe = parseUploadedRecipeText({
        recipeName,
        filename,
        sourceRef,
        text
      });
      await repository.save(recipe);

      const spec = singleComponentSpec(componentLabel, category);
      const component = spec.menuPlan[0];
      const discovery = new RecipeDiscoveryService(repository, new EmptyWebProvider());
      const resolution = await discovery.resolveRecipe(component, spec);
      const uiRecipes = (await repository.list()).map((storedRecipe) => ({
        recipeId: storedRecipe.recipeId,
        name: storedRecipe.name,
        source: storedRecipe.source
      }));
      const suggestions = recipeSuggestionsForComponent(component.label, uiRecipes);

      expect(resolution.selection.sourceTier).toBe("internal_approved");
      expect(resolution.selection.recipeId).toBe(recipe.recipeId);
      expect(suggestions[0]).toEqual({
        recipeId: recipe.recipeId,
        name: recipe.name
      });

      rmSync(dataRoot, { recursive: true, force: true });
    }
  );
});
