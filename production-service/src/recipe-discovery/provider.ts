import { createHash } from "node:crypto";
import { Readability } from "@mozilla/readability";
import { JSDOM, VirtualConsole } from "jsdom";
import {
  ingredientGroupHints,
  SCHEMA_VERSION,
  type AcceptedEventSpec,
  type IngredientLine,
  type MenuComponent,
  type Recipe,
  type RecipeSearchQuery,
  type WebRecipeCandidate
} from "@catering/shared-core";

export interface WebRecipeSearchProvider {
  searchRecipes(query: RecipeSearchQuery): Promise<WebRecipeCandidate[]>;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeIngredientName(value: string): string {
  return value
    .toLowerCase()
    .replace(/^[\d.,/]+\s*(g|kg|ml|l|el|tl|pcs|stück|stueck)?\s*/i, "")
    .trim();
}

function ingredientGroupFor(name: string): string {
  const normalized = normalizeIngredientName(name);
  const match = Object.entries(ingredientGroupHints).find(([keyword]) =>
    normalized.includes(keyword)
  );
  return match?.[1] ?? "misc";
}

function parseIngredientLine(line: string, index: number): IngredientLine | undefined {
  const normalized = line.trim();
  if (!normalized) {
    return undefined;
  }

  const match = normalized.match(
    /^([\d.,/]+)?\s*(kg|g|ml|l|pcs|stück|stueck)?\s*(.+)$/i
  );

  const amount = match?.[1] ? Number(match[1].replace(",", ".")) : 1;
  const unit = match?.[2]?.toLowerCase() ?? "pcs";
  const name = match?.[3]?.trim() ?? normalized;

  return {
    ingredientId: `${slugify(name)}-${index + 1}`,
    name,
    quantity: {
      amount: Number.isFinite(amount) ? amount : 1,
      unit
    },
    group: ingredientGroupFor(name),
    purchaseUnit: unit,
    normalizedUnit: unit
  };
}

function parseInstructions(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === "string") {
        return [item];
      }

      if (item && typeof item === "object") {
        if ("text" in item && typeof item.text === "string") {
          return [item.text];
        }

        if (
          "itemListElement" in item &&
          Array.isArray((item as { itemListElement?: unknown[] }).itemListElement)
        ) {
          return parseInstructions((item as { itemListElement?: unknown[] }).itemListElement);
        }
      }

      return [];
    });
  }

  if (typeof value === "string") {
    return value
      .split(/\n|\.\s+/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  return [];
}

function parseYieldServings(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const match = value.match(/(\d{1,3})/);
    return match ? Number(match[1]) : undefined;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const parsed = parseYieldServings(entry);
      if (parsed) {
        return parsed;
      }
    }
  }

  if (value && typeof value === "object" && "value" in value) {
    return parseYieldServings((value as { value?: unknown }).value);
  }

  return undefined;
}

function flattenJsonLd(input: unknown): Record<string, unknown>[] {
  if (!input) {
    return [];
  }

  if (Array.isArray(input)) {
    return input.flatMap((item) => flattenJsonLd(item));
  }

  if (typeof input === "object") {
    const record = input as Record<string, unknown>;
    if (Array.isArray(record["@graph"])) {
      return flattenJsonLd(record["@graph"]);
    }

    return [record];
  }

  return [];
}

function findRecipeJsonLd(document: Document): Record<string, unknown> | undefined {
  const scripts = [...document.querySelectorAll('script[type="application/ld+json"]')];
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script.textContent ?? "null");
      const flattened = flattenJsonLd(parsed);
      const recipe = flattened.find((item) => {
        const type = item["@type"];
        return type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"));
      });

      if (recipe) {
        return recipe;
      }
    } catch {
      continue;
    }
  }

  return undefined;
}

function extractRecipeFromArticle(document: Document): {
  title: string;
  ingredients: string[];
  instructions: string[];
} | undefined {
  const article = new Readability(document).parse();
  if (!article?.textContent) {
    return undefined;
  }

  const sections = article.textContent.split(/\n/).map((line) => line.trim()).filter(Boolean);
  const ingredients = sections.filter((line) => /[\d.,]+\s*(g|kg|ml|l|pcs|stück)/i.test(line)).slice(0, 20);
  const instructions = sections.filter((line) => line.length > 40).slice(0, 10);

  if (ingredients.length === 0 || instructions.length === 0) {
    return undefined;
  }

  return {
    title: article.title ?? "Extracted recipe",
    ingredients,
    instructions
  };
}

export function candidateToRecipe(
  candidate: WebRecipeCandidate,
  component: MenuComponent,
  eventSpec: AcceptedEventSpec,
  locale: "de" | "en",
  scores: {
    qualityScore: number;
    fitScore: number;
    extractionCompleteness: number;
    autoUsable: boolean;
  }
): Recipe | undefined {
  const partial = candidate.recipe;
  if (!partial?.ingredients || !partial.steps || !partial.baseYield || !partial.name) {
    return undefined;
  }

  const inferredDietTags = new Set(partial.dietTags ?? []);
  if (component.menuCategory === "vegan") {
    inferredDietTags.add("vegan");
  } else if (component.menuCategory === "vegetarian") {
    inferredDietTags.add("vegetarian");
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    recipeId: `web-${slugify(partial.name)}-${createHash("sha1").update(candidate.url).digest("hex").slice(0, 8)}`,
    name: partial.name,
    source: {
      tier: "internet_fallback",
      originType: "web",
      reference: `web:${component.componentId}:${locale}`,
      url: candidate.url,
      publisher: candidate.publisher ?? candidate.title,
      retrievedAt: new Date().toISOString(),
      approvalState: scores.autoUsable ? "auto_usable" : "review_required",
      qualityScore: scores.qualityScore,
      fitScore: scores.fitScore,
      extractionCompleteness: scores.extractionCompleteness,
      licenseNote: "Extern recherchierte Quelle, intern review-pflichtig dokumentiert."
    },
    baseYield: partial.baseYield,
    ingredients: partial.ingredients,
    steps: partial.steps,
    scalingRules: partial.scalingRules ?? {
      defaultLossFactor: eventSpec.servicePlan.serviceForm === "buffet" ? 1.08 : 1.05,
      batchSize: partial.baseYield.servings
    },
    allergens: partial.allergens ?? [],
    dietTags: [...inferredDietTags]
  };
}

export async function fetchRecipeCandidateFromUrl(url: string): Promise<WebRecipeCandidate | undefined> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(5000),
    headers: {
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) CateringAgentsBot/0.1",
      "accept-language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7"
    }
  });

  if (!response.ok) {
    return undefined;
  }

  const html = await response.text();
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", () => undefined);
  const dom = new JSDOM(html, {
    url,
    virtualConsole
  });

  const jsonLdRecipe = findRecipeJsonLd(dom.window.document);
  if (jsonLdRecipe) {
    const ingredients = Array.isArray(jsonLdRecipe.recipeIngredient)
      ? jsonLdRecipe.recipeIngredient
          .map((item, index) =>
            typeof item === "string" ? parseIngredientLine(item, index) : undefined
          )
          .filter((item): item is IngredientLine => Boolean(item))
      : [];

    const instructions = parseInstructions(jsonLdRecipe.recipeInstructions).map((instruction, index) => ({
      index: index + 1,
      instruction
    }));

    const servings = parseYieldServings(jsonLdRecipe.recipeYield);

    return {
      url,
      title:
        typeof jsonLdRecipe.name === "string"
          ? jsonLdRecipe.name
          : dom.window.document.title || new URL(url).hostname,
      publisher:
        typeof jsonLdRecipe.author === "object" && jsonLdRecipe.author
          ? String((jsonLdRecipe.author as { name?: string }).name ?? "")
          : undefined,
      recipe: {
        schemaVersion: SCHEMA_VERSION,
        recipeId: "",
        name:
          typeof jsonLdRecipe.name === "string"
            ? jsonLdRecipe.name
            : dom.window.document.title,
        source: undefined,
        baseYield: {
          servings: servings ?? 8,
          unit: "servings"
        },
        ingredients,
        steps: instructions,
        scalingRules: {
          defaultLossFactor: 1.08,
          batchSize: servings ?? 8
        },
        allergens: [],
        dietTags: []
      },
      qualitySignals: {
        structuredData: true,
        hasYield: Boolean(servings),
        ingredientCount: ingredients.length,
        stepCount: instructions.length,
        mappedIngredientRatio:
          ingredients.length === 0
            ? 0
            : ingredients.filter((ingredient) => ingredient.group !== "misc").length /
              ingredients.length
      }
    };
  }

  const fallback = extractRecipeFromArticle(dom.window.document);
  if (!fallback) {
    return undefined;
  }

  const ingredients = fallback.ingredients
    .map((line, index) => parseIngredientLine(line, index))
    .filter((item): item is IngredientLine => Boolean(item));
  const instructions = fallback.instructions.map((instruction, index) => ({
    index: index + 1,
    instruction
  }));

  return {
      url,
      title: fallback.title || new URL(url).hostname,
    recipe: {
      schemaVersion: SCHEMA_VERSION,
      recipeId: "",
      name: fallback.title,
      source: undefined,
      baseYield: {
        servings: 8,
        unit: "servings"
      },
      ingredients,
      steps: instructions,
      scalingRules: {
        defaultLossFactor: 1.08,
        batchSize: 8
      },
      allergens: [],
      dietTags: []
    },
    qualitySignals: {
      structuredData: false,
      hasYield: false,
      ingredientCount: ingredients.length,
      stepCount: instructions.length,
      mappedIngredientRatio:
        ingredients.length === 0
          ? 0
          : ingredients.filter((ingredient) => ingredient.group !== "misc").length /
            ingredients.length
    }
  };
}
