import type {
  AcceptedEventSpec,
  MenuComponent,
  Recipe
} from "@catering/shared-core";
import { categoryBoostForText } from "./menu-category-compatibility.js";
import {
  componentSearchTokens,
  dishArchetypeForComponent,
  leadSpecificPrimaryToken,
  primarySearchSegment,
  specificPrimaryFocusTokens,
  webSpecificFocusTokens
} from "./recipe-query-builder.js";
import {
  normalizeComparableText,
  normalizeTokens,
  searchableSpecificTokens,
  tokensRoughlyMatch,
  tokensSpecificallyMatch
} from "./recipe-text-normalization.js";

export function fitScoreForRecipe(
  recipeText: string,
  component: MenuComponent,
  eventSpec: AcceptedEventSpec
): number {
  const recipeTokens = normalizeTokens(recipeText);
  const componentTokens = componentSearchTokens(component);
  const primaryTokens = normalizeTokens(primarySearchSegment(component.label));
  const normalizedRecipeText = recipeText.toLowerCase();
  const normalizedPrimarySegment = primarySearchSegment(component.label).toLowerCase();
  const overlap =
    componentTokens.filter((token) =>
      recipeTokens.some((recipeToken) => tokensRoughlyMatch(token, recipeToken))
    ).length /
    Math.max(componentTokens.length, 1);
  const primaryOverlap =
    primaryTokens.filter((token) =>
      recipeTokens.some((recipeToken) => tokensRoughlyMatch(token, recipeToken))
    ).length /
    Math.max(primaryTokens.length, 1);
  const eventBoost = eventSpec.servicePlan.serviceForm === component.serviceStyle ? 0.1 : 0;
  const categoryBoost = categoryBoostForText(recipeText, component);
  const phraseBoost =
    normalizedPrimarySegment && normalizedRecipeText.includes(normalizedPrimarySegment) ? 0.2 : 0;
  return Math.min(1, Math.max(0, overlap + primaryOverlap * 0.35 + phraseBoost + eventBoost + categoryBoost));
}

export function primaryMatchScore(recipeText: string, component: MenuComponent): number {
  const recipeTokens = normalizeTokens(recipeText);
  const primaryTokens = normalizeTokens(primarySearchSegment(component.label));

  if (primaryTokens.length === 0) {
    return 1;
  }

  return (
    primaryTokens.filter((token) =>
      recipeTokens.some((recipeToken) => tokensRoughlyMatch(token, recipeToken))
    ).length / Math.max(primaryTokens.length, 1)
  );
}

export function specificPrimaryMatchScore(recipeText: string, component: MenuComponent): number {
  const focusTokens = specificPrimaryFocusTokens(component);
  if (focusTokens.length === 0) {
    return 1;
  }

  const recipeTokens = searchableSpecificTokens(recipeText);
  return (
    focusTokens.filter((token) =>
      recipeTokens.some((recipeToken) => tokensSpecificallyMatch(token, recipeToken))
    ).length / Math.max(focusTokens.length, 1)
  );
}

export function webSpecificMatchScore(recipeText: string, component: MenuComponent): number {
  const focusTokens = webSpecificFocusTokens(component);
  if (focusTokens.length === 0) {
    return 1;
  }

  const recipeTokens = [
    ...new Set([...searchableSpecificTokens(recipeText), ...normalizeTokens(recipeText)])
  ];
  return (
    focusTokens.filter((token) =>
      recipeTokens.some((recipeToken) => tokensSpecificallyMatch(token, recipeToken))
    ).length / Math.max(focusTokens.length, 1)
  );
}

export function leadNameMatchScore(recipeName: string, component: MenuComponent): number {
  const leadToken = leadSpecificPrimaryToken(component);
  if (!leadToken) {
    return 0;
  }

  return searchableSpecificTokens(recipeName).some((token) =>
    tokensSpecificallyMatch(leadToken, token)
  )
    ? 1
    : 0;
}

export function candidateFormMismatch(candidateText: string, component: MenuComponent): boolean {
  const normalized = normalizeComparableText(candidateText);
  const query = normalizeComparableText(component.label);
  const archetype = dishArchetypeForComponent(component, "en") ?? dishArchetypeForComponent(component, "de");

  if (/(schokoladenkuchen|kuchen|cake)/.test(query)) {
    if (/\b(lava cake|lava cakes|brownie|brownies|muffin|muffins|cupcake|cupcakes|cookie|cookies)\b/.test(normalized)) {
      return true;
    }
    if (
      /\b(chocolate covered strawberries|strawberry|strawberries|erdbeer|erdbeeren|truffles|mousse|pudding)\b/.test(
        normalized
      ) &&
      !/\b(cake|kuchen|sheet cake|blechkuchen)\b/.test(normalized)
    ) {
      return true;
    }
  }

  if (/(wildkrauter|wildkr[aä]uter|petersilien|vinaigrette)/.test(query)) {
    if (/\b(gemischter salat|mixed salad|garden salad|beilagensalat)\b/.test(normalized)) {
      return true;
    }
  }

  if (archetype === "cake" && !/\b(cake|kuchen|sheet cake|blechkuchen)\b/.test(normalized)) {
    return true;
  }

  return false;
}

export function isStrongRecipeCandidate(recipe: Recipe): boolean {
  return (
    recipe.source.approvalState === "auto_usable" ||
    recipe.source.fitScore >= 0.8 ||
    recipe.source.qualityScore + recipe.source.fitScore >= 1.45
  );
}
