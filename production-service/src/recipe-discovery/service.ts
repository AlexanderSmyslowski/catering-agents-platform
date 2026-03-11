import type {
  AcceptedEventSpec,
  MenuComponent,
  Recipe,
  RecipeSearchQuery,
  RecipeSelection,
  WebRecipeCandidate
} from "@catering/shared-core";
import { validateRecipe } from "@catering/shared-core";
import { InMemoryRecipeRepository } from "../repositories/in-memory-recipe-repository.js";
import { candidateToRecipe, type WebRecipeSearchProvider } from "./provider.js";

const tierWeight: Record<Recipe["source"]["tier"], number> = {
  internal_verified: 4,
  digitized_cookbook: 3,
  internal_approved: 2,
  internet_fallback: 1
};

function normalizeTokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9äöüß]+/i)
    .filter(Boolean);
}

function fitScoreForRecipe(
  recipeName: string,
  component: MenuComponent,
  eventSpec: AcceptedEventSpec
): number {
  const recipeTokens = new Set(normalizeTokens(recipeName));
  const componentTokens = normalizeTokens(component.label);
  const overlap =
    componentTokens.filter((token) => recipeTokens.has(token)).length /
    Math.max(componentTokens.length, 1);
  const eventBoost = eventSpec.servicePlan.serviceForm === component.serviceStyle ? 0.1 : 0;
  return Math.min(1, overlap + eventBoost);
}

function qualityScoreForCandidate(candidate: WebRecipeCandidate): number {
  const signals = candidate.qualitySignals;
  const structured = signals.structuredData ? 0.3 : 0.1;
  const yieldScore = signals.hasYield ? 0.2 : 0;
  const ingredientScore = Math.min(0.2, signals.ingredientCount / 20);
  const stepScore = Math.min(0.2, signals.stepCount / 10);
  const mappingScore = signals.mappedIngredientRatio * 0.1;
  return Number((structured + yieldScore + ingredientScore + stepScore + mappingScore).toFixed(2));
}

function extractionCompletenessForCandidate(candidate: WebRecipeCandidate): number {
  const signals = candidate.qualitySignals;
  const coverage =
    (signals.hasYield ? 0.3 : 0) +
    Math.min(0.35, signals.ingredientCount / 20) +
    Math.min(0.25, signals.stepCount / 10) +
    Math.min(0.1, signals.mappedIngredientRatio);
  return Number(coverage.toFixed(2));
}

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

  async resolveRecipe(
    component: MenuComponent,
    eventSpec: AcceptedEventSpec
  ): Promise<RecipeResolution> {
    const internalCandidates = (await this.repository.findCandidates(component)).sort(
      (left, right) => {
        const leftScore =
          tierWeight[left.source.tier] +
          fitScoreForRecipe(left.name, component, eventSpec);
        const rightScore =
          tierWeight[right.source.tier] +
          fitScoreForRecipe(right.name, component, eventSpec);
        return rightScore - leftScore;
      }
    );

    const internalWinner = internalCandidates[0];
    if (internalWinner) {
      return {
        recipe: internalWinner,
        selection: {
          componentId: component.componentId,
          recipeId: internalWinner.recipeId,
          selectionReason: "Matched internal recipe repository.",
          autoUsedInternetRecipe: false,
          sourceTier: internalWinner.source.tier,
          qualityScore: internalWinner.source.qualityScore,
          fitScore: fitScoreForRecipe(internalWinner.name, component, eventSpec)
        },
        unresolvedItems: []
      };
    }

    const locales: ("de" | "en")[] = ["de", "en"];
    const candidates: {
      recipe: Recipe;
      query: RecipeSearchQuery;
    }[] = [];

    for (const locale of locales) {
      const query: RecipeSearchQuery = {
        component,
        eventSpec,
        locale,
        query:
          locale === "de"
            ? `${component.label} rezept ${eventSpec.servicePlan.serviceForm} ${eventSpec.servicePlan.eventType}`
            : `${component.label} recipe ${eventSpec.servicePlan.serviceForm} catering`
      };

      const searchResults = await this.webProvider.searchRecipes(query);
      for (const candidate of searchResults) {
        const qualityScore = qualityScoreForCandidate(candidate);
        const fitScore = fitScoreForRecipe(candidate.title, component, eventSpec);
        const extractionCompleteness = extractionCompletenessForCandidate(candidate);
        const autoUsable =
          qualityScore >= 0.75 &&
          fitScore >= 0.8 &&
          extractionCompleteness >= 0.9 &&
          candidate.qualitySignals.hasYield &&
          candidate.qualitySignals.mappedIngredientRatio >= 0.9;

        const materialized = candidateToRecipe(candidate, component, eventSpec, locale, {
          qualityScore,
          fitScore,
          extractionCompleteness,
          autoUsable
        });

        if (materialized) {
          candidates.push({
            recipe: validateRecipe(materialized),
            query
          });
        }
      }

      if (candidates.length > 0) {
        break;
      }
    }

    const winner = candidates.sort((left, right) => {
      const leftScore = left.recipe.source.qualityScore + left.recipe.source.fitScore;
      const rightScore = right.recipe.source.qualityScore + right.recipe.source.fitScore;
      return rightScore - leftScore;
    })[0];

    if (!winner) {
      return {
        selection: {
          componentId: component.componentId,
          selectionReason: "Es konnte kein interner oder externer Rezeptkandidat validiert werden.",
          autoUsedInternetRecipe: false
        },
        unresolvedItems: [`Kein Rezeptkandidat fuer ${component.label} gefunden.`]
      };
    }

    await this.repository.save(winner.recipe);

    const unresolvedItems =
      winner.recipe.source.approvalState === "review_required"
        ? [`Rezept ${winner.recipe.name} muss vor der finalen Produktion manuell geprueft werden.`]
        : [];

    return {
      recipe: winner.recipe,
      selection: {
        componentId: component.componentId,
        recipeId: winner.recipe.recipeId,
        selectionReason:
          winner.recipe.source.approvalState === "auto_usable"
            ? "Internet-Fallback-Rezept mit ausreichender Qualitaet automatisch ausgewaehlt."
            : "Internet-Fallback-Rezept ausgewaehlt, aber zur Pruefung markiert.",
        searchQuery: winner.query.query,
        autoUsedInternetRecipe: winner.recipe.source.approvalState === "auto_usable",
        sourceTier: winner.recipe.source.tier,
        qualityScore: winner.recipe.source.qualityScore,
        fitScore: winner.recipe.source.fitScore
      },
      unresolvedItems
    };
  }
}
