import { createHash } from "node:crypto";
import path from "node:path";
import {
  createBusinessScopedPersistentCollection,
  type BusinessScopedPersistentCollection,
  type CollectionStorageOptions,
  type Queryable
} from "./persistence.js";
import { withBusinessTargetCriticalSection } from "./target-critical-section.js";
import type { BusinessContext } from "./business-context.js";
import { isTrustedProductionRecipe } from "./recipe-research-calculation-boundary.js";
import { ingredientGroupHints, unitNormalization } from "./taxonomies/defaults.js";
import {
  SCHEMA_VERSION,
  type Recipe,
  type RecipeReviewDecision,
  type UploadSourceMetadata
} from "./types.js";
import { validateRecipe } from "./validation.js";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const searchTokenExpansions: Record<string, string[]> = {
  schokoladenkuchen: ["chocolate", "cake"],
  schokokuchen: ["chocolate", "cake"],
  schokolade: ["chocolate"],
  chocolate: ["schokolade", "schokoladenkuchen", "schokokuchen"],
  cake: ["kuchen", "schokoladenkuchen", "schokokuchen"],
  kuchen: ["cake"],
  schafskaese: ["feta"],
  feta: ["schafskaese"],
  schafskase: ["feta"],
  quiche: ["tarte"],
  sauce: ["sosse"],
  sosse: ["sauce"],
  weisswein: ["wein"],
  weißwein: ["wein"],
  lauch: ["porree"],
  porree: ["lauch"],
  gruen: ["gruner", "grüne", "gruner"],
  grüner: ["gruen", "gruner"],
  spargel: ["asparagus"],
  kuerbis: ["hokkaido", "pumpkin"],
  kürbis: ["hokkaido", "pumpkin"],
  nuss: ["nuesse", "nuts"],
  nuesse: ["nuss", "nuts"],
  salat: ["salads"],
  nudelsalat: ["pastasalat", "pasta", "salat"],
  pastasalat: ["nudelsalat", "pasta", "salat"],
  kartoffelsalat: ["potatosalad", "potato", "salat"],
  potatosalad: ["kartoffelsalat", "potato", "salat"],
  mandel: ["almond"],
  mandeln: ["almond", "almonds"],
  almond: ["mandel", "mandeln"],
  almonds: ["mandel", "mandeln"],
  basmatireis: ["basmati", "rice"],
  basmati: ["basmatireis"],
  reis: ["rice"],
  rice: ["reis", "basmatireis"],
  koriander: ["coriander", "cilantro"],
  coriander: ["koriander"],
  cilantro: ["koriander"],
  hummus: ["humus"],
  humus: ["hummus"],
  linseneintopf: ["lentil", "lentils", "stew"],
  linsen: ["lentil", "lentils"],
  linse: ["lentil"],
  lentil: ["linse", "linsen"],
  lentils: ["linse", "linsen"],
  eintopf: ["stew"],
  stew: ["eintopf"],
  kalbsbuletten: ["veal", "meatballs", "buletten"],
  kalbsfrikadellen: ["veal", "meatballs", "frikadellen"],
  buletten: ["meatballs"],
  frikadellen: ["meatballs"],
  meatballs: ["buletten", "frikadellen"],
  aubergine: ["eggplant"],
  auberginen: ["eggplant"],
  auberginenrollchen: ["eggplant", "rolls", "auberginen"],
  eggplant: ["aubergine", "auberginen"],
  rolls: ["rollchen"],
  rollchen: ["rolls"],
  blaubeere: ["blueberry"],
  blaubeeren: ["blueberry"],
  blueberry: ["blaubeere", "blaubeeren"],
  obst: ["fruit"],
  obstspiess: ["fruit", "skewers"],
  obstspiesse: ["fruit", "skewers"],
  fruit: ["obst"],
  spiess: ["skewer"],
  spiesse: ["skewers"],
  skewer: ["spiess"],
  skewers: ["spiesse"],
  krautsalat: ["coleslaw", "salat", "kraut", "karottensalat"],
  karottensalat: ["karotten", "salat", "krautsalat"],
  wildkrautersalat: ["wild", "herb", "salad"],
  wildkrauter: ["wild", "herbs"],
  petersilien: ["parsley"],
  gemuesepfanne: ["gemusepfanne", "vegetable", "stir", "fry"],
  gemusepfanne: ["gemuesepfanne", "vegetable", "stir", "fry"]
};

const ignoredSearchTokens = new Set([
  "rezept",
  "rezepte",
  "portion",
  "portionen",
  "servings",
  "personen",
  "gaeste",
  "gaste",
  "pax",
  "gn",
  "1",
  "2",
  "4",
  "5",
  "8",
  "15",
  "20",
  "25",
  "35",
  "40",
  "45",
  "80"
]);

const genericPrimarySearchTokens = new Set([
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

const ignoredImportedRecipePattern =
  /\b(produktionsblatt|abschiebeplan|standing reception|paschtu|bleche[- ]?gn[- ]?plan)\b/i;

function normalizeSearchText(value?: string | null): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase();
}

function tokenizeSearchText(value: string): string[] {
  const normalized = normalizeSearchText(value);
  const rawTokens = normalized.split(/[^a-z0-9]+/i).filter(Boolean);
  const expanded = new Set<string>();

  for (const token of rawTokens) {
    if (ignoredSearchTokens.has(token) || /^\d+$/.test(token)) {
      continue;
    }

    expanded.add(token);
    for (const variant of searchTokenExpansions[token] ?? []) {
      expanded.add(variant);
    }
  }

  return [...expanded];
}

function rawSearchTokens(value: string): string[] {
  return normalizeSearchText(value)
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .filter((token) => !ignoredSearchTokens.has(token) && !/^\d+$/.test(token));
}

function deriveArchetypeTokens(label: string): string[] {
  const normalized = normalizeSearchText(label);

  if (/quiche|tarte/.test(normalized)) {
    return ["quiche", "tarte"];
  }
  if (/curry/.test(normalized)) {
    return ["curry"];
  }
  if (/linseneintopf|eintopf|stew/.test(normalized)) {
    return ["eintopf", "stew"];
  }
  if (/salat|krautsalat|kartoffelsalat|nudelsalat|wildkrautersalat/.test(normalized)) {
    return ["salat", "salad"];
  }
  if (/suppe|minestrone|cremesuppe/.test(normalized)) {
    return ["suppe", "soup"];
  }
  if (/sauce|sosse|soße/.test(normalized)) {
    return ["sauce", "sosse"];
  }
  if (/kuchen|cake/.test(normalized)) {
    return ["kuchen", "cake"];
  }
  if (/gnocchi/.test(normalized)) {
    return ["gnocchi"];
  }
  if (/smoothie/.test(normalized)) {
    return ["smoothie"];
  }

  return [];
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
  const tokens = rawSearchTokens(value);
  const expanded = new Set<string>();

  tokens.forEach((token, index) => {
    expanded.add(token);
    for (const stem of deriveCompoundStemTokens(token)) {
      expanded.add(stem);
    }
    const nextToken = tokens[index + 1];
    if (nextToken) {
      expanded.add(`${token}${nextToken}`);
    }
  });

  return [...expanded];
}

function specificPrimaryFocusTokens(label: string): string[] {
  const primarySegment = label.split("|")[0]?.trim() || label;
  const archetypes = new Set(deriveArchetypeTokens(primarySegment));
  const focus = new Set<string>();

  for (const token of rawSearchTokens(primarySegment)) {
    if (genericPrimarySearchTokens.has(token) || archetypes.has(token)) {
      continue;
    }

    focus.add(token);
    for (const stem of deriveCompoundStemTokens(token)) {
      focus.add(stem);
    }
    for (const variant of searchTokenExpansions[token] ?? []) {
      if (!genericPrimarySearchTokens.has(variant) && !archetypes.has(variant)) {
        focus.add(variant);
      }
    }
  }

  return [...focus];
}

function leadSpecificPrimaryToken(label: string): string | undefined {
  return specificPrimaryFocusTokens(label)[0];
}

function expandQuerySpecificTokens(tokens: string[]): string[] {
  const expanded = new Set<string>();
  for (const token of tokens) {
    expanded.add(token);
    for (const variant of searchTokenExpansions[token] ?? []) {
      expanded.add(variant);
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

  if (
    (searchTokenExpansions[left] ?? []).includes(right) ||
    (searchTokenExpansions[right] ?? []).includes(left)
  ) {
    return true;
  }

  return commonPrefixLength(left, right) >= 5;
}

function normalizeUnit(unit?: string): string {
  if (!unit) {
    return "pcs";
  }

  return unitNormalization[unit.toLowerCase()] ?? unit.toLowerCase();
}

function parseAmount(token?: string): number {
  if (!token) {
    return 1;
  }

  if (token.includes("/")) {
    const [left, right] = token.split("/", 2).map((part) => Number(part.replace(",", ".")));
    if (Number.isFinite(left) && Number.isFinite(right) && right !== 0) {
      return Number((left / right).toFixed(2));
    }
  }

  const parsed = Number(token.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 1;
}

function purchaseUnitFor(unit: string): string {
  if (unit === "g") {
    return "kg";
  }

  if (unit === "ml") {
    return "l";
  }

  return unit;
}

function ingredientGroupFor(name: string): string {
  const normalized = name.toLowerCase();
  const match = Object.entries(ingredientGroupHints).find(([keyword]) =>
    normalized.includes(keyword)
  );
  return match?.[1] ?? "misc";
}

function parseIngredientLine(line: string, index: number) {
  const cleaned = line
    .trim()
    .replace(/^[•*-\s]+/, "")
    .replace(/^\d+[.)]\s+/, "");

  if (!cleaned || isRecipeSectionHeading(cleaned) || isInstructionLine(cleaned)) {
    return undefined;
  }

  const match = cleaned.match(
    /^([\d.,/]+)?\s*(kg|g|ml|l|pcs|stück|stueck|el|tl)?\s+(.+)$/i
  );

  if (!match) {
    return {
      ingredientId: `${slugify(cleaned)}-${index + 1}`,
      name: cleaned,
      quantity: {
        amount: 1,
        unit: "pcs"
      },
      group: ingredientGroupFor(cleaned),
      purchaseUnit: "pcs",
      normalizedUnit: "pcs"
    };
  }

  const amount = parseAmount(match[1]);
  const unit = normalizeUnit(match[2]);
  const name = match[3].trim();

  return {
    ingredientId: `${slugify(name)}-${index + 1}`,
    name,
    quantity: {
      amount,
      unit
    },
    group: ingredientGroupFor(name),
    purchaseUnit: purchaseUnitFor(unit),
    normalizedUnit: unit
  };
}

function isIngredientLine(line: string): boolean {
  const cleaned = line.trim();
  return !isInstructionLine(cleaned) &&
    /^[•*-\s]*[\d.,/]+\s*(kg|g|ml|l|pcs|stück|stueck|el|tl)?\s+\S+/i.test(cleaned);
}

function isInstructionLine(line: string): boolean {
  return /^\d+[.)]\s+/.test(line.trim()) || /^(mix|cook|bake|serve|prepare|wash|cut|add|stir|boil|roast|mischen|kochen|backen|servieren|vorbereiten|schneiden|zugeben|ruehren|rühren)/i.test(line.trim());
}

function isIngredientSectionHeading(line: string): boolean {
  return /^(zutaten|ingredients?)[:]?$/i.test(line.trim());
}

function isStepSectionHeading(line: string): boolean {
  return /^(zubereitung|anleitung|methode|preparation|directions?|steps?|instructions?|method)[:]?$/i.test(line.trim());
}

function isRecipeSectionHeading(line: string): boolean {
  return isIngredientSectionHeading(line) ||
    isStepSectionHeading(line) ||
    /^(allergene?|allergens?|diet|diettags?|ernaehrung|ernährung|diät|diets?)[:]?$/i.test(line.trim());
}

function splitSections(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const sections = {
    titleLines: [] as string[],
    ingredients: [] as string[],
    steps: [] as string[],
    allergens: [] as string[],
    diets: [] as string[],
    notes: [] as string[]
  };

  let mode: "title" | "ingredients" | "steps" | "allergens" | "diets" | "notes" = "title";

  for (const line of lines) {
    if (isIngredientSectionHeading(line)) {
      mode = "ingredients";
      continue;
    }
    if (isStepSectionHeading(line)) {
      mode = "steps";
      continue;
    }
    if (/^(allergene?|allergens?)[:]?$/i.test(line)) {
      mode = "allergens";
      continue;
    }
    if (/^(diet|diettags?|ernaehrung|ernährung|diät|diets?)[:]?$/i.test(line)) {
      mode = "diets";
      continue;
    }

    if (mode === "title") {
      sections.titleLines.push(line);
    } else if (mode === "ingredients") {
      sections.ingredients.push(line);
    } else if (mode === "steps") {
      sections.steps.push(line);
    } else if (mode === "allergens") {
      sections.allergens.push(line);
    } else if (mode === "diets") {
      sections.diets.push(line);
    } else {
      sections.notes.push(line);
    }
  }

  if (sections.ingredients.length === 0 || sections.steps.length === 0) {
    for (const line of lines.slice(1)) {
      if (sections.ingredients.length === 0 && isIngredientLine(line)) {
        sections.ingredients.push(line);
        continue;
      }

      if (sections.steps.length === 0 && isInstructionLine(line)) {
        sections.steps.push(line);
      } else if (sections.ingredients.length > 0 && isIngredientLine(line)) {
        sections.ingredients.push(line);
      } else if (sections.steps.length > 0) {
        sections.steps.push(line);
      } else {
        sections.notes.push(line);
      }
    }
  }

  return sections;
}

function recipeNameFromText(
  text: string,
  filename?: string,
  override?: string
): string {
  if (override?.trim()) {
    return override.trim();
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const explicitName = lines.find((line) => /^(rezept|recipe)\s*[:\-]\s*/i.test(line));
  if (explicitName) {
    return explicitName.replace(/^(rezept|recipe)\s*[:\-]\s*/i, "").trim();
  }

  const firstLine = lines.find(
    (line) =>
      !isRecipeSectionHeading(line)
  );
  if (firstLine) {
    return firstLine;
  }

  if (filename) {
    return path.parse(filename).name.replace(/[-_]+/g, " ").trim();
  }

  return "Hochgeladenes Rezept";
}

function servingsFromText(text: string): number {
  const yieldLabels = "(?:portionen?|portions?|servings?|personen|gaeste|gäste|people|pax|yield)";
  const wholeYieldLabel = `(?<![\\p{L}\\p{N}])${yieldLabels}(?![\\p{L}\\p{N}])`;
  const compactNumberBeforeLabelHint = `\\d+${yieldLabels}`;
  const compactLabelBeforeNumberHint = `${yieldLabels}\\d+`;
  const spacedNumberBeforeLabelHint = `\\d+[ \\t]+${yieldLabels}`;
  const yieldHintLine = new RegExp(
    `(?:${wholeYieldLabel}|${compactNumberBeforeLabelHint}|${compactLabelBeforeNumberHint}|${spacedNumberBeforeLabelHint})`,
    "iu"
  );
  const hintLines = text.split(/\r?\n/).filter((line) => yieldHintLine.test(line));
  const numberBeforeLabel = new RegExp(
    `^\\s*(\\d{1,4})[ \\t]+${wholeYieldLabel}[ \\t]*$`,
    "iu"
  );
  const compactNumberBeforeLabel = new RegExp(
    `^\\s*(\\d{1,4})${yieldLabels}(?![\\p{L}\\p{N}])[ \\t]*$`,
    "iu"
  );
  const labelBeforeNumber = new RegExp(
    `^\\s*${wholeYieldLabel}(?:[ \\t]*:[ \\t]*|[ \\t]+)(\\d{1,4})(?=[ \\t]*$)`,
    "iu"
  );
  const candidates: number[] = [];
  for (const line of hintLines) {
    const lineCandidates = [
      numberBeforeLabel.exec(line),
      compactNumberBeforeLabel.exec(line),
      labelBeforeNumber.exec(line)
    ]
      .filter((match): match is RegExpExecArray => match !== null)
      .map((match) => Number(match[1]));
    if ((line.match(/\d{1,4}/g) ?? []).length !== 1 || lineCandidates.length !== 1) {
      throw new Error("Die Ertragsangabe des Rezepts ist nicht eindeutig auswertbar.");
    }
    candidates.push(lineCandidates[0]!);
  }
  const hasYieldHint = hintLines.length > 0;

  if (!hasYieldHint) {
    return 8;
  }

  if (candidates.length === 0 || candidates.some((candidate) => !Number.isSafeInteger(candidate) || candidate <= 0)) {
    throw new Error("Die Ertragsangabe des Rezepts ist nicht eindeutig auswertbar.");
  }

  const distinctCandidates = new Set(candidates);
  if (distinctCandidates.size !== 1) {
    throw new Error("Das Rezept enthält widersprüchliche Ertragsangaben.");
  }

  return candidates[0];
}

function containsWholeAllergenTerm(text: string, terms: string[]): boolean {
  return terms.some((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu").test(text);
  });
}

function detectAllergens(text: string): string[] {
  const normalized = text.toLowerCase();
  const allergens = new Set<string>();
  const controlledNutRootSuffix = /(?<![\p{L}\p{N}])(?:nuss|erdnuss|haselnuss|walnuss|pekannuss|macadamianuss)(?:öl|oel|mehl|kern(?:e)?|creme|butter|nougat)(?![\p{L}\p{N}])/iu;
  const milkSearchText = normalized.replace(
    /(?<![\p{L}\p{N}])(?:erdnussbutter|peanuts?[ \t]+butter)(?![\p{L}\p{N}])/giu,
    " "
  );
  if (containsWholeAllergenTerm(milkSearchText, ["milch", "milchpulver", "vollmilch", "buttermilch", "kondensmilch", "milchschokolade", "milk", "butter", "buttercreme", "butterkeks", "cream", "parmesan", "cheese", "cheesecake"])) {
    allergens.add("milk");
  }
  if (containsWholeAllergenTerm(normalized, ["weizen", "weizenmehl", "weizenstärke", "weizenbrot", "weizengrieß", "vollkornbrot", "wheat", "flour", "bread", "breadcrumbs", "brot", "croissant", "pasta", "croutons"])) {
    allergens.add("gluten");
  }
  if (controlledNutRootSuffix.test(normalized) || containsWholeAllergenTerm(normalized, ["nuss", "nüsse", "nuesse", "haselnuss", "haselnüsse", "haselnuesse", "walnuss", "walnüsse", "walnuesse", "erdnuss", "erdnüsse", "erdnuesse", "pekannuss", "pekannüsse", "pekannuesse", "nussmix", "macadamianuss", "peanut", "peanuts", "peanut butter", "peanutbutter", "nut", "nuts", "mandel", "mandeln", "almond", "almonds", "hazelnut", "hazelnuts", "walnut", "walnuts"])) {
    allergens.add("nuts");
  }
  if (containsWholeAllergenTerm(normalized, ["egg", "eggs", "ei", "eier"])) {
    allergens.add("egg");
  }
  if (containsWholeAllergenTerm(normalized, ["senf", "mustard"])) {
    allergens.add("mustard");
  }
  return [...allergens];
}

function detectDietTags(text: string): string[] {
  const normalized = text.toLowerCase();
  const tags = new Set<string>();
  if (/vegan/i.test(normalized)) {
    tags.add("vegan");
  }
  if (/(vegetarian|vegetarisch)/i.test(normalized)) {
    tags.add("vegetarian");
  }
  if (/(gluten.?free|glutenfrei)/i.test(normalized)) {
    tags.add("gluten_free");
  }
  if (/(lactose.?free|laktosefrei)/i.test(normalized)) {
    tags.add("lactose_free");
  }
  return [...tags];
}

export function parseUploadedRecipeText(input: {
  text: string;
  filename?: string;
  recipeName?: string;
  sourceRef?: string;
  sourceMetadata?: UploadSourceMetadata;
}): Recipe {
  const text = input.text.trim();
  if (!text) {
    throw new Error("Der hochgeladene Rezepttext ist leer.");
  }

  const sections = splitSections(text);
  const name = recipeNameFromText(text, input.filename, input.recipeName);
  const servings = servingsFromText(text);
  const ingredientsSource =
    sections.ingredients.length > 0 ? sections.ingredients : sections.notes.filter(isIngredientLine);
  const ingredients = ingredientsSource
    .map((line, index) => parseIngredientLine(line, index))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const stepsSource =
    sections.steps.length > 0
      ? sections.steps
      : sections.notes.filter((line) => !isIngredientLine(line)).slice(0, 12);
  const steps = (stepsSource.length > 0
    ? stepsSource
    : ["Bitte die hochgeladenen Zubereitungshinweise vor der Produktion pruefen."]).map(
    (instruction, index) => ({
      index: index + 1,
      instruction: instruction
        .replace(/^[•*-\s]+/, "")
        .replace(/^\d+[.)]\s+/, "")
        .trim()
    })
  );

  if (ingredients.length === 0) {
    throw new Error("Aus dem hochgeladenen Rezept konnten keine Zutatenzeilen extrahiert werden.");
  }

  const coverageScore = Number(
    Math.min(
      1,
      (ingredients.length > 0 ? 0.45 : 0) +
        (steps.length > 0 ? 0.35 : 0) +
        (text.length > 120 ? 0.1 : 0) +
        (sections.ingredients.length > 0 && sections.steps.length > 0 ? 0.1 : 0)
    ).toFixed(2)
  );

  return validateRecipe({
    schemaVersion: SCHEMA_VERSION,
    recipeId: `upload-${slugify(name)}-${createHash("sha1").update(`${input.filename ?? ""}:${text}`).digest("hex").slice(0, 10)}`,
    name,
    source: {
      tier: "internal_approved",
      originType: "approved_import",
      reference: input.sourceRef ?? `upload:${input.filename ?? slugify(name)}`,
      retrievedAt: new Date().toISOString(),
      approvalState: "review_required",
      qualityScore: coverageScore >= 0.8 ? 0.9 : 0.78,
      fitScore: 1,
      extractionCompleteness: coverageScore,
      licenseNote:
        "Menschlich hochgeladene interne Rezeptquelle. Automatisch extrahierte Zutaten, Allergene und Diet-Tags erfordern Review vor operativer Nutzung.",
      ...(input.sourceMetadata ? { sourceMetadata: input.sourceMetadata } : {})
    },
    baseYield: {
      servings,
      unit: "servings"
    },
    ingredients,
    steps,
    scalingRules: {
      defaultLossFactor: 1.08,
      batchSize: servings
    },
    allergens: [
      ...new Set([...detectAllergens(text), ...detectAllergens(sections.allergens.join(" "))])
    ],
    dietTags: [
      ...new Set([...detectDietTags(text), ...detectDietTags(sections.diets.join(" "))])
    ]
  });
}

export function isRecipeEligibleForOperationalPlanning(recipe: Recipe): boolean {
  return isTrustedProductionRecipe(recipe);
}

export class RecipeLibrary {
  private readonly recipes: BusinessScopedPersistentCollection<Recipe>;
  private readonly storageOptions: CollectionStorageOptions;

  constructor(options?: CollectionStorageOptions) {
    this.storageOptions = options ?? {};
    this.recipes = createBusinessScopedPersistentCollection<Recipe>({
      collectionName: "production/recipes",
      getId: (recipe) => recipe.recipeId,
      validate: validateRecipe,
      rootDir: options?.rootDir,
      databaseUrl: options?.databaseUrl,
      pgPool: options?.pgPool
    });
  }

  private async withRecipeMutationCriticalSection<T>(
    context: BusinessContext,
    recipeId: string,
    operation: (recipes: BusinessScopedPersistentCollection<Recipe>) => Promise<T>
  ): Promise<T> {
    return withBusinessTargetCriticalSection({
      storage: this.storageOptions,
      context,
      target: { kind: "production_recipe", artifactId: recipeId, revision: 0 },
      collectionNamespace: "production/case-events",
      queueFullMessage: "Die Rezept-Warteschlange benötigt eine betriebliche Bereinigung.",
      queueExhaustedMessage: "Die Rezept-Warteschlange ist ausgeschöpft.",
      timeoutMessage: "Das Rezept konnte nicht rechtzeitig gesperrt werden.",
      legacyTimeoutMessage: "Das alte Rezept konnte nicht rechtzeitig gesperrt werden.",
      postgresPoolMessage: "PostgreSQL-Rezepte benötigen einen Pool mit exklusivem Client-Checkout.",
      operation: async (transactionalQueryable?: Queryable) => {
        const recipes = transactionalQueryable
          ? createBusinessScopedPersistentCollection<Recipe>({
            collectionName: "production/recipes",
            getId: (item) => item.recipeId,
            validate: validateRecipe,
            rootDir: this.storageOptions.rootDir,
            pgPool: transactionalQueryable
          })
          : this.recipes;
        return operation(recipes);
      }
    });
  }

  /**
   * Build the collection view for a caller that already owns the canonical
   * recipe target lock (Apply). No lock is acquired here; PostgreSQL callers
   * receive the surrounding transaction's queryable collection.
   */
  createLockedMutationScope(transactionalQueryable?: Queryable): {
    get: (context: BusinessContext, recipeId: string) => Promise<Recipe | undefined>;
    set: (context: BusinessContext, recipe: Recipe) => Promise<void>;
    insert: (context: BusinessContext, recipe: Recipe) => Promise<"created" | "exists">;
    deleteIfExact: (context: BusinessContext, recipe: Recipe) => Promise<"deleted" | "conflict" | "missing">;
  } {
    const recipes = transactionalQueryable
      ? createBusinessScopedPersistentCollection<Recipe>({
        collectionName: "production/recipes",
        getId: (item) => item.recipeId,
        validate: validateRecipe,
        rootDir: this.storageOptions.rootDir,
        databaseUrl: this.storageOptions.databaseUrl,
        pgPool: transactionalQueryable
      })
      : this.recipes;
    return {
      get: (context, recipeId) => recipes.get(context, recipeId),
      set: (context, recipe) => recipes.set(context, recipe),
      insert: (context, recipe) => recipes.insert(context, recipe),
      deleteIfExact: (context, recipe) => recipes.deleteIfExact(context, recipe.recipeId, recipe)
    };
  }

  async findCandidates(
    context: BusinessContext,
    label: { label: string }
  ): Promise<Recipe[]> {
    assertRecipeBusinessContext(context);
    const rawLeftTokens = rawSearchTokens(label.label);
    const orderedLeftTokens = tokenizeSearchText(label.label);
    const leftTokens = new Set(orderedLeftTokens);
    const primaryTokens = expandQuerySpecificTokens(rawLeftTokens.slice(0, 2));
    const requiredArchetypes = deriveArchetypeTokens(label.label);
    const specificTokens = expandQuerySpecificTokens(
      rawLeftTokens.filter(
        (token) =>
          !requiredArchetypes.includes(token) &&
          !genericPrimarySearchTokens.has(token)
      )
    );
    const normalizedLabel = normalizeSearchText(label.label);

    return (await this.recipes.list(context))
      .filter(isRecipeEligibleForOperationalPlanning)
      .filter(
        (recipe) =>
          !ignoredImportedRecipePattern.test(recipe.name) &&
          !ignoredImportedRecipePattern.test(recipe.source.reference)
      )
      .map((recipe) => {
        const recipeSearchText = [recipe.name, recipe.source.reference, ...(recipe.dietTags ?? [])]
          .concat(recipe.ingredients.map((ingredient) => ingredient?.name ?? ""))
          .filter(Boolean)
          .join(" ");
        const rightTokens = new Set(tokenizeSearchText(recipeSearchText));
        const focusTokens = specificPrimaryFocusTokens(label.label);
        const recipeSpecificTokens = searchableSpecificTokens(recipeSearchText);
        const recipeNameSpecificTokens = searchableSpecificTokens(recipe.name);
        const archetypeOverlap = requiredArchetypes.filter((token) =>
          [...rightTokens].some((candidateToken) => tokensRoughlyMatch(token, candidateToken))
        ).length;
        const specificOverlap = specificTokens.filter((token) =>
          [...rightTokens].some((candidateToken) => tokensRoughlyMatch(token, candidateToken))
        ).length;
        if (requiredArchetypes.length > 0 && archetypeOverlap === 0) {
          return { recipe, score: 0 };
        }
        if (specificTokens.length > 0 && specificOverlap === 0) {
          return { recipe, score: 0 };
        }
        const overlap = [...leftTokens].filter((token) =>
          [...rightTokens].some((candidateToken) => tokensRoughlyMatch(token, candidateToken))
        ).length;
        const primaryOverlap = primaryTokens.filter((token) =>
          [...rightTokens].some((candidateToken) => tokensRoughlyMatch(token, candidateToken))
        ).length;
        const focusOverlap = focusTokens.filter((token) =>
          recipeSpecificTokens.some((candidateToken) => tokensSpecificallyMatch(token, candidateToken))
        ).length;
        if (focusTokens.length > 0 && focusOverlap === 0) {
          return { recipe, score: 0 };
        }
        const leadSpecificToken = leadSpecificPrimaryToken(label.label);
        const leadNameBoost =
          leadSpecificToken &&
          recipeNameSpecificTokens.some((candidateToken) =>
            tokensSpecificallyMatch(leadSpecificToken, candidateToken)
          )
            ? 0.3
            : 0;
        const leadingBoost = normalizeSearchText(recipe.name).includes(primaryTokens[0] ?? "")
          ? 0.2
          : normalizeSearchText(recipe.source.reference).includes(primaryTokens[0] ?? "")
            ? 0.1
            : 0;
        const phraseBoost =
          primaryTokens.length >= 2 &&
          normalizeSearchText(recipeSearchText).includes(primaryTokens.join(" "))
            ? 0.15
            : 0;
        const broadMatchPenalty =
          primaryOverlap === 0 && !normalizeSearchText(recipeSearchText).includes(normalizedLabel.split(" ")[0] ?? "")
            ? 0.1
            : 0;
        const score =
          overlap === 0
            ? 0
            : overlap / Math.max(leftTokens.size, 1) +
              archetypeOverlap * 0.25 +
              specificOverlap * 0.2 +
              primaryOverlap * 0.35 +
              (focusTokens.length > 0 ? (focusOverlap / focusTokens.length) * 0.45 : 0) +
              leadNameBoost +
              leadingBoost +
              phraseBoost -
              broadMatchPenalty;
        return { recipe, score };
      })
      .filter((item) => item.score >= 0.25)
      .sort((left, right) => right.score - left.score)
      .map((item) => item.recipe);
  }

  async save(context: BusinessContext, recipe: Recipe): Promise<void> {
    assertRecipeBusinessContext(context);
    await this.withRecipeMutationCriticalSection(context, recipe.recipeId, (recipes) =>
      recipes.set(context, recipe)
    );
  }

  async insert(context: BusinessContext, recipe: Recipe): Promise<"created" | "exists"> {
    assertRecipeBusinessContext(context);
    return this.withRecipeMutationCriticalSection(context, recipe.recipeId, (recipes) =>
      recipes.insert(context, recipe)
    );
  }

  /**
   * Apply already owns the canonical recipe target lock. These methods deliberately
   * bypass re-locking while retaining the same collection validation/transaction.
   */
  async saveWhileLocked(context: BusinessContext, recipe: Recipe): Promise<void> {
    assertRecipeBusinessContext(context);
    await this.recipes.set(context, recipe);
  }

  async insertWhileLocked(context: BusinessContext, recipe: Recipe): Promise<"created" | "exists"> {
    assertRecipeBusinessContext(context);
    return this.recipes.insert(context, recipe);
  }

  async get(context: BusinessContext, recipeId: string): Promise<Recipe | undefined> {
    assertRecipeBusinessContext(context);
    return this.recipes.get(context, recipeId);
  }

  async deleteIfExact(
    context: BusinessContext,
    recipe: Recipe
  ): Promise<"deleted" | "conflict" | "missing"> {
    assertRecipeBusinessContext(context);
    return this.withRecipeMutationCriticalSection(context, recipe.recipeId, (recipes) =>
      recipes.deleteIfExact(context, recipe.recipeId, recipe)
    );
  }

  async deleteIfExactWhileLocked(
    context: BusinessContext,
    recipe: Recipe
  ): Promise<"deleted" | "conflict" | "missing"> {
    assertRecipeBusinessContext(context);
    return this.recipes.deleteIfExact(context, recipe.recipeId, recipe);
  }

  async reviewRecipe(
    context: BusinessContext,
    recipeId: string,
    input: {
      decision: RecipeReviewDecision;
      note?: string;
    }
  ): Promise<Recipe> {
    assertRecipeBusinessContext(context);
    return this.withRecipeMutationCriticalSection(context, recipeId, async (recipes) => {
      const recipe = await recipes.get(context, recipeId);
      if (!recipe) {
        throw new Error(`Rezept ${recipeId} wurde nicht gefunden.`);
      }

      const source = { ...recipe.source };
      if (input.decision === "approve") {
        source.approvalState = "approved_internal";
        source.tier =
          source.tier === "internal_verified" ? "internal_verified" : "internal_approved";
        source.qualityScore = Math.max(source.qualityScore, 0.85);
        source.fitScore = Math.max(source.fitScore, 0.85);
        source.extractionCompleteness = Math.max(source.extractionCompleteness, 0.9);
      } else if (input.decision === "verify") {
        source.approvalState = "approved_internal";
        source.tier = "internal_verified";
        source.qualityScore = Math.max(source.qualityScore, 0.95);
        source.fitScore = Math.max(source.fitScore, 0.9);
        source.extractionCompleteness = Math.max(source.extractionCompleteness, 0.95);
      } else {
        source.approvalState = "rejected";
      }

      source.licenseNote = [
        recipe.source.licenseNote,
        `Review-Entscheidung: ${input.decision}.`,
        input.note?.trim()
      ]
        .filter(Boolean)
        .join(" ");

      const reviewed = validateRecipe({
        ...recipe,
        source
      });

      await recipes.set(context, reviewed);
      return reviewed;
    });
  }

  async list(context: BusinessContext): Promise<Recipe[]> {
    assertRecipeBusinessContext(context);
    return this.recipes.list(context);
  }

  async seed(context: BusinessContext, recipes: readonly Recipe[]): Promise<void> {
    assertRecipeBusinessContext(context);
    for (const recipe of recipes) {
      await this.withRecipeMutationCriticalSection(context, recipe.recipeId, (lockedRecipes) =>
        lockedRecipes.insert(context, recipe)
      );
    }
  }
}

function assertRecipeBusinessContext(context: BusinessContext): void {
  if (!context || typeof context.businessId !== "string" || context.businessId.trim().length === 0) {
    throw new Error("Ein nicht leerer Betriebskontext ist erforderlich.");
  }
}
