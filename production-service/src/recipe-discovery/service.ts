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

function commonPrefixLength(left: string, right: string): number {
  const max = Math.min(left.length, right.length);
  let index = 0;
  while (index < max && left[index] === right[index]) {
    index += 1;
  }
  return index;
}

function tokensRoughlyMatch(left: string, right: string): boolean {
  if (left === right) {
    return true;
  }

  if (left.length >= 4 && right.length >= 4 && (left.includes(right) || right.includes(left))) {
    return true;
  }

  return commonPrefixLength(left, right) >= 5;
}

function cleanedSearchLabel(label: string): string {
  const segments = label
    .split("|")
    .map((segment) => segment.trim())
    .filter(Boolean);

  const keptSegments = segments.filter((segment) => {
    const normalized = segment.toLowerCase();
    if (/^(de\s*luxe?|de\s*lux|frischged[öo]ns|topping)$/i.test(normalized)) {
      return false;
    }
    return true;
  });

  const merged = keptSegments.length > 0 ? keptSegments.join(" ") : label;
  return merged
    .replace(/[&/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSearchQueries(
  component: MenuComponent,
  eventSpec: AcceptedEventSpec,
  locale: "de" | "en"
): string[] {
  const cleanedLabel = cleanedSearchLabel(component.label);
  const classificationHint =
    component.menuCategory === "vegan"
      ? locale === "de"
        ? "vegan"
        : "vegan"
      : component.menuCategory === "vegetarian"
        ? locale === "de"
          ? "vegetarisch"
          : "vegetarian"
        : "";
  const baseQueries =
    locale === "de"
      ? [
          `${cleanedLabel} ${classificationHint} rezept`,
          `${cleanedLabel} ${classificationHint} rezept ${eventSpec.servicePlan.serviceForm}`,
          `${cleanedLabel} ${classificationHint} ${eventSpec.servicePlan.eventType} rezept`
        ]
      : [
          `${cleanedLabel} ${classificationHint} recipe`,
          `${cleanedLabel} ${classificationHint} recipe ${eventSpec.servicePlan.serviceForm}`,
          `${cleanedLabel} ${classificationHint} catering recipe`
        ];

  return [...new Set(baseQueries.map((query) => query.replace(/\s+/g, " ").trim()))];
}

function fitScoreForRecipe(
  recipeName: string,
  component: MenuComponent,
  eventSpec: AcceptedEventSpec
): number {
  const recipeTokens = normalizeTokens(recipeName);
  const componentTokens = normalizeTokens(component.label);
  const overlap =
    componentTokens.filter((token) =>
      recipeTokens.some((recipeToken) => tokensRoughlyMatch(token, recipeToken))
    ).length /
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
          selectionReason: "Passendes Rezept in der internen Bibliothek gefunden.",
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
    let webSearchFailed = false;

    for (const locale of locales) {
      for (const queryText of buildSearchQueries(component, eventSpec, locale)) {
        const query: RecipeSearchQuery = {
          component,
          eventSpec,
          locale,
          query: queryText
        };

        let searchResults: WebRecipeCandidate[] = [];
        try {
          searchResults = await this.webProvider.searchRecipes(query);
        } catch {
          webSearchFailed = true;
        }

        for (const candidate of searchResults) {
          const qualityScore = qualityScoreForCandidate(candidate);
          const fitScore = fitScoreForRecipe(candidate.title, component, eventSpec);
          if (fitScore < 0.2) {
            continue;
          }
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
      const unresolvedReason = webSearchFailed
        ? `Kein Rezeptkandidat für ${component.label} gefunden, Internetrecherche fehlgeschlagen.`
        : `Kein Rezeptkandidat für ${component.label} gefunden.`;
      return {
        selection: {
          componentId: component.componentId,
          selectionReason: webSearchFailed
            ? "Es konnte kein interner Rezeptkandidat gefunden werden und die Internetrecherche ist fehlgeschlagen."
            : "Es konnte kein interner oder externer Rezeptkandidat validiert werden.",
          autoUsedInternetRecipe: false
        },
        unresolvedItems: [unresolvedReason]
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
            ? "Internet-Ausweichrezept mit ausreichender Qualität automatisch ausgewählt."
            : "Internet-Ausweichrezept ausgewählt, aber zur Prüfung markiert.",
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
