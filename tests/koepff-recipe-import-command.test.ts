import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { RecipeLibrary } from "@catering/shared-core";

interface KoepffImportResult {
  seedDir: string;
  dataRoot: string;
  importedCount: number;
  updatedCount: number;
  skippedSameNameCount: number;
  imported: string[];
  updated: string[];
  skippedSameName: string[];
}

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "koepff-recipe-import-command-"));
}

function parseImportResult(output: string): KoepffImportResult {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Köpff import command did not return JSON: ${output}`);
  }

  return JSON.parse(output.slice(start, end + 1)) as KoepffImportResult;
}

function runKoepffImport(dataRoot: string): KoepffImportResult {
  const output = execFileSync("npm", ["run", "--silent", "import:recipes:koepff"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CATERING_DATA_ROOT: dataRoot
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  return parseImportResult(output);
}

describe("Köpff recipe import command", () => {
  const dataRoots: string[] = [];

  afterEach(() => {
    for (const dataRoot of dataRoots.splice(0)) {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });

  it("imports the eleven review-required Köpff recipes idempotently through the npm command", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);

    const firstRun = runKoepffImport(dataRoot);
    const secondRun = runKoepffImport(dataRoot);
    const recipes = await new RecipeLibrary(undefined, { rootDir: dataRoot }).list();

    expect(firstRun).toMatchObject({
      seedDir: "recipes-koepff",
      dataRoot,
      importedCount: 11,
      updatedCount: 0,
      skippedSameNameCount: 0
    });
    expect(firstRun.imported).toHaveLength(11);

    expect(secondRun).toMatchObject({
      seedDir: "recipes-koepff",
      dataRoot,
      importedCount: 0,
      updatedCount: 11,
      skippedSameNameCount: 0
    });
    expect(secondRun.updated).toEqual(firstRun.imported);

    const koepffRecipes = recipes.filter((recipe) => recipe.recipeId.startsWith("koepff-"));
    expect(koepffRecipes.map((recipe) => recipe.recipeId).sort()).toEqual(firstRun.imported);
    expect(koepffRecipes.map((recipe) => recipe.source.approvalState)).toEqual(
      Array.from({ length: 11 }, () => "review_required")
    );
  });
});
