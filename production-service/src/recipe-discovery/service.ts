import type {
  AcceptedEventSpec,
  BusinessContext,
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
    component: MenuComponent,
    context: BusinessContext = { businessId: "local" }
  ): Promise<RecipeResolution> {
    const recipe = await this.repository.get(context, recipeId);
    if (!recipe) {
      return buildMissingOverrideRecipeResolution({ recipeId, component });
    }

    return buildOverrideRecipeResolution({ recipe, component });
  }

  async resolveRecipe(
    component: MenuComponent,
    eventSpec: AcceptedEventSpec,
    options: {
      context?: BusinessContext;
      persistWebWinner?: boolean;
    } = {}
  ): Promise<RecipeResolution> {
    const context = options.context ?? { businessId: "local" };
    const searchTrace = createRecipeSearchTrace();
    const repositoryCandidates = await this.repository.findCandidates(context, component);
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
      repository: { save: (recipe) => this.repository.save(context, recipe) },
      persistWinner: options.persistWebWinner !== false,
      searchTrace
    });
  }
}
