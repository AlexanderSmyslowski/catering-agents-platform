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
import {
  candidateSupportsMenuCategory,
  evaluateMenuCategoryCompatibility,
  recipeSupportsMenuCategory
} from "./menu-category-compatibility.js";
import { candidateToRecipe, type WebRecipeSearchProvider } from "./provider.js";
import {
  candidateRecipeText,
  extractionCompletenessForCandidate,
  isCollectionLikeCandidate,
  qualityScoreForCandidate
} from "./web-candidate-quality.js";
import {
  buildSearchQueries,
  recipeSearchText
} from "./recipe-query-builder.js";
import {
  candidateFormMismatch,
  fitScoreForRecipe,
  isStrongRecipeCandidate,
  leadNameMatchScore,
  primaryMatchScore,
  specificPrimaryMatchScore,
  webSpecificMatchScore
} from "./recipe-candidate-scoring.js";

const tierWeight: Record<Recipe["source"]["tier"], number> = {
  internal_verified: 4,
  digitized_cookbook: 3,
  internal_approved: 2,
  internet_fallback: 1
};

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
    component: MenuComponent
  ): Promise<RecipeResolution> {
    const recipe = await this.repository.get(recipeId);
    if (!recipe) {
      return {
        selection: {
          componentId: component.componentId,
          selectionReason: `Das manuell hinterlegte Rezept ${recipeId} wurde in der Bibliothek nicht gefunden.`,
          searchTrace: [`Manuelle Rezeptzuweisung: ${recipeId}`, "Bibliothekstreffer: nicht gefunden."],
          autoUsedInternetRecipe: false
        },
        unresolvedItems: [`Rezeptzuweisung ${recipeId} für ${component.label} ist ungültig.`]
      };
    }

    return {
      recipe,
      selection: {
        componentId: component.componentId,
        recipeId: recipe.recipeId,
        selectionReason: "Rezept wurde manuell aus der Bibliothek zugewiesen.",
        searchTrace: [`Manuelle Rezeptzuweisung: ${recipe.name} (${recipe.recipeId}).`],
        autoUsedInternetRecipe: false,
        sourceTier: recipe.source.tier,
        qualityScore: recipe.source.qualityScore,
        fitScore: recipe.source.fitScore
      },
      unresolvedItems: []
    };
  }

  async resolveRecipe(
    component: MenuComponent,
    eventSpec: AcceptedEventSpec
  ): Promise<RecipeResolution> {
    const searchTrace: string[] = [];
    const pushTrace = (message: string) => {
      if (searchTrace.length < 12) {
        searchTrace.push(message);
      }
    };
    const repositoryCandidates = await this.repository.findCandidates(component);
    const internalCandidates = repositoryCandidates
      .filter((recipe) => recipeSupportsMenuCategory(recipe, component))
      .map((recipe, index) => ({
        recipe,
        repositoryRank: index,
        fitScore: fitScoreForRecipe(recipeSearchText(recipe), component, eventSpec),
        primaryScore: primaryMatchScore(recipeSearchText(recipe), component),
        specificPrimaryScore: specificPrimaryMatchScore(recipeSearchText(recipe), component),
        leadNameScore: leadNameMatchScore(recipe.name, component)
      }))
      .filter(
        (candidate) =>
          (candidate.fitScore >= 0.75 ||
            (candidate.repositoryRank === 0 &&
              candidate.leadNameScore === 1 &&
              candidate.fitScore >= 0.55)) &&
          (candidate.primaryScore >= 0.5 || candidate.leadNameScore === 1) &&
          (candidate.specificPrimaryScore >= 0.34 || candidate.leadNameScore === 1)
      )
      .sort((left, right) => {
        const tierDifference =
          tierWeight[right.recipe.source.tier] - tierWeight[left.recipe.source.tier];
        if (tierDifference !== 0) {
          return tierDifference;
        }

        const rankDifference = left.repositoryRank - right.repositoryRank;
        if (rankDifference !== 0) {
          return rankDifference;
        }

        const leftScore =
          left.fitScore + left.specificPrimaryScore * 0.5 + left.leadNameScore * 0.35;
        const rightScore =
          right.fitScore + right.specificPrimaryScore * 0.5 + right.leadNameScore * 0.35;
        return rightScore - leftScore;
      });

    if (repositoryCandidates.length > 0) {
      pushTrace(
        `Interne Kandidaten: ${repositoryCandidates
          .slice(0, 3)
          .map((recipe) => recipe.name)
          .join(", ")}`
      );
    } else {
      pushTrace("Interne Kandidaten: keine Treffer.");
    }

    const internalWinner = internalCandidates[0];
    if (internalWinner?.recipe) {
      pushTrace(`Interner Treffer gewählt: ${internalWinner.recipe.name}.`);
      return {
        recipe: internalWinner.recipe,
        selection: {
          componentId: component.componentId,
          recipeId: internalWinner.recipe.recipeId,
          selectionReason: "Passendes Rezept in der internen Bibliothek gefunden.",
          autoUsedInternetRecipe: false,
          searchTrace,
          sourceTier: internalWinner.recipe.source.tier,
          qualityScore: internalWinner.recipe.source.qualityScore,
          fitScore: internalWinner.fitScore
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
          pushTrace(`Websuche: ${query.query}`);
          searchResults = await this.webProvider.searchRecipes(query);
        } catch {
          webSearchFailed = true;
          pushTrace(`Websuche fehlgeschlagen: ${query.query}`);
        }

        for (const candidate of searchResults) {
          if (!candidateSupportsMenuCategory(candidate, component)) {
            pushTrace(`Verworfen: ${candidate.title} (Kategorie passt nicht).`);
            continue;
          }

          if (
            isCollectionLikeCandidate(candidate) &&
            (candidate.qualitySignals.stepCount < 4 || candidate.qualitySignals.ingredientCount < 6)
          ) {
            pushTrace(`Verworfen: ${candidate.title} (Sammlungs-/Übersichtsseite).`);
            continue;
          }

          const qualityScore = qualityScoreForCandidate(candidate);
          const compatibility = evaluateMenuCategoryCompatibility(candidate, component);
          const fitScore = fitScoreForRecipe(candidateRecipeText(candidate), component, eventSpec);
          const specificFitScore = webSpecificMatchScore(candidateRecipeText(candidate), component);
          if (fitScore < 0.2) {
            pushTrace(`Verworfen: ${candidate.title} (zu geringe Textpassung).`);
            continue;
          }
          if (specificFitScore === 0) {
            pushTrace(`Verworfen: ${candidate.title} (keine Fachbegriffe des Gerichts getroffen).`);
            continue;
          }
          if (candidateFormMismatch(candidateRecipeText(candidate), component)) {
            pushTrace(`Verworfen: ${candidate.title} (falsches Rezeptformat).`);
            continue;
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

          if (materialized) {
            try {
              candidates.push({
                recipe: validateRecipe(materialized),
                query
              });
            } catch {
              continue;
            }
          }
        }

        if (candidates.some((candidate) => isStrongRecipeCandidate(candidate.recipe))) {
          break;
        }
      }

      if (candidates.some((candidate) => isStrongRecipeCandidate(candidate.recipe))) {
        break;
      }
    }

    const winner = candidates.sort((left, right) => {
      const leftScore = left.recipe.source.qualityScore * 1.4 + left.recipe.source.fitScore;
      const rightScore = right.recipe.source.qualityScore * 1.4 + right.recipe.source.fitScore;
      return rightScore - leftScore;
    })[0];

    if (!winner) {
      const categoryHint =
        component.menuCategory === "vegan"
          ? "veganer "
          : component.menuCategory === "vegetarian"
            ? "vegetarischer "
            : "";
      const unresolvedReason = webSearchFailed
        ? `Kein ${categoryHint}Rezeptkandidat für ${component.label} gefunden, Internetrecherche fehlgeschlagen.`
        : `Kein ${categoryHint}Rezeptkandidat für ${component.label} gefunden.`;
      return {
        selection: {
          componentId: component.componentId,
          selectionReason: webSearchFailed
            ? "Es konnte kein interner Rezeptkandidat gefunden werden und die Internetrecherche ist fehlgeschlagen."
            : component.menuCategory === "vegan"
              ? "Es konnte kein interner oder externer veganer Rezeptkandidat belastbar validiert werden."
              : component.menuCategory === "vegetarian"
                ? "Es konnte kein interner oder externer vegetarischer Rezeptkandidat belastbar validiert werden."
                : "Es konnte kein interner oder externer Rezeptkandidat belastbar validiert werden.",
          searchTrace,
          autoUsedInternetRecipe: false
        },
        unresolvedItems: [unresolvedReason]
      };
    }

    await this.repository.save(winner.recipe);
    pushTrace(`Webtreffer gewählt: ${winner.recipe.name}.`);

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
        searchTrace,
        autoUsedInternetRecipe: winner.recipe.source.approvalState === "auto_usable",
        sourceTier: winner.recipe.source.tier,
        qualityScore: winner.recipe.source.qualityScore,
        fitScore: winner.recipe.source.fitScore
      },
      unresolvedItems
    };
  }
}
