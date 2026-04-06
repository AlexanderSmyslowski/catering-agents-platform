import type { WebRecipeSearchProvider } from "./provider.js";
import { DuckDuckGoRecipeSearchProvider } from "./duckduckgo-provider.js";

export type RecipeWebSearchProviderName = "duckduckgo" | "disabled";

export class DisabledRecipeSearchProvider implements WebRecipeSearchProvider {
  async searchRecipes(): Promise<[]> {
    return [];
  }
}

export function resolveRecipeWebSearchProviderName(
  value?: string
): RecipeWebSearchProviderName {
  if (value === "disabled") {
    return "disabled";
  }

  return "duckduckgo";
}

export function createRecipeWebSearchProvider(
  providerName?: string
): {
  providerName: RecipeWebSearchProviderName;
  provider: WebRecipeSearchProvider;
} {
  const resolvedName = resolveRecipeWebSearchProviderName(providerName);

  if (resolvedName === "disabled") {
    return {
      providerName: resolvedName,
      provider: new DisabledRecipeSearchProvider()
    };
  }

  return {
    providerName: resolvedName,
    provider: new DuckDuckGoRecipeSearchProvider()
  };
}
