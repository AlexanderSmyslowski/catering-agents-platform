import type {
  AcceptedEventSpec,
  MenuComponent,
  RecipeSelection,
  Recipe
} from "@catering/shared-core";
import { InMemoryRecipeRepository } from "../repositories/in-memory-recipe-repository.js";
import { type WebRecipeSearchProvider } from "./provider.js";
import {
  buildMissingOverrideRecipeResolution,
  buildOverrideRecipeResolution
} from "./override-recipe-resolution.js";
import { createRecipeSearchTrace } from "./recipe-search-trace.js";
import { resolveInternalRecipeCandidate } from "./internal-recipe-candidate-resolution.js";
import { resolveWebRecipeCandidate } from "./web-recipe-candidate-resolution.js";

export interface RecipeResolution {
  recipe?: Recipe;
  selection: RecipeSelection;
  unresolvedItems: string[];
}

export class RecipeDiscoveryService {
  constructor(
    private readonly repository: InMemoryRecipeRepository,
    private readonly webProvider: WebRecipeSearchProvider
  ) {}

  async resolveRecipeOverride(
    recipeId: string,
    component: MenuComponent
  ): Promise<RecipeResolution> {
    const recipe = await this.repository.get(recipeId);
    if (!recipe) {
      return buildMissingOverrideRecipeResolution({ recipeId, component });
    }

    return buildOverrideRecipeResolution({ recipe, component });
  }

  async resolveRecipe(
    component: MenuComponent,
    eventSpec: AcceptedEventSpec
  ): Promise<RecipeResolution> {
    const searchTrace = createRecipeSearchTrace();
    const repositoryCandidates = await this.findInternalCandidates(component);
    const internalResolution = resolveInternalRecipeCandidate({
      repositoryCandidates,
      component,
      eventSpec,
      searchTrace
    });

    if (internalResolution) {
      return internalResolution;
    }

    return resolveWebRecipeCandidate({
      component,
      eventSpec,
      webProvider: this.webProvider,
      repository: this.repository,
      searchTrace
    });
  }

  private async findInternalCandidates(component: MenuComponent): Promise<Recipe[]> {
    const candidates = await this.repository.findCandidates(component);
    if (candidates.length > 0) {
      return candidates;
    }

    const tarteFallbackLabel = component.label
      .replace(/\btarte\b/gi, " ")
      .replace(/[-–—|]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!/\btarte\b/i.test(component.label) || !tarteFallbackLabel || tarteFallbackLabel === component.label) {
      return candidates;
    }

    return this.repository.findCandidates({ label: tarteFallbackLabel });
  }
}
