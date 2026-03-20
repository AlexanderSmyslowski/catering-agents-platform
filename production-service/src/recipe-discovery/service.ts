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

const culinaryTokenExpansions: Record<string, string[]> = {
  quiche: ["tarte"],
  tarte: ["quiche"],
  schokoladenkuchen: ["chocolate", "cake"],
  kuchen: ["cake"],
  schokolade: ["chocolate"],
  schokokuchen: ["chocolate", "cake"],
  tomatensuppe: ["tomato", "soup"],
  suppe: ["soup"],
  kartoffelsalat: ["potato", "salad"],
  nudelsalat: ["pasta", "salad"],
  salat: ["salad"],
  krautsalat: ["coleslaw", "salad", "kraut"],
  karottensalat: ["carrot", "salad", "krautsalat"],
  kraut: ["cabbage", "krautsalat"],
  karotte: ["carrot"],
  karotten: ["carrot"],
  möhre: ["carrot"],
  möhren: ["carrot"],
  nuss: ["nut"],
  nüsse: ["nuts"],
  wildkräutersalat: ["herb", "salad"],
  wildkraeutersalat: ["herb", "salad"],
  wildkrautersalat: ["wild", "herb", "salad"],
  wildkräuter: ["herbs"],
  wildkrauter: ["wild", "herbs"],
  petersilie: ["parsley"],
  petersilien: ["parsley"],
  petersilienvinaigrette: ["parsley", "vinaigrette"],
  vinaigrette: ["vinaigrette"],
  brot: ["bread"],
  baguette: ["baguette"],
  nusstopping: ["nuts", "topping", "nuss"],
  kalbsbuletten: ["veal", "meatballs"],
  buletten: ["meatballs"],
  curry: ["curry"],
  reis: ["rice"],
  schmorzwiebeln: ["braised", "onions"],
  zucchini: ["zucchini"],
  pilz: ["mushroom"],
  pilze: ["mushrooms"],
  zuckerschoten: ["snow", "peas"],
  pak: ["pak"],
  choi: ["choi"],
  gemüsepfanne: ["vegetable", "stir", "fry"],
  gemuesepfanne: ["vegetable", "stir", "fry"]
};

const veganCuePattern = /\b(vegan|pflanzlich|plant[- ]based|dairy[- ]free|eggless)\b/i;
const vegetarianCuePattern = /\b(vegetarisch|vegetarian)\b/i;
const nonVeganIngredientPattern =
  /\b(milch|sahne|butter|ei|eier|joghurt|käse|kaese|quark|honig|gelatine|gelatin|parmesan|mozzarella|feta|gouda|brie|camembert|shrimp|prawn|prawns|garnel|garnele|garnelen|arnele|scampi|chicken|beef|pork|ham|bacon|sausage|salami|fish|lachs|schinken|speck|huhn|rind|kalb|puten|thunfisch|anchov|worcestershire)\b/i;
const meatIngredientPattern =
  /\b(chicken|beef|pork|ham|bacon|sausage|salami|fish|lachs|schinken|speck|huhn|rind|kalb|puten|thunfisch|garnel|garnele|garnelen|arnele|shrimp|prawn|prawns|scampi|anchov)\b/i;

type MenuCategoryCompatibility = {
  compatible: boolean;
  inferredDietTags: string[];
  confidence: "explicit" | "ingredients" | "none";
};

const collectionLikeRecipePattern =
  /\b(top\s*\d+|\d+\s+(extra\s+schnelle|schnelle|beste|best|easy|einfache?)\s+(kuchen|recipes?|desserts?|salate)|ideen|ideas|sammlung|collection|best of|die leckersten|die besten)\b/i;

const genericPrimaryTokens = new Set([
  "vegan",
  "vegetarian",
  "vegetarisch",
  "klassisch",
  "classic",
  "mit",
  "und",
  "de",
  "luxe",
  "deluxe",
  "topping",
  "frischgedons",
  "frischgedoens"
]);

function normalizeTokens(value: string): string[] {
  const baseTokens = value
    .toLowerCase()
    .split(/[^a-z0-9äöüß]+/i)
    .filter(Boolean);
  const expanded = new Set<string>();

  for (const token of baseTokens) {
    expanded.add(token);
    for (const extra of culinaryTokenExpansions[token] ?? []) {
      expanded.add(extra);
    }
  }

  return [...expanded];
}

function normalizeComparableText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase();
}

function rawComparableTokens(value: string): string[] {
  return normalizeComparableText(value).split(/[^a-z0-9]+/i).filter(Boolean);
}

function deriveCompoundStemTokens(token: string): string[] {
  const stems: string[] = [];
  const suffixes = ["kuchen", "salat", "suppe", "curry", "quiche"];

  for (const suffix of suffixes) {
    if (token.length > suffix.length + 3 && token.endsWith(suffix)) {
      const stem = token.slice(0, -suffix.length);
      if (stem.length >= 4) {
        stems.push(stem);
      }
    }
  }

  return stems;
}

function searchableSpecificTokens(value: string): string[] {
  const tokens = rawComparableTokens(value);
  const expanded = new Set<string>();

  for (const token of tokens) {
    expanded.add(token);
    for (const stem of deriveCompoundStemTokens(token)) {
      expanded.add(stem);
    }
  }

  return [...expanded];
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

function tokensSpecificallyMatch(left: string, right: string): boolean {
  if (left === right) {
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

function primarySearchSegment(label: string): string {
  return label.split("|")[0]?.trim() || label.trim();
}

function specificPrimaryFocusTokens(component: MenuComponent): string[] {
  const primarySegment = primarySearchSegment(component.label);
  const archetypes = new Set(
    [
      dishArchetypeForComponent(component, "de"),
      dishArchetypeForComponent(component, "en")
    ]
      .filter(Boolean)
      .flatMap((value) => normalizeTokens(value as string))
  );
  const focus = new Set<string>();

  for (const token of rawComparableTokens(primarySegment)) {
    if (genericPrimaryTokens.has(token) || archetypes.has(token)) {
      continue;
    }

    focus.add(token);
    for (const stem of deriveCompoundStemTokens(token)) {
      focus.add(stem);
    }
  }

  return [...focus];
}

function leadSpecificPrimaryToken(component: MenuComponent): string | undefined {
  return specificPrimaryFocusTokens(component)[0];
}

function webSpecificFocusTokens(component: MenuComponent): string[] {
  const archetypes = new Set(
    [
      dishArchetypeForComponent(component, "de"),
      dishArchetypeForComponent(component, "en")
    ]
      .filter(Boolean)
      .flatMap((value) => normalizeTokens(value as string))
  );
  const expanded = new Set<string>();

  for (const token of specificPrimaryFocusTokens(component)) {
    if (genericPrimaryTokens.has(token) || archetypes.has(token)) {
      continue;
    }

    expanded.add(token);
    for (const synonym of culinaryTokenExpansions[token] ?? []) {
      if (!genericPrimaryTokens.has(synonym) && !archetypes.has(synonym)) {
        expanded.add(synonym);
      }
    }
  }

  return [...expanded];
}

function translateLabelForLocale(label: string, locale: "de" | "en"): string {
  if (locale !== "en") {
    return label;
  }

  let translated = label.toLowerCase();
  const replacements: Array<[RegExp, string]> = [
    [/\bschokoladenkuchen\b/g, "chocolate cake"],
    [/\bkuchen\b/g, "cake"],
    [/\bschokolade\b/g, "chocolate"],
    [/\btomatensuppe\b/g, "tomato soup"],
    [/\bsuppe\b/g, "soup"],
    [/\bkartoffelsalat\b/g, "potato salad"],
    [/\bnudelsalat\b/g, "pasta salad"],
    [/\bkrautsalat\b/g, "coleslaw"],
    [/\bkarottensalat\b/g, "carrot salad"],
    [/\bkraut\b/g, "cabbage"],
    [/\bkarotten\b/g, "carrot"],
    [/\bkarotte\b/g, "carrot"],
    [/\bmöhren\b/g, "carrot"],
    [/\bmöhre\b/g, "carrot"],
    [/\bnuss-toppping\b/g, "nut topping"],
    [/\bnuss-topping\b/g, "nut topping"],
    [/\bkraut-karottensalat\b/g, "cabbage carrot salad"],
    [/\bsalat\b/g, "salad"],
    [/\bbrot\b/g, "bread"],
    [/\bbaguette\b/g, "baguette"],
    [/\bkalbsbuletten\b/g, "veal meatballs"],
    [/\bschmorzwiebeln\b/g, "braised onions"],
    [/\bbasmatireis\b/g, "basmati rice"],
    [/\bwildkräutersalat\b/g, "wild herb salad"],
    [/\bwildkraeutersalat\b/g, "wild herb salad"],
    [/\bwildkräuter\b/g, "wild herbs"],
    [/\bpetersilien-vinaigrette\b/g, "parsley vinaigrette"],
    [/\bzuckerschoten\b/g, "snow peas"],
    [/\bpilze\b/g, "mushrooms"],
    [/\bpilz\b/g, "mushroom"],
    [/\bbaby-pak-choi\b/g, "baby pak choi"],
    [/\bpak-choi\b/g, "pak choi"],
    [/\bgemüsepfanne\b/g, "vegetable stir fry"],
    [/\bgemuesepfanne\b/g, "vegetable stir fry"]
  ];

  for (const [pattern, replacement] of replacements) {
    translated = translated.replace(pattern, replacement);
  }

  return translated.replace(/\s+/g, " ").trim();
}

function dishArchetypeForComponent(
  component: MenuComponent,
  locale: "de" | "en"
): string | undefined {
  const normalized = component.label.toLowerCase();

  if (/schokoladenkuchen|schokokuchen|kuchen|cake/.test(normalized)) {
    return locale === "de" ? "kuchen" : "cake";
  }
  if (/curry/.test(normalized)) {
    return "curry";
  }
  if (/kraut|karott|salat|vinaigrette/.test(normalized)) {
    return locale === "de" ? "salat" : "salad";
  }
  if (/wildkräuter|wildkraeuter|wild.*salat|kräutersalat|kraeutersalat/.test(normalized)) {
    return locale === "de" ? "salat" : "salad";
  }
  if (/zucchini|pilze|pilz|pak-choi|zuckerschoten/.test(normalized)) {
    return locale === "de" ? "gemüsepfanne" : "vegetable stir fry";
  }
  if (/brot|baguette/.test(normalized)) {
    return locale === "de" ? "brot" : "bread";
  }
  if (/suppe/.test(normalized)) {
    return locale === "de" ? "suppe" : "soup";
  }
  return undefined;
}

function genericSearchSeeds(
  component: MenuComponent,
  locale: "de" | "en"
): string[] {
  const normalized = component.label.toLowerCase();
  const archetype = dishArchetypeForComponent(component, locale);
  const seeds = new Set<string>();

  if (archetype) {
    seeds.add(archetype);
  }

  if (/schokoladenkuchen|schokokuchen/.test(normalized)) {
    seeds.add(locale === "de" ? "schokoladenkuchen" : "chocolate cake");
    seeds.add(locale === "de" ? "veganer schokoladenkuchen" : "vegan chocolate cake");
    if (component.serviceStyle === "buffet") {
      seeds.add(locale === "de" ? "schokoladen blechkuchen" : "chocolate sheet cake");
    }
  }
  if (/kraut|karott/.test(normalized)) {
    seeds.add(locale === "de" ? "karotten krautsalat" : "coleslaw cabbage carrot");
  }
  if (/wildkräuter|wildkraeuter|wild.*salat|kräutersalat|kraeutersalat/.test(normalized)) {
    seeds.add(locale === "de" ? "wildkräutersalat" : "herb salad");
    seeds.add(
      locale === "de"
        ? "wildkräutersalat petersilien vinaigrette"
        : "wild herb salad parsley vinaigrette"
    );
  }
  if (/zucchini|pilze|pilz|pak-choi|zuckerschoten/.test(normalized)) {
    seeds.add(locale === "de" ? "gemüsepfanne" : "vegetable stir fry");
  }
  if (/curry/.test(normalized)) {
    seeds.add(locale === "de" ? "veganes curry" : "vegan curry");
  }

  return [...seeds].filter(Boolean);
}

function buildSearchQueries(
  component: MenuComponent,
  eventSpec: AcceptedEventSpec,
  locale: "de" | "en"
): string[] {
  const cleanedLabel = translateLabelForLocale(cleanedSearchLabel(component.label), locale);
  const primaryLabel = translateLabelForLocale(primarySearchSegment(component.label), locale);
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
  const genericSeeds = genericSearchSeeds(component, locale);
  const archetype = dishArchetypeForComponent(component, locale);
  const baseQueries =
    locale === "de"
      ? [
          `${cleanedLabel} ${classificationHint} rezept`,
          `${primaryLabel} ${classificationHint} rezept`,
          `${classificationHint} ${archetype ?? primaryLabel} rezept`,
          ...genericSeeds.flatMap((seed) => [
            `${seed} rezept`,
            `${classificationHint} ${seed} rezept`
          ]),
          `${primaryLabel} ${classificationHint} rezept ${eventSpec.servicePlan.serviceForm}`,
          `${primaryLabel} ${classificationHint} ${eventSpec.servicePlan.eventType} rezept`
        ]
      : [
          `${cleanedLabel} ${classificationHint} recipe`,
          `${primaryLabel} ${classificationHint} recipe`,
          `${classificationHint} ${archetype ?? primaryLabel} recipe`,
          ...genericSeeds.flatMap((seed) => [
            `${seed} recipe`,
            `${classificationHint} ${seed} recipe`
          ]),
          `${primaryLabel} ${classificationHint} recipe ${eventSpec.servicePlan.serviceForm}`,
          `${primaryLabel} ${classificationHint} catering recipe`
        ];

  return [
    ...new Set(
      baseQueries
        .map((query) =>
          query
            .replace(/\s+/g, " ")
            .trim()
            .split(" ")
            .filter((token, index, tokens) => token && token !== tokens[index - 1])
            .join(" ")
        )
        .filter((query) => query.length > 0)
    )
  ];
}

function fitScoreForRecipe(
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
  const phraseBoost = normalizedPrimarySegment && normalizedRecipeText.includes(normalizedPrimarySegment) ? 0.2 : 0;
  return Math.min(1, Math.max(0, overlap + primaryOverlap * 0.35 + phraseBoost + eventBoost + categoryBoost));
}

function primaryMatchScore(recipeText: string, component: MenuComponent): number {
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

function specificPrimaryMatchScore(recipeText: string, component: MenuComponent): number {
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

function webSpecificMatchScore(recipeText: string, component: MenuComponent): number {
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

function candidateFormMismatch(candidateText: string, component: MenuComponent): boolean {
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

function hasMinimumOperationalRecipeStructure(recipe: Recipe): boolean {
  return (
    Array.isArray(recipe.ingredients) &&
    recipe.ingredients.length > 0 &&
    Array.isArray(recipe.steps) &&
    recipe.steps.some((step) => step.instruction.trim().length > 0) &&
    Number(recipe.baseYield?.servings ?? 0) > 0
  );
}

function requiresStrictInternalMatch(component: MenuComponent): boolean {
  const normalized = normalizeComparableText(component.label);
  return /quiche|tarte|schokoladenkuchen|schokokuchen|wildkraut|kraut|karott|salat|vinaigrette|brot|baguette/.test(
    normalized
  );
}

function genericInternalRecipeMismatch(recipe: Recipe, component: MenuComponent): boolean {
  const recipeText = normalizeComparableText(recipeSearchText(recipe));
  const query = normalizeComparableText(component.label);
  const focusTokens = specificPrimaryFocusTokens(component);
  const recipeTokens = searchableSpecificTokens(recipeSearchText(recipe));

  if (
    requiresStrictInternalMatch(component) &&
    focusTokens.length > 0 &&
    !focusTokens.some((token) =>
      recipeTokens.some((candidateToken) => tokensSpecificallyMatch(token, candidateToken))
    )
  ) {
    return true;
  }

  if (/(wildkrauter|wildkr[aä]uter|petersilien|vinaigrette)/.test(query)) {
    return !/(wildkrauter|wildkr[aä]uter|parsley|petersilien|vinaigrette|krauter|herb)/.test(recipeText);
  }

  if (/(kraut|karott)/.test(query)) {
    return !/(kraut|cabbage|karott|carrot|coleslaw)/.test(recipeText);
  }

  if (/(schokoladenkuchen|schokokuchen)/.test(query)) {
    return !/(schokolad|chocolate|schoko)/.test(recipeText);
  }

  if (/(quiche|tarte)/.test(query)) {
    return !/(quiche|tarte)/.test(recipeText);
  }

  if (/(brot|baguette)/.test(query)) {
    return !/(brot|bread|baguette)/.test(recipeText);
  }

  return false;
}

function isControlledExternalFallbackCandidate(
  component: MenuComponent,
  qualityScore: number,
  extractionCompleteness: number,
  specificFitScore: number
): boolean {
  if (!requiresStrictInternalMatch(component)) {
    return true;
  }

  return qualityScore >= 0.45 && extractionCompleteness >= 0.45 && specificFitScore > 0;
}

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

function candidateRecipeText(candidate: WebRecipeCandidate): string {
  const ingredients = (candidate.recipe?.ingredients ?? []).map((ingredient) => ingredient.name).join(" ");
  return `${candidate.title} ${candidate.recipe?.name ?? ""} ${candidate.url} ${ingredients}`;
}

function recipeSearchText(recipe: Recipe): string {
  const ingredients = recipe.ingredients.map((ingredient) => ingredient.name).join(" ");
  return `${recipe.name} ${recipe.source.reference} ${(recipe.dietTags ?? []).join(" ")} ${ingredients}`;
}

function isCollectionLikeCandidate(candidate: WebRecipeCandidate): boolean {
  return collectionLikeRecipePattern.test(
    `${candidate.title} ${candidate.recipe?.name ?? ""} ${candidate.url}`
  );
}

function componentSearchTokens(component: MenuComponent): string[] {
  const combined = new Set<string>(normalizeTokens(component.label));
  const archetypes = [
    dishArchetypeForComponent(component, "de"),
    dishArchetypeForComponent(component, "en")
  ].filter(Boolean) as string[];

  for (const archetype of archetypes) {
    for (const token of normalizeTokens(archetype)) {
      combined.add(token);
    }
  }

  return [...combined];
}

function hasCategoryCue(text: string, category: MenuComponent["menuCategory"] | undefined): boolean {
  if (!category) {
    return true;
  }

  if (category === "vegan") {
    return veganCuePattern.test(text);
  }

  if (category === "vegetarian") {
    return vegetarianCuePattern.test(text) || veganCuePattern.test(text);
  }

  return true;
}

function categoryBoostForText(
  text: string,
  component: MenuComponent
): number {
  if (!component.menuCategory) {
    return 0;
  }

  return hasCategoryCue(text, component.menuCategory) ? 0.2 : -0.05;
}

function evaluateMenuCategoryCompatibility(
  candidate: WebRecipeCandidate,
  component: MenuComponent
): MenuCategoryCompatibility {
  if (!component.menuCategory) {
    return {
      compatible: true,
      inferredDietTags: [],
      confidence: "none"
    };
  }

  const text = `${candidate.title} ${candidate.url} ${(candidate.recipe?.dietTags ?? []).join(" ")}`;
  if (hasCategoryCue(text, component.menuCategory)) {
    return {
      compatible: true,
      inferredDietTags: [component.menuCategory],
      confidence: "explicit"
    };
  }

  const ingredientNames = (candidate.recipe?.ingredients ?? [])
    .map((ingredient) => ingredient.name)
    .join(" ")
    .toLowerCase();

  if (!ingredientNames) {
    return {
      compatible: false,
      inferredDietTags: [],
      confidence: "none"
    };
  }

  if (component.menuCategory === "vegan") {
    if (nonVeganIngredientPattern.test(ingredientNames)) {
      return {
        compatible: false,
        inferredDietTags: [],
        confidence: "none"
      };
    }

    return {
      compatible: true,
      inferredDietTags: ["vegan"],
      confidence: "ingredients"
    };
  }

  if (component.menuCategory === "vegetarian") {
    if (meatIngredientPattern.test(ingredientNames)) {
      return {
        compatible: false,
        inferredDietTags: [],
        confidence: "none"
      };
    }

    return {
      compatible: true,
      inferredDietTags: ["vegetarian"],
      confidence: "ingredients"
    };
  }

  return {
    compatible: true,
    inferredDietTags: [],
    confidence: "none"
  };
}

function candidateSupportsMenuCategory(
  candidate: WebRecipeCandidate,
  component: MenuComponent
): boolean {
  return evaluateMenuCategoryCompatibility(candidate, component).compatible;
}

function recipeSupportsMenuCategory(recipe: Recipe, component: MenuComponent): boolean {
  if (!component.menuCategory) {
    return true;
  }

  const text = `${recipe.name} ${recipe.source.reference} ${(recipe.dietTags ?? []).join(" ")}`;
  if (hasCategoryCue(text, component.menuCategory)) {
    return true;
  }

  const ingredientNames = recipe.ingredients.map((ingredient) => ingredient.name).join(" ").toLowerCase();
  if (!ingredientNames) {
    return false;
  }

  if (component.menuCategory === "vegan") {
    return !nonVeganIngredientPattern.test(ingredientNames);
  }

  if (component.menuCategory === "vegetarian") {
    return !meatIngredientPattern.test(ingredientNames);
  }

  return true;
}

function qualityScoreForCandidate(candidate: WebRecipeCandidate): number {
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

type UnresolvedRecipeClarification =
  | "composed_component_clarification"
  | "variant_unclear"
  | "internal_recipe_missing"
  | "production_mode_decision"
  | "generic";

function isBakeryProcurementComponent(component: MenuComponent): boolean {
  const normalized = normalizeComparableText(component.label);
  return /(brot|baguette)/.test(normalized) && !/focaccia/.test(normalized);
}

function isHybridBakeryClarificationComponent(component: MenuComponent): boolean {
  const normalized = normalizeComparableText(component.label);
  return /focaccia/.test(normalized);
}

function hasOpenSelectionMarkers(component: MenuComponent): boolean {
  const raw = component.label.toLowerCase();
  const normalized = normalizeComparableText(component.label);
  return (
    raw.includes("bitte wählen sie") ||
    raw.includes("bitte waehlen sie") ||
    raw.includes("je nach auswahl") ||
    normalized.includes("bitte wahlen sie") ||
    normalized.includes("je nach auswahl") ||
    /\balternative(n)?\s*\d+(?:\s*\/\s*\d+)?\b/.test(normalized)
  );
}

function isCompositeMenuLineClarificationComponent(component: MenuComponent): boolean {
  const segments = component.label
    .split("|")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length < 2) {
    return false;
  }

  const [, ...restSegments] = segments;
  const accompanimentText = normalizeComparableText(restSegments.join(" "));

  return /\b(schmorzwiebeln?|reis|rice|topping|vinaigrette|dressing)\b/.test(accompanimentText);
}

function needsVariantClarification(component: MenuComponent): boolean {
  const normalized = normalizeComparableText(component.label);
  return /\b(auswahl|variation|variationen|sorten|sortiment|mix|assortment|assorted|oder)\b/.test(
    normalized
  );
}

function hasClearDishArchetype(component: MenuComponent): boolean {
  return Boolean(
    dishArchetypeForComponent(component, "de") || dishArchetypeForComponent(component, "en")
  );
}

function unresolvedRecipeClarificationKind(
  component: MenuComponent,
  input: {
    repositoryCandidatesFound: boolean;
    externalCandidatesSeen: boolean;
    webSearchFailed: boolean;
  }
): UnresolvedRecipeClarification {
  if (hasOpenSelectionMarkers(component)) {
    return "variant_unclear";
  }

  if (isCompositeMenuLineClarificationComponent(component)) {
    return "composed_component_clarification";
  }

  if (needsVariantClarification(component)) {
    return "variant_unclear";
  }

  if (input.externalCandidatesSeen || input.webSearchFailed) {
    return "production_mode_decision";
  }

  if (hasClearDishArchetype(component) || input.repositoryCandidatesFound) {
    return "internal_recipe_missing";
  }

  return "generic";
}

function recipeCategoryHint(component: MenuComponent): string {
  return component.menuCategory === "vegan"
    ? "veganer "
    : component.menuCategory === "vegetarian"
      ? "vegetarischer "
      : "";
}

function unresolvedRecipeTexts(
  component: MenuComponent,
  input: {
    repositoryCandidatesFound: boolean;
    externalCandidatesSeen: boolean;
    webSearchFailed: boolean;
  }
): { selectionReason: string; unresolvedItem: string } {
  const categoryHint = recipeCategoryHint(component);
  const kind = unresolvedRecipeClarificationKind(component, input);

  if (kind === "variant_unclear") {
    if (hasOpenSelectionMarkers(component)) {
      return {
        selectionReason: `Für ${component.label} enthält das Angebot noch eine offene Auswahl / Alternative. Bitte zuerst die gewünschte Speise verbindlich festlegen, bevor Rezept, Produktion und Einkauf belastbar geplant werden.`,
        unresolvedItem: `Auswahl für ${component.label} klären: gewünschte Alternative verbindlich festlegen.`
      };
    }

    return {
      selectionReason: `Variante / Ausführung für ${component.label} ist noch unklar. Bitte die gewünschte Ausführung festlegen, damit Produktion und Einkauf belastbar weitergeplant werden können.`,
      unresolvedItem: `Variante / Ausführung für ${component.label} klären: gewünschte Ausführung festlegen.`
    };
  }

  if (kind === "composed_component_clarification") {
    return {
      selectionReason: `Für ${component.label} enthält die Angebotszeile mehrere Bestandteile. Bitte Hauptkomponente und Beilage/Sauce/Topping zuerst separat festlegen, bevor Rezeptwahl, Produktion und Einkauf belastbar weitergeführt werden.`,
      unresolvedItem: `Bestandteile für ${component.label} klären: Hauptkomponente und Beilage/Sauce/Topping separat festlegen.`
    };
  }

  if (kind === "internal_recipe_missing") {
    return {
      selectionReason: `Für ${component.label} ist die Speise grundsätzlich klar, aber es fehlt noch eine belastbare interne Rezeptgrundlage. Bitte ein internes Rezept zuweisen oder neu anlegen.`,
      unresolvedItem: `Internes Rezept für ${component.label} zuweisen oder neu anlegen.`
    };
  }

  if (kind === "production_mode_decision") {
    return {
      selectionReason: `Für ${component.label} muss als Nächstes die Herstellungsart entschieden werden: Eigenproduktion oder Zukauf. Danach kann Rezeptwahl oder Beschaffung belastbar festgelegt werden.`,
      unresolvedItem: `Herstellungsart für ${component.label} entscheiden: Eigenproduktion oder Zukauf.`
    };
  }

  return {
    selectionReason: input.webSearchFailed
      ? "Es konnte kein interner Rezeptkandidat gefunden werden und die Internetrecherche ist fehlgeschlagen."
      : component.menuCategory === "vegan"
        ? "Es konnte kein interner oder externer veganer Rezeptkandidat belastbar validiert werden."
        : component.menuCategory === "vegetarian"
          ? "Es konnte kein interner oder externer vegetarischer Rezeptkandidat belastbar validiert werden."
          : "Es konnte kein interner oder externer Rezeptkandidat belastbar validiert werden.",
    unresolvedItem: input.webSearchFailed
      ? `Kein ${categoryHint}Rezeptkandidat für ${component.label} gefunden, Internetrecherche fehlgeschlagen.`
      : `Kein ${categoryHint}Rezeptkandidat für ${component.label} gefunden.`
  };
}

function isStrongRecipeCandidate(recipe: Recipe): boolean {
  return (
    recipe.source.approvalState === "auto_usable" ||
    recipe.source.fitScore >= 0.8 ||
    recipe.source.qualityScore + recipe.source.fitScore >= 1.45
  );
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

    if (isBakeryProcurementComponent(component)) {
      pushTrace("Komponente als Bäcker-Zukauf erkannt.");
      return {
        selection: {
          componentId: component.componentId,
          selectionReason:
            "Brot/Baguette wird als Zukauf vom Bäcker behandelt. Kein Rezept-Matching und keine Internetrecherche nötig.",
          searchTrace,
          autoUsedInternetRecipe: false
        },
        unresolvedItems: [
          `Bäckerbestellung für ${component.label} klären: Sorte und Menge als Zukauf festlegen.`
        ]
      };
    }

    if (isHybridBakeryClarificationComponent(component)) {
      pushTrace("Komponente als hybride Backware erkannt.");
      return {
        selection: {
          componentId: component.componentId,
          selectionReason:
            "Für diese Focaccia-Komponente muss Herstellungsart und Variante geklärt werden: Eigenproduktion oder Zukauf; falls Eigenproduktion, internes Rezept zuweisen oder neues Rezept anlegen.",
          searchTrace,
          autoUsedInternetRecipe: false
        },
        unresolvedItems: [
          `Focaccia für ${component.label} klären: Variante und Herstellungsart festlegen.`
        ]
      };
    }

    if (hasOpenSelectionMarkers(component)) {
      pushTrace("Offener Auswahl-/Alternativblock erkannt.");
      const unresolved = unresolvedRecipeTexts(component, {
        repositoryCandidatesFound: false,
        externalCandidatesSeen: false,
        webSearchFailed: false
      });
      return {
        selection: {
          componentId: component.componentId,
          selectionReason: unresolved.selectionReason,
          searchTrace,
          autoUsedInternetRecipe: false
        },
        unresolvedItems: [unresolved.unresolvedItem]
      };
    }

    const repositoryCandidates = await this.repository.findCandidates(component);
    const internalCandidates = repositoryCandidates
      .filter((recipe) => recipeSupportsMenuCategory(recipe, component))
      .map((recipe, index) => ({
        recipe,
        repositoryRank: index,
        fitScore: fitScoreForRecipe(recipeSearchText(recipe), component, eventSpec),
        primaryScore: primaryMatchScore(recipeSearchText(recipe), component),
        specificPrimaryScore: specificPrimaryMatchScore(recipeSearchText(recipe), component),
        leadNameScore: (() => {
          const leadToken = leadSpecificPrimaryToken(component);
          if (!leadToken) {
            return 0;
          }

          return searchableSpecificTokens(recipe.name).some((token) =>
            tokensSpecificallyMatch(leadToken, token)
          )
            ? 1
            : 0;
        })()
      }))
      .filter((candidate) => {
        const minimalStructure = hasMinimumOperationalRecipeStructure(candidate.recipe);
        const strictMatchRequired = requiresStrictInternalMatch(component);
        const genericMismatch = genericInternalRecipeMismatch(candidate.recipe, component);
        const fitAccepted =
          candidate.fitScore >= 0.75 ||
          (candidate.repositoryRank === 0 && candidate.leadNameScore === 1 && candidate.fitScore >= 0.55);
        const primaryAccepted = candidate.primaryScore >= 0.5 || candidate.leadNameScore === 1;
        const specificAccepted = candidate.specificPrimaryScore >= 0.34 || candidate.leadNameScore === 1;
        const strictSpecificAccepted =
          candidate.leadNameScore === 1 ||
          (candidate.fitScore >= 0.7 && candidate.specificPrimaryScore >= 0.55);

        return (
          minimalStructure &&
          fitAccepted &&
          primaryAccepted &&
          specificAccepted &&
          (!strictMatchRequired || strictSpecificAccepted) &&
          !genericMismatch
        );
      })
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

    if (repositoryCandidates.length > 0) {
      pushTrace("Interne Kandidaten verworfen: keine belastbare interne Rezeptgrundlage.");
    }

    const locales: ("de" | "en")[] = ["de", "en"];
    const candidates: {
      recipe: Recipe;
      query: RecipeSearchQuery;
    }[] = [];
    let webSearchFailed = false;
    let externalCandidatesSeen = false;

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
          if (searchResults.length > 0) {
            externalCandidatesSeen = true;
          }
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
              const validated = validateRecipe(materialized);
              if (
                !isControlledExternalFallbackCandidate(
                  component,
                  qualityScore,
                  extractionCompleteness,
                  specificFitScore
                )
              ) {
                pushTrace(`Verworfen: ${candidate.title} (kein belastbarer Ausweichtreffer).`);
                continue;
              }
              candidates.push({
                recipe: validated,
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
      const unresolved = unresolvedRecipeTexts(component, {
        repositoryCandidatesFound: repositoryCandidates.length > 0,
        externalCandidatesSeen,
        webSearchFailed
      });
      return {
        selection: {
          componentId: component.componentId,
          selectionReason: unresolved.selectionReason,
          searchTrace,
          autoUsedInternetRecipe: false
        },
        unresolvedItems: [unresolved.unresolvedItem]
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
