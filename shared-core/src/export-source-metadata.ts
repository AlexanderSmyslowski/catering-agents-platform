import type {
  Recipe,
  RecipeSourceExportMetadata
} from "./types.js";

function compactParts(parts: Array<string | undefined>): string[] {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
}

const UNKNOWN_SOURCE_LABEL = "Quelle offen";

function recipeSourceTierLabel(tier?: string): string | undefined {
  if (tier === "internal_verified") {
    return "intern verifiziert";
  }
  if (tier === "digitized_cookbook") {
    return "digitalisiertes Kochbuch";
  }
  if (tier === "internal_approved") {
    return "intern freigegeben";
  }
  if (tier === "internet_fallback") {
    return "Internet-Ausweichquelle";
  }
  return tier;
}

function recipeApprovalStateLabel(approvalState?: string): string | undefined {
  if (approvalState === "approved_internal") {
    return "intern freigegeben";
  }
  if (approvalState === "auto_usable") {
    return "automatisch nutzbar";
  }
  if (approvalState === "review_required") {
    return "Prüfung nötig";
  }
  return approvalState;
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
    return UNKNOWN_SOURCE_LABEL;
  }

  if (metadata.originType === "web") {
    return metadata.approvalState === "approved_internal"
      ? "Web-Rezept geprüft"
      : "Web-Rezept Prüfung nötig";
  }

  if (
    metadata.originType === "internal_db" ||
    metadata.originType === "approved_import"
  ) {
    return metadata.approvalState === "approved_internal"
      ? "Internes Rezept freigegeben"
      : "Internes Rezept Prüfung nötig";
  }

  if (metadata.originType === "cookbook") {
    return metadata.approvalState === "approved_internal"
      ? "Kochbuchrezept freigegeben"
      : "Kochbuchrezept Prüfung nötig";
  }

  return UNKNOWN_SOURCE_LABEL;
}

export function recipeSourceReferenceLabel(
  metadata?: RecipeSourceExportMetadata
): string {
  if (!metadata) {
    return UNKNOWN_SOURCE_LABEL;
  }

  return compactParts([
    metadata.publisher,
    metadata.url,
    metadata.reference
  ]).join(" | ") || UNKNOWN_SOURCE_LABEL;
}

export function formatRecipeSourceEvidenceLabel(
  metadata?: RecipeSourceExportMetadata,
  fallbackRecipeId?: string
): string {
  if (!metadata) {
    return `${UNKNOWN_SOURCE_LABEL}${fallbackRecipeId ? ` (${fallbackRecipeId})` : ""}`;
  }

  return compactParts([
    metadata.recipeName || metadata.recipeId,
    metadata.recipeId,
    recipeSourceOriginLabel(metadata),
    recipeSourceTierLabel(metadata.sourceTier),
    recipeApprovalStateLabel(metadata.approvalState),
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
