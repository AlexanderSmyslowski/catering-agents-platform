import type { MenuComponent, Recipe } from "@catering/shared-core";
import { internalRecipes, validateRecipe } from "@catering/shared-core";

function normalize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9äöüß]+/i)
    .filter(Boolean);
}

function overlapScore(left: string, right: string): number {
  const leftTokens = new Set(normalize(left));
  const rightTokens = new Set(normalize(right));
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return overlap === 0 ? 0 : overlap / Math.max(leftTokens.size, rightTokens.size);
}

export class InMemoryRecipeRepository {
  private readonly recipes = new Map<string, Recipe>();

  constructor(seed: Recipe[] = internalRecipes) {
    for (const recipe of seed) {
      this.recipes.set(recipe.recipeId, validateRecipe(recipe));
    }
  }

  findCandidates(component: MenuComponent): Recipe[] {
    return [...this.recipes.values()]
      .map((recipe) => ({
        recipe,
        score: overlapScore(component.label, recipe.name)
      }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .map((item) => item.recipe);
  }

  save(recipe: Recipe): void {
    this.recipes.set(recipe.recipeId, validateRecipe(recipe));
  }

  list(): Recipe[] {
    return [...this.recipes.values()];
  }
}

