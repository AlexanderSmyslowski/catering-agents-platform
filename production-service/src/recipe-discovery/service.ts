import {
  assertBusinessId,
  type AcceptedEventSpec,
  type BusinessContext,
  type MenuComponent,
  type RecipeSelection,
  type Recipe
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
    context: BusinessContext
  ): Promise<RecipeResolution> {
    const scopedContext = requireBusinessContext(context);
    const recipe = await this.repository.get(scopedContext, recipeId);
    if (!recipe) {
      return buildMissingOverrideRecipeResolution({ recipeId, component });
    }

    return buildOverrideRecipeResolution({ recipe, component });
  }

  async resolveRecipe(
    component: MenuComponent,
    eventSpec: AcceptedEventSpec,
    options: {
      context: BusinessContext;
      persistWebWinner?: boolean;
    }
  ): Promise<RecipeResolution> {
    const context = requireBusinessContext(options?.context);
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

function requireBusinessContext(context: BusinessContext | undefined): BusinessContext {
  if (!context) throw new Error("Ein Betriebskontext ist erforderlich.");
  assertBusinessId(context.businessId);
  return context;
}
