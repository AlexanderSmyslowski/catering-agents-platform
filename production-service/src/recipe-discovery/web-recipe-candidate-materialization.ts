import type {
  AcceptedEventSpec,
  MenuComponent,
  Recipe,
  RecipeSearchQuery,
  WebRecipeCandidate
} from "@catering/shared-core";
import { validateRecipe } from "@catering/shared-core";
import {
  candidateSupportsMenuCategory,
  evaluateMenuCategoryCompatibility
} from "./menu-category-compatibility.js";
import { candidateToRecipe } from "./provider.js";
import {
  candidateRecipeText,
  extractionCompletenessForCandidate,
  isCollectionLikeCandidate,
  qualityScoreForCandidate
} from "./web-candidate-quality.js";
import {
  candidateFormMismatch,
  fitScoreForRecipe,
  webSpecificMatchScore
} from "./recipe-candidate-scoring.js";

export type MaterializedWebRecipeCandidate = {
  recipe: Recipe;
  query: RecipeSearchQuery;
};

export type WebRecipeCandidateMaterialization = {
  candidate?: MaterializedWebRecipeCandidate;
  traceMessage?: string;
};

export function materializeWebRecipeCandidate(input: {
  candidate: WebRecipeCandidate;
  component: MenuComponent;
  eventSpec: AcceptedEventSpec;
  locale: "de" | "en";
  query: RecipeSearchQuery;
}): WebRecipeCandidateMaterialization {
  const {
    candidate,
    component,
    eventSpec,
    locale,
    query
  } = input;

  if (!candidateSupportsMenuCategory(candidate, component)) {
    return { traceMessage: `Verworfen: ${candidate.title} (Kategorie passt nicht).` };
  }

  if (
    isCollectionLikeCandidate(candidate) &&
    (candidate.qualitySignals.stepCount < 4 || candidate.qualitySignals.ingredientCount < 6)
  ) {
    return { traceMessage: `Verworfen: ${candidate.title} (Sammlungs-/Übersichtsseite).` };
  }

  const candidateText = candidateRecipeText(candidate);
  const qualityScore = qualityScoreForCandidate(candidate);
  const compatibility = evaluateMenuCategoryCompatibility(candidate, component);
  const fitScore = fitScoreForRecipe(candidateText, component, eventSpec);
  const specificFitScore = webSpecificMatchScore(candidateText, component);

  if (fitScore < 0.2) {
    return { traceMessage: `Verworfen: ${candidate.title} (zu geringe Textpassung).` };
  }

  if (specificFitScore === 0) {
    return { traceMessage: `Verworfen: ${candidate.title} (keine Fachbegriffe des Gerichts getroffen).` };
  }

  if (candidateFormMismatch(candidateText, component)) {
    return { traceMessage: `Verworfen: ${candidate.title} (falsches Rezeptformat).` };
  }

  const extractionCompleteness = extractionCompletenessForCandidate(candidate);
  const autoUsable =
    qualityScore >= 0.75 &&
    fitScore >= (compatibility.confidence === "explicit" ? 0.72 : 0.8) &&
    extractionCompleteness >= 0.9 &&
    candidate.qualitySignals.hasYield &&
    candidate.qualitySignals.mappedIngredientRatio >= 0.85;

  const materialized = candidateToRecipe(candidate, component, eventSpec, locale, {
    qualityScore,
    fitScore,
    extractionCompleteness,
    autoUsable,
    inferredDietTags: compatibility.inferredDietTags
  });

  if (!materialized) {
    return {};
  }

  try {
    return {
      candidate: {
        recipe: validateRecipe(materialized),
        query
      }
    };
  } catch {
    return {};
  }
}
