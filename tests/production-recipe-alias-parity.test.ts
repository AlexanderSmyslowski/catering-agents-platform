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
      componentLabel: "Vegetarische Tomatensuppe",
      category: "vegetarian" as const,
      recipeName: "Tomato Soup vegetarian",
      filename: "internes-rezept-483.pdf",
      sourceRef: "test:tomato-soup-vegetarian",
      text: [
        "Tomato Soup vegetarian",
        "Zutaten",
        "6 kg Tomaten",
        "1 kg Zwiebeln",
        "3 l Gemüsebrühe",
        "Zubereitung",
        "1. Tomaten und Zwiebeln schneiden.",
        "2. Tomatensuppe kochen.",
        "3. Pürieren und warmhalten."
      ].join("\n")
    },
    {
      componentLabel: "Obstspiesse vegan",
      category: "vegan" as const,
      recipeName: "Fruit Skewers vegan",
      filename: "internes-rezept-484.pdf",
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
    },
    {
      componentLabel: "NUDELSALAT | FRISCHGEDOENS",
      category: "vegetarian" as const,
      recipeName: "Pasta-Salat mit frischem Gemüse",
      filename: "internes-rezept-491.pdf",
      sourceRef: "test:buffet-pasta-salad-fresh-vegetables",
      text: [
        "Pasta-Salat mit frischem Gemüse",
        "Zutaten",
        "3 kg Pasta",
        "2 kg Tomaten",
        "1 kg Gurken",
        "1 l Vinaigrette",
        "Zubereitung",
        "1. Pasta kochen und abkuehlen.",
        "2. Gemuese schneiden.",
        "3. Pasta-Salat vegetarisch kalt bereitstellen."
      ].join("\n")
    },
    {
      componentLabel: "Linseneintopf vegan",
      category: "vegan" as const,
      recipeName: "Lentil Stew vegan",
      filename: "internes-rezept-485.pdf",
      sourceRef: "test:lentil-stew-vegan",
      text: [
        "Lentil Stew vegan",
        "Zutaten",
        "3 kg Linsen",
        "2 kg Karotten",
        "1 kg Sellerie",
        "4 l Gemüsebrühe",
        "Zubereitung",
        "1. Linsen und Gemüse garen.",
        "2. Lentil Stew vegan abschmecken.",
        "3. Warmhalten."
      ].join("\n")
    },
    {
      componentLabel: "MANDEL-CURRY | BASMATIREIS & KORIANDER-TOPPING",
      category: "vegan" as const,
      recipeName: "Almond Curry with Basmati Rice vegan",
      filename: "internes-rezept-486.pdf",
      sourceRef: "test:quick-lunch-almond-curry",
      text: [
        "Almond Curry with Basmati Rice vegan",
        "Zutaten",
        "1 kg Gemüse",
        "400 g almonds",
        "1 l coconut milk",
        "800 g basmati rice",
        "120 g coriander",
        "Zubereitung",
        "1. Vegan curry kochen.",
        "2. Mit basmati rice und coriander servieren."
      ].join("\n")
    },
    {
      componentLabel: "Kraut-Karottensalat vegan",
      category: "vegan" as const,
      recipeName: "Coleslaw Cabbage Carrot Salad vegan",
      filename: "internes-rezept-487.pdf",
      sourceRef: "test:quick-lunch-cabbage-carrot-salad",
      text: [
        "Coleslaw Cabbage Carrot Salad vegan",
        "Zutaten",
        "2 kg Kraut",
        "1 kg Karotten",
        "500 ml Vinaigrette",
        "Zubereitung",
        "1. Kraut fein schneiden.",
        "2. Karotten raspeln.",
        "3. Coleslaw vegan kalt bereitstellen."
      ].join("\n")
    },
    {
      componentLabel: "Auberginenröllchen vegan",
      category: "vegan" as const,
      recipeName: "Eggplant Rolls vegan",
      filename: "internes-rezept-488.pdf",
      sourceRef: "test:antipasti-eggplant-rolls",
      text: [
        "Eggplant Rolls vegan",
        "Zutaten",
        "4 kg Auberginen",
        "1 kg Tomaten",
        "500 g Kräuter",
        "Zubereitung",
        "1. Auberginen grillen.",
        "2. Eggplant Rolls vegan fuellen und kalt stellen."
      ].join("\n")
    },
    {
      componentLabel: "Schokokuchen vegan",
      category: "vegan" as const,
      recipeName: "Chocolate Cake vegan",
      filename: "internes-rezept-489.pdf",
      sourceRef: "test:dessert-chocolate-cake",
      text: [
        "Chocolate Cake vegan",
        "Zutaten",
        "2 kg Mehl",
        "1 kg Zucker",
        "800 g Kakao",
        "Zubereitung",
        "1. Teig ruehren.",
        "2. Chocolate Cake vegan backen und portionieren."
      ].join("\n")
    },
    {
      componentLabel: "Wildkräutersalat mit Petersilien-Vinaigrette",
      category: "vegan" as const,
      recipeName: "Wild Herb Salad Parsley Vinaigrette vegan",
      filename: "internes-rezept-490.pdf",
      sourceRef: "test:buffet-wild-herb-salad",
      text: [
        "Wild Herb Salad Parsley Vinaigrette vegan",
        "Zutaten",
        "3 kg Wildkräuter",
        "800 g Petersilie",
        "1 l Vinaigrette",
        "Zubereitung",
        "1. Wildkraeuter waschen.",
        "2. Parsley Vinaigrette anruehren.",
        "3. Wild Herb Salad vegan kalt bereitstellen."
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
