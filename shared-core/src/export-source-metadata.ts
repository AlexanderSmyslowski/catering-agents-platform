import type {
  Recipe,
  RecipeSourceExportMetadata
} from "./types.js";

const MISSING_SOURCE_ORIGIN_LABEL = "Herkunft nicht dokumentiert";
const MISSING_SOURCE_REFERENCE_LABEL = "Referenz nicht dokumentiert";

function compactParts(parts: Array<string | undefined>): string[] {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
}

export function recipeSourceExportMetadataForRecipe(
  recipe: Recipe
): RecipeSourceExportMetadata {
  return {
    recipeId: recipe.recipeId,
    recipeName: recipe.name,
    sourceTier: recipe.source.tier,
    originType: recipe.source.originType,
    approvalState: recipe.source.approvalState,
    reference: recipe.source.reference,
    url: recipe.source.url,
    publisher: recipe.source.publisher
  };
}

export function recipeSourceOriginLabel(
  metadata?: RecipeSourceExportMetadata
): string {
  if (!metadata) {
    return MISSING_SOURCE_ORIGIN_LABEL;
  }

  if (metadata.originType === "web") {
    return metadata.approvalState === "approved_internal"
      ? "web recipe, reviewed"
      : "web recipe, review required";
  }

  if (
    metadata.originType === "internal_db" ||
    metadata.originType === "approved_import"
  ) {
    return metadata.approvalState === "approved_internal"
      ? "internal recipe, approved"
      : "internal recipe, review required";
  }

  if (metadata.originType === "cookbook") {
    return metadata.approvalState === "approved_internal"
      ? "cookbook recipe, approved"
      : "cookbook recipe, review required";
  }

  return MISSING_SOURCE_ORIGIN_LABEL;
}

export function recipeSourceReferenceLabel(
  metadata?: RecipeSourceExportMetadata
): string {
  if (!metadata) {
    return MISSING_SOURCE_REFERENCE_LABEL;
  }

  return compactParts([
    metadata.publisher,
    metadata.url,
    metadata.reference
  ]).join(" | ") || MISSING_SOURCE_REFERENCE_LABEL;
}

export function formatRecipeSourceEvidenceLabel(
  metadata?: RecipeSourceExportMetadata,
  fallbackRecipeId?: string
): string {
  if (!metadata) {
    return `${MISSING_SOURCE_ORIGIN_LABEL}${fallbackRecipeId ? ` (${fallbackRecipeId})` : ""}`;
  }

  return compactParts([
    metadata.recipeName || metadata.recipeId,
    metadata.recipeId,
    recipeSourceOriginLabel(metadata),
    metadata.sourceTier,
    metadata.approvalState,
    metadata.publisher,
    metadata.url,
    metadata.reference
  ]).join(" | ");
}

export function mergeRecipeSourceMetadata(
  left: RecipeSourceExportMetadata[] = [],
  right: RecipeSourceExportMetadata[] = []
): RecipeSourceExportMetadata[] {
  const byKey = new Map<string, RecipeSourceExportMetadata>();

  for (const item of [...left, ...right]) {
    const key = [
      item.recipeId,
      item.originType,
      item.reference,
      item.url ?? "",
      item.publisher ?? ""
    ].join("|");
    byKey.set(key, item);
  }

  return [...byKey.values()];
}
