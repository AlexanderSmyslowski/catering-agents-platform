import { readdir, readFile } from "node:fs/promises";
import { basename } from "node:path";
import { RecipeLibrary, validateRecipe, type Recipe } from "@catering/shared-core";

const SEED_DIR = new URL("../data-seeds/recipes-koepff/", import.meta.url);

function normalizeName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function loadSeedRecipes(): Promise<Recipe[]> {
  const filenames = (await readdir(SEED_DIR))
    .filter((entry) => entry.endsWith(".json"))
    .sort((left, right) => left.localeCompare(right));

  return Promise.all(
    filenames.map(async (filename) => {
      const parsed = JSON.parse(await readFile(new URL(filename, SEED_DIR), "utf8")) as Recipe;
      return validateRecipe(parsed);
    })
  );
}

async function main() {
  const dataRoot = process.env.CATERING_DATA_ROOT || "./data";
  const databaseUrl = process.env.CATERING_DATABASE_URL;
  const context = { businessId: process.env.CATERING_BUSINESS_ID || "local" };
  const library = new RecipeLibrary(undefined, {
    rootDir: dataRoot,
    databaseUrl
  });
  const existingRecipes = await library.list(context);
  const existingIds = new Set(existingRecipes.map((recipe) => recipe.recipeId));
  const existingNames = new Map(existingRecipes.map((recipe) => [normalizeName(recipe.name), recipe.recipeId]));

  const imported: string[] = [];
  const updated: string[] = [];
  const skippedSameName: string[] = [];

  for (const seed of await loadSeedRecipes()) {
    const sameNameId = existingNames.get(normalizeName(seed.name));
    if (sameNameId && sameNameId !== seed.recipeId) {
      skippedSameName.push(`${seed.name} <- ${sameNameId}`);
      continue;
    }

    await library.save(context, seed);
    if (existingIds.has(seed.recipeId)) {
      updated.push(seed.recipeId);
    } else {
      imported.push(seed.recipeId);
    }
  }

  console.log(
    JSON.stringify(
      {
        seedDir: basename(SEED_DIR.pathname),
        dataRoot,
        businessId: context.businessId,
        importedCount: imported.length,
        updatedCount: updated.length,
        skippedSameNameCount: skippedSameName.length,
        imported,
        updated,
        skippedSameName
      },
      null,
      2
    )
  );
}

await main();
