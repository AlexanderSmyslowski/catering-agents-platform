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
  evaluateMenuCategoryCompatibility
} from "./menu-category-compatibility.js";
import { candidateToRecipe, type WebRecipeSearchProvider } from "./provider.js";
import {
  candidateRecipeText,
  extractionCompletenessForCandidate,
  isCollectionLikeCandidate,
  qualityScoreForCandidate
} from "./web-candidate-quality.js";
import { buildSearchQueries } from "./recipe-query-builder.js";
import {
  candidateFormMismatch,
  fitScoreForRecipe,
  isStrongRecipeCandidate,
  webSpecificMatchScore
} from "./recipe-candidate-scoring.js";
import { selectInternalRecipeCandidate } from "./internal-recipe-selection.js";
import { createRecipeSearchTrace } from "./recipe-search-trace.js";
import { selectWebRecipeCandidate } from "./web-recipe-selection.js";

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
    const searchTrace = createRecipeSearchTrace();
    const repositoryCandidates = await this.repository.findCandidates(component);
    const internalWinner = selectInternalRecipeCandidate(repositoryCandidates, component, eventSpec);

    if (repositoryCandidates.length > 0) {
      searchTrace.push(
        `Interne Kandidaten: ${repositoryCandidates
          .slice(0, 3)
          .map((recipe) => recipe.name)
          .join(", ")}`
      );
    } else {
      searchTrace.push("Interne Kandidaten: keine Treffer.");
    }

    if (internalWinner?.recipe) {
      searchTrace.push(`Interner Treffer gewählt: ${internalWinner.recipe.name}.`);
      return {
        recipe: internalWinner.recipe,
        selection: {
          componentId: component.componentId,
          recipeId: internalWinner.recipe.recipeId,
          selectionReason: "Passendes Rezept in der internen Bibliothek gefunden.",
          autoUsedInternetRecipe: false,
          searchTrace: searchTrace.entries,
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
          searchTrace.push(`Websuche: ${query.query}`);
          searchResults = await this.webProvider.searchRecipes(query);
        } catch {
          webSearchFailed = true;
          searchTrace.push(`Websuche fehlgeschlagen: ${query.query}`);
        }

        for (const candidate of searchResults) {
          if (!candidateSupportsMenuCategory(candidate, component)) {
            searchTrace.push(`Verworfen: ${candidate.title} (Kategorie passt nicht).`);
            continue;
          }

          if (
            isCollectionLikeCandidate(candidate) &&
            (candidate.qualitySignals.stepCount < 4 || candidate.qualitySignals.ingredientCount < 6)
          ) {
            searchTrace.push(`Verworfen: ${candidate.title} (Sammlungs-/Übersichtsseite).`);
            continue;
          }

          const qualityScore = qualityScoreForCandidate(candidate);
          const compatibility = evaluateMenuCategoryCompatibility(candidate, component);
          const fitScore = fitScoreForRecipe(candidateRecipeText(candidate), component, eventSpec);
          const specificFitScore = webSpecificMatchScore(candidateRecipeText(candidate), component);
          if (fitScore < 0.2) {
            searchTrace.push(`Verworfen: ${candidate.title} (zu geringe Textpassung).`);
            continue;
          }
          if (specificFitScore === 0) {
            searchTrace.push(`Verworfen: ${candidate.title} (keine Fachbegriffe des Gerichts getroffen).`);
            continue;
          }
          if (candidateFormMismatch(candidateRecipeText(candidate), component)) {
            searchTrace.push(`Verworfen: ${candidate.title} (falsches Rezeptformat).`);
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

    const winner = selectWebRecipeCandidate(candidates);

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
          searchTrace: searchTrace.entries,
          autoUsedInternetRecipe: false
        },
        unresolvedItems: [unresolvedReason]
      };
    }

    await this.repository.save(winner.recipe);
    searchTrace.push(`Webtreffer gewählt: ${winner.recipe.name}.`);

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
        searchTrace: searchTrace.entries,
        autoUsedInternetRecipe: winner.recipe.source.approvalState === "auto_usable",
        sourceTier: winner.recipe.source.tier,
        qualityScore: winner.recipe.source.qualityScore,
        fitScore: winner.recipe.source.fitScore
      },
      unresolvedItems
    };
  }
}
