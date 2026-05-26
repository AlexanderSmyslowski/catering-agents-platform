export type RecipeSuggestion = {
  recipeId: string;
  name: string;
};

const NON_RECIPE_SUGGESTION_TOKENS = new Set(["vegan", "classic", "klassisch", "vegetarian", "vegetarisch", "topping"]);

function normalizeRecipeSuggestionText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase();
}

export function recipeSuggestionsForComponent(
  label: string,
  recipes: Array<Record<string, unknown>>
): RecipeSuggestion[] {
  const tokens = normalizeRecipeSuggestionText(label)
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length >= 4)
    .filter((token) => !NON_RECIPE_SUGGESTION_TOKENS.has(token));

  return recipes
    .map((recipe) => {
      const recipeId = String(recipe.recipeId ?? "");
      const name = String(recipe.name ?? recipeId);
      const haystack = normalizeRecipeSuggestionText(
        `${name} ${String((recipe.source as Record<string, unknown> | undefined)?.reference ?? "")}`
      );
      const score = tokens.filter((token) => haystack.includes(token)).length;
      return {
        recipeId,
        name,
        score
      };
    })
    .filter((item) => item.recipeId && item.score > 0)
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, "de"))
    .slice(0, 6)
    .map(({ recipeId, name }) => ({ recipeId, name }));
}

export function resolveRecipeNameById(recipeId: string, recipes: Array<Record<string, unknown>>): string | undefined {
  const match = recipes.find((recipe) => String(recipe.recipeId ?? "") === recipeId);
  if (!match) {
    return undefined;
  }

  const recipeName = String(match.name ?? "").trim();
  return recipeName || recipeId;
}

export function buildRecipeOptionsForComponent({
  componentLabel,
  recipes,
  selectedRecipeId
}: {
  componentLabel: string;
  recipes: Array<Record<string, unknown>>;
  selectedRecipeId?: string;
}): RecipeSuggestion[] {
  const recipeOptions = [...recipeSuggestionsForComponent(componentLabel, recipes)];

  if (selectedRecipeId && !recipeOptions.some((item) => item.recipeId === selectedRecipeId)) {
    recipeOptions.unshift({
      recipeId: selectedRecipeId,
      name: resolveRecipeNameById(selectedRecipeId, recipes) ?? `Rezept ${selectedRecipeId}`
    });
  }

  return recipeOptions;
}
