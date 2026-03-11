import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  extractTextFromDocument,
  parseUploadedRecipeText,
  RecipeLibrary
} from "@catering/shared-core";

const defaultSourceRoot =
  "/Users/alexandersmyslowski/Library/Mobile Documents/com~apple~CloudDocs/Dateien/THE ONE von Alexander/Buchhaltung/Caterings";

const supportedExtensions = new Set([".pdf", ".pages", ".txt", ".md", ".eml"]);
const filenameRecipePattern =
  /(quiche|sauce|sosse|soße|salat|suppe|kuchen|cake|curry|gnocchi|moussaka|muffins?|pesto|creme|auflauf|ochsenb|coq au vin|humus|hummus|smoothie|chili|minestrone|focaccia|bratlinge|buletten|sauerkraut|kartoffel|spatzle|spätzle|ricotta|tortellini|rote beete|romesco|edamame|lachsseite|pfifferlinge|apfelkuchen|kaesekuchen|käsekuchen|gratin|eggplant)/i;
const ignoredFilenamePattern =
  /(angebot|rechnung|getr[aä]nk|equipment|personal|stunden|abrechnung|kalkulation|verf[uü]gbarkeit|erkl[aä]rung|zusammenfassung|cost calculation|to do|todo|bestellmengen|gespr[aä]chsnotiz|aufplanung|begleitschreiben|fehlmengen|bedarfs|produktionsblatt|abschiebeplan|bleche[- ]?gn[- ]?plan|standing reception|paschtu)/i;

type CandidateFile = {
  fullPath: string;
  basename: string;
  extension: string;
  groupKey: string;
  priority: number;
};

function normalizeKey(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(gn|pax|portionen?|servings?|pages?)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatPriority(extension: string): number {
  if (extension === ".pdf") {
    return 5;
  }
  if (extension === ".pages") {
    return 4;
  }
  if (extension === ".md") {
    return 3;
  }
  if (extension === ".txt") {
    return 2;
  }
  if (extension === ".eml") {
    return 1;
  }
  return 0;
}

function mimeTypeForExtension(extension: string): string {
  switch (extension) {
    case ".pdf":
      return "application/pdf";
    case ".pages":
      return "application/vnd.apple.pages";
    case ".md":
    case ".txt":
      return "text/plain";
    case ".eml":
      return "message/rfc822";
    default:
      return "application/octet-stream";
  }
}

function isLikelyRecipeFile(fullPath: string): boolean {
  const basename = path.basename(fullPath);
  const extension = path.extname(basename).toLowerCase();
  if (!supportedExtensions.has(extension)) {
    return false;
  }

  if (basename.startsWith(".") || ignoredFilenamePattern.test(basename)) {
    return false;
  }

  if (/\/rezepte?\//i.test(fullPath)) {
    return true;
  }

  return filenameRecipePattern.test(basename);
}

async function collectCandidateFiles(rootDir: string): Promise<CandidateFile[]> {
  const collected: CandidateFile[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      if (!entry.isFile() || !isLikelyRecipeFile(fullPath)) {
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      const basename = path.basename(entry.name, extension);
      collected.push({
        fullPath,
        basename,
        extension,
        groupKey: normalizeKey(basename),
        priority: formatPriority(extension)
      });
    }
  }

  await walk(rootDir);
  return collected;
}

function choosePreferredFiles(files: CandidateFile[]): CandidateFile[] {
  const byKey = new Map<string, CandidateFile>();

  for (const file of files.sort((left, right) => right.priority - left.priority)) {
    const current = byKey.get(file.groupKey);
    if (!current) {
      byKey.set(file.groupKey, file);
      continue;
    }

    if (file.priority > current.priority) {
      byKey.set(file.groupKey, file);
    }
  }

  return [...byKey.values()].sort((left, right) => left.basename.localeCompare(right.basename, "de"));
}

async function main(): Promise<void> {
  const rootDir = process.argv[2] ?? defaultSourceRoot;
  const dataRoot = process.env.CATERING_DATA_ROOT || "./data";
  const library = new RecipeLibrary(undefined, { rootDir: dataRoot });
  const candidates = choosePreferredFiles(await collectCandidateFiles(rootDir));

  const imported: string[] = [];
  const skipped: string[] = [];
  const failed: Array<{ file: string; reason: string }> = [];

  for (const file of candidates) {
    try {
      const content = await readFile(file.fullPath);
      const text = await extractTextFromDocument({
        filename: path.basename(file.fullPath),
        mimeType: mimeTypeForExtension(file.extension),
        content
      });

      if (text.trim().length < 120) {
        skipped.push(`${file.basename} (zu wenig Text extrahiert)`);
        continue;
      }

      const recipe = parseUploadedRecipeText({
        text,
        filename: path.basename(file.fullPath),
        recipeName: file.basename,
        sourceRef: file.fullPath
      });

      await library.save(recipe);
      imported.push(`${recipe.name} <- ${file.fullPath}`);
    } catch (error) {
      failed.push({
        file: file.fullPath,
        reason: error instanceof Error ? error.message : String(error)
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        rootDir,
        dataRoot,
        scannedCandidates: candidates.length,
        importedCount: imported.length,
        skippedCount: skipped.length,
        failedCount: failed.length,
        imported,
        skipped,
        failed
      },
      null,
      2
    )
  );
}

await main();
