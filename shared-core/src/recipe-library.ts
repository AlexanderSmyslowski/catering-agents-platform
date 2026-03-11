import { createHash } from "node:crypto";
import path from "node:path";
import {
  createPersistentCollection,
  type CollectionStorageOptions,
  type PersistentCollection
} from "./persistence.js";
import { internalRecipes } from "./fixtures/sample-data.js";
import { ingredientGroupHints, unitNormalization } from "./taxonomies/defaults.js";
import {
  SCHEMA_VERSION,
  type Recipe,
  type RecipeReviewDecision
} from "./types.js";
import { validateRecipe } from "./validation.js";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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

  if (!cleaned) {
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
  return /^[•*-\s]*[\d.,/]+\s*(kg|g|ml|l|pcs|stück|stueck|el|tl)?\s+\S+/i.test(line.trim());
}

function isInstructionLine(line: string): boolean {
  return /^\d+[.)]\s+/.test(line.trim()) || /^(mix|cook|bake|serve|prepare|wash|cut|add|stir|boil|roast|mischen|kochen|backen|servieren|vorbereiten|schneiden|zugeben|ruehren|rühren)/i.test(line.trim());
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
    if (/^(zutaten|ingredients?)[:]?$/i.test(line)) {
      mode = "ingredients";
      continue;
    }
    if (/^(zubereitung|anleitung|methode|steps?|instructions?|method)[:]?$/i.test(line)) {
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
      !/^(zutaten|ingredients?|zubereitung|anleitung|methode|steps?|instructions?|method|allergene?|allergens?|diet|diets?)[:]?$/i.test(
        line
      )
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
  const match =
    text.match(/(\d{1,3})\s*(portionen|portions|servings|personen|gaeste|gäste|people)/i) ??
    text.match(/yield\s*[:\-]?\s*(\d{1,3})/i);
  return match ? Number(match[1]) : 8;
}

function detectAllergens(text: string): string[] {
  const normalized = text.toLowerCase();
  const allergens = new Set<string>();
  if (/(milch|milk|butter|cream|parmesan|cheese)/i.test(normalized)) {
    allergens.add("milk");
  }
  if (/(weizen|flour|bread|brot|croissant|pasta|croutons)/i.test(normalized)) {
    allergens.add("gluten");
  }
  if (/(nuss|nut|almond|hazelnut|walnut)/i.test(normalized)) {
    allergens.add("nuts");
  }
  if (/(egg|ei\b)/i.test(normalized)) {
    allergens.add("egg");
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
      approvalState: "approved_internal",
      qualityScore: coverageScore >= 0.8 ? 0.9 : 0.78,
      fitScore: 1,
      extractionCompleteness: coverageScore,
      licenseNote: "Menschlich hochgeladene interne Rezeptquelle."
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

export class RecipeLibrary {
  private readonly recipes: PersistentCollection<Recipe>;

  constructor(
    seed: Recipe[] | undefined = internalRecipes,
    options?: CollectionStorageOptions
  ) {
    this.recipes = createPersistentCollection<Recipe>({
      collectionName: "production/recipes",
      getId: (recipe) => recipe.recipeId,
      validate: validateRecipe,
      rootDir: options?.rootDir,
      databaseUrl: options?.databaseUrl,
      pgPool: options?.pgPool,
      seed: seed ?? internalRecipes
    });
  }

  async findCandidates(label: { label: string }): Promise<Recipe[]> {
    const leftTokens = new Set(
      label.label
        .toLowerCase()
        .split(/[^a-z0-9äöüß]+/i)
        .filter(Boolean)
    );

    return (await this.recipes.list())
      .filter((recipe) =>
        recipe.source.approvalState === "approved_internal" ||
        recipe.source.approvalState === "auto_usable"
      )
      .map((recipe) => {
        const rightTokens = new Set(
          recipe.name
            .toLowerCase()
            .split(/[^a-z0-9äöüß]+/i)
            .filter(Boolean)
        );
        const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
        const score = overlap === 0 ? 0 : overlap / Math.max(leftTokens.size, rightTokens.size);
        return { recipe, score };
      })
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .map((item) => item.recipe);
  }

  async save(recipe: Recipe): Promise<void> {
    await this.recipes.set(recipe);
  }

  async get(recipeId: string): Promise<Recipe | undefined> {
    return this.recipes.get(recipeId);
  }

  async reviewRecipe(
    recipeId: string,
    input: {
      decision: RecipeReviewDecision;
      note?: string;
    }
  ): Promise<Recipe> {
    const recipe = await this.get(recipeId);
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

    await this.save(reviewed);
    return reviewed;
  }

  async list(): Promise<Recipe[]> {
    return this.recipes.list();
  }
}
