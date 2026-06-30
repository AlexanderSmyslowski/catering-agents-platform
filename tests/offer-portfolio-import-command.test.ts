import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

interface ImportedOfferPackage {
  id: string;
  name: string;
  price_band_pp: [number, number];
  min_pax: number;
  food_modules: string[];
  service_modules: string[];
  event_types: string[];
  cluster: string;
  review_status: unknown;
  source_evidence: Record<string, unknown>;
}

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "offer-portfolio-import-command-"));
}

function runOfferPortfolioImport(sourcePath: string, targetPath: string): string {
  return execFileSync("npm", ["run", "--silent", "import:offer-portfolio", "--", sourcePath], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CATERING_OFFER_PORTFOLIO_TARGET: targetPath
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

describe("offer portfolio import command", () => {
  const dataRoots: string[] = [];

  afterEach(() => {
    for (const dataRoot of dataRoots.splice(0)) {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });

  it("writes sorted curated offer packages to the configured target path", () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const sourcePath = path.join(dataRoot, "source.json");
    const targetPath = path.join(dataRoot, "curated-offer-packages.json");
    writeFileSync(
      sourcePath,
      JSON.stringify({
        portfolio_items: [
          {
            id: "uni_late_package",
            name: "Late Package",
            price_band_pp: [30, 45],
            min_pax: 30,
            food_modules: ["Lunch"],
            service_modules: ["Lieferung"],
            event_types: ["Lunch"],
            cluster: "Testcluster",
            review_status: { state: "reviewed" },
            source_evidence: {
              records_cluster_total: 12,
              records_cluster_2025_2026: 5,
              marker_records: ["must not leak"]
            }
          },
          {
            id: "business_early_package",
            name: "Early Package",
            price_band_pp: [12, 18],
            min_pax: 12,
            food_modules: ["Snack"],
            service_modules: ["Abholung"],
            event_types: ["Meeting"],
            cluster: "Testcluster",
            review_status: { state: "draft" },
            source_evidence: {
              records_cluster_total: 4,
              records_cluster_2025_2026: 2,
              marker_records: ["must not leak"]
            }
          }
        ]
      }),
      "utf8"
    );

    const output = runOfferPortfolioImport(sourcePath, targetPath);
    const imported = JSON.parse(readFileSync(targetPath, "utf8")) as ImportedOfferPackage[];

    expect(output).toContain(`Wrote 2 curated offer packages to ${targetPath}`);
    expect(imported.map((item) => item.id)).toEqual([
      "business_early_package",
      "uni_late_package"
    ]);
    expect(imported[0]).toMatchObject({
      id: "business_early_package",
      name: "Early Package",
      price_band_pp: [12, 18],
      min_pax: 12,
      food_modules: ["Snack"],
      service_modules: ["Abholung"],
      event_types: ["Meeting"],
      cluster: "Testcluster",
      review_status: { state: "draft" },
      source_evidence: {
        records_cluster_total: 4,
        records_cluster_2025_2026: 2
      }
    });
    expect(Object.keys(imported[0].source_evidence)).toEqual([
      "records_cluster_total",
      "records_cluster_2025_2026"
    ]);
  });

  it("fails clearly when a required source field is missing", () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const sourcePath = path.join(dataRoot, "invalid-source.json");
    const targetPath = path.join(dataRoot, "curated-offer-packages.json");
    writeFileSync(
      sourcePath,
      JSON.stringify({
        portfolio_items: [
          {
            id: "broken_package",
            name: "Broken Package",
            price_band_pp: [12, 18],
            min_pax: 12,
            food_modules: [],
            service_modules: ["Lieferung"]
          }
        ]
      }),
      "utf8"
    );

    expect(() => runOfferPortfolioImport(sourcePath, targetPath)).toThrow(
      /broken_package: Pflichtfeld food_modules fehlt oder ist leer/
    );
  });
});
