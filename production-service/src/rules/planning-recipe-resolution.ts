import type { ProductionPlan } from "@catering/shared-core";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export type NormalizedRecipeResolution = {
  recipe?: unknown;
  selection: ProductionPlan["recipeSelections"][number];
  unresolvedItems: string[];
};

export function normalizeRecipeResolution(
  resolution: unknown,
  componentLabel: string
): NormalizedRecipeResolution {
  if (!isPlainObject(resolution)) {
    throw new Error(`Ungültige Planungsantwort für ${componentLabel}.`);
  }

  const { recipe, selection, unresolvedItems } = resolution as {
    recipe?: unknown;
    selection?: unknown;
    unresolvedItems?: unknown;
  };

  if (
    !isPlainObject(selection) ||
    typeof selection.componentId !== "string" ||
    typeof selection.selectionReason !== "string" ||
    typeof selection.autoUsedInternetRecipe !== "boolean" ||
    !Array.isArray(unresolvedItems) ||
    unresolvedItems.some((issue) => typeof issue !== "string")
  ) {
    throw new Error(`Ungültige Planungsantwort für ${componentLabel}.`);
  }

  return {
    recipe,
    selection: selection as unknown as ProductionPlan["recipeSelections"][number],
    unresolvedItems: unresolvedItems as string[]
  };
}
