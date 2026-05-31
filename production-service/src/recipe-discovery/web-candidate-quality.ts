import type { WebRecipeCandidate } from "@catering/shared-core";

const trustedRecipeHosts = [
  "chefkoch.de",
  "allrecipes.com",
  "noracooks.com",
  "thebigmansworld.com",
  "itdoesnttastelikechicken.com",
  "biancazapatka.com",
  "lovingitvegan.com",
  "rainbowplantlife.com",
  "simplyrecipes.com",
  "spendwithpennies.com",
  "einfachkochen.de",
  "essen-und-trinken.de",
  "emmikochteinfach.de",
  "eat.de",
  "lecker.de",
  "veggie-einhorn.de",
  "kraeuter-buch.de",
  "kochideenzeit.de",
  "omasrezepte.de",
  "ndr.de",
  "gutekueche.at"
];

const collectionLikeRecipePattern =
  /\b(top\s*\d+|\d+\s+(extra\s+schnelle|schnelle|beste|best|easy|einfache?)\s+(kuchen|recipes?|desserts?|salate)|ideen|ideas|sammlung|collection|best of|die leckersten|die besten)\b/i;

function hostnameFor(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function trustedSourceBoost(url: string): number {
  const hostname = hostnameFor(url);
  return trustedRecipeHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))
    ? 0.08
    : 0;
}

export function candidateRecipeText(candidate: WebRecipeCandidate): string {
  const ingredients = (candidate.recipe?.ingredients ?? []).map((ingredient) => ingredient.name).join(" ");
  return `${candidate.title} ${candidate.recipe?.name ?? ""} ${candidate.url} ${ingredients}`;
}

export function isCollectionLikeCandidate(candidate: WebRecipeCandidate): boolean {
  return collectionLikeRecipePattern.test(
    `${candidate.title} ${candidate.recipe?.name ?? ""} ${candidate.url}`
  );
}

export function qualityScoreForCandidate(candidate: WebRecipeCandidate): number {
  const signals = candidate.qualitySignals;
  const structured = signals.structuredData ? 0.3 : 0.1;
  const yieldScore = signals.hasYield ? 0.2 : 0;
  const ingredientScore = Math.min(0.2, signals.ingredientCount / 20);
  const stepScore = Math.min(0.2, signals.stepCount / 10);
  const mappingScore = signals.mappedIngredientRatio * 0.1;
  const sourceScore = trustedSourceBoost(candidate.url);
  const collectionPenalty = isCollectionLikeCandidate(candidate) ? 0.25 : 0;
  return Number(
    Math.max(
      0,
      Math.min(1, structured + yieldScore + ingredientScore + stepScore + mappingScore + sourceScore - collectionPenalty)
    ).toFixed(2)
  );
}

export function extractionCompletenessForCandidate(candidate: WebRecipeCandidate): number {
  const signals = candidate.qualitySignals;
  const coverage =
    (signals.hasYield ? 0.3 : 0) +
    Math.min(0.35, signals.ingredientCount / 20) +
    Math.min(0.25, signals.stepCount / 10) +
    Math.min(0.1, signals.mappedIngredientRatio);
  return Number(coverage.toFixed(2));
}
