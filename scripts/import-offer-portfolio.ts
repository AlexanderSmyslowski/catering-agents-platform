import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";

const DEFAULT_SOURCE_PATH = `${homedir()}/Documents/Alexander-Wiki/catering/app-transfer/angebote_portfolio_2026-06-01/angebotskatalog_1_0_app_transfer.json`;
const TARGET_URL = new URL("../shared-core/src/fixtures/curated-offer-packages.json", import.meta.url);

interface SourcePortfolioItem {
  id?: unknown;
  name?: unknown;
  event_types?: unknown;
  price_band_pp?: unknown;
  min_pax?: unknown;
  food_modules?: unknown;
  service_modules?: unknown;
  cluster?: unknown;
  review_status?: unknown;
  source_evidence?: {
    records_cluster_total?: unknown;
    records_cluster_2025_2026?: unknown;
  };
}

interface CuratedOfferPackageFixtureItem {
  id: string;
  name: string;
  price_band_pp: [number, number];
  min_pax: number;
  food_modules: string[];
  service_modules: string[];
  event_types: string[];
  cluster: string;
  review_status: unknown;
  source_evidence: {
    records_cluster_total?: number;
    records_cluster_2025_2026?: number;
  };
}

function expandPath(input: string): string {
  if (input === "~") {
    return homedir();
  }
  if (input.startsWith("~/")) {
    return `${homedir()}${input.slice(1)}`;
  }
  return resolve(input);
}

function fail(message: string): never {
  throw new Error(`import-offer-portfolio: ${message}`);
}

function itemLabel(item: SourcePortfolioItem, index: number): string {
  return typeof item.id === "string" && item.id.trim() ? item.id : `portfolio_items[${index}]`;
}

function requiredString(item: SourcePortfolioItem, index: number, field: keyof SourcePortfolioItem): string {
  const value = item[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`${itemLabel(item, index)}: Pflichtfeld ${String(field)} fehlt oder ist leer.`);
  }
  return value.trim();
}

function optionalString(item: SourcePortfolioItem, field: keyof SourcePortfolioItem): string {
  const value = item[field];
  return typeof value === "string" ? value.trim() : "";
}

function requiredNumber(item: SourcePortfolioItem, index: number, field: keyof SourcePortfolioItem): number {
  const value = item[field];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(`${itemLabel(item, index)}: Pflichtfeld ${String(field)} fehlt oder ist leer.`);
  }
  return value;
}

function requiredStringArray(
  item: SourcePortfolioItem,
  index: number,
  field: keyof SourcePortfolioItem
): string[] {
  const value = item[field];
  if (!Array.isArray(value)) {
    fail(`${itemLabel(item, index)}: Pflichtfeld ${String(field)} fehlt oder ist leer.`);
  }
  const entries = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length === 0 || entries.length !== value.length) {
    fail(`${itemLabel(item, index)}: Pflichtfeld ${String(field)} fehlt oder ist leer.`);
  }
  return entries;
}

function requiredPriceBand(item: SourcePortfolioItem, index: number): [number, number] {
  const value = item.price_band_pp;
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    typeof value[0] !== "number" ||
    typeof value[1] !== "number" ||
    !Number.isFinite(value[0]) ||
    !Number.isFinite(value[1]) ||
    value[0] >= value[1]
  ) {
    fail(`${itemLabel(item, index)}: Pflichtfeld price_band_pp fehlt oder ist leer.`);
  }
  return [value[0], value[1]];
}

function optionalEvidence(item: SourcePortfolioItem): CuratedOfferPackageFixtureItem["source_evidence"] {
  const evidence = item.source_evidence ?? {};
  return {
    ...(typeof evidence.records_cluster_total === "number"
      ? { records_cluster_total: evidence.records_cluster_total }
      : {}),
    ...(typeof evidence.records_cluster_2025_2026 === "number"
      ? { records_cluster_2025_2026: evidence.records_cluster_2025_2026 }
      : {})
  };
}

function toFixtureItem(item: SourcePortfolioItem, index: number): CuratedOfferPackageFixtureItem {
  return {
    id: requiredString(item, index, "id"),
    name: requiredString(item, index, "name"),
    price_band_pp: requiredPriceBand(item, index),
    min_pax: requiredNumber(item, index, "min_pax"),
    food_modules: requiredStringArray(item, index, "food_modules"),
    service_modules: requiredStringArray(item, index, "service_modules"),
    event_types: Array.isArray(item.event_types)
      ? item.event_types.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      : [],
    cluster: optionalString(item, "cluster"),
    review_status: item.review_status ?? {},
    source_evidence: optionalEvidence(item)
  };
}

function main() {
  const sourcePath = expandPath(process.argv[2] ?? DEFAULT_SOURCE_PATH);
  if (!existsSync(sourcePath)) {
    fail(`Quelle nicht gefunden: ${sourcePath}`);
  }

  const parsed = JSON.parse(readFileSync(sourcePath, "utf8")) as { portfolio_items?: unknown };
  if (!Array.isArray(parsed.portfolio_items)) {
    fail("Quelle enthaelt kein Array portfolio_items.");
  }

  const items = parsed.portfolio_items
    .map((item, index) => toFixtureItem(item as SourcePortfolioItem, index))
    .sort((left, right) => left.id.localeCompare(right.id));

  const targetPath = TARGET_URL.pathname;
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, `${JSON.stringify(items, null, 2)}\n`);
  console.log(`Wrote ${items.length} curated offer packages to ${targetPath}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
