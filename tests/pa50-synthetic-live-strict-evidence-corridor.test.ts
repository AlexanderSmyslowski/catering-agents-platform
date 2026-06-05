import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const docPath = "docs/architecture/PA50_SYNTHETIC_LIVE_STRICT_EVIDENCE_CORRIDOR.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
};

describe("PA50 synthetic-live strict evidence corridor", () => {
  it("documents the bundled local evidence corridor without widening scope", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA50 Synthetic-Live Strict Evidence Corridor");
    expect(doc).toContain("kein neuer Providerpfad");
    expect(doc).toContain("keine neue API");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("keine Schreibwirkung");
    expect(doc).toContain("keine neue Runtime-Orchestrierung");
  });

  it("keeps the bundled repo entry aligned with the existing preflight and strict probe", () => {
    expect(packageJson.scripts["llm:synthetic-live:preflight"]).toBe(
      "tsx scripts/check-synthetic-live-llm-readiness.ts"
    );
    expect(packageJson.scripts["llm:synthetic-live:probe:strict"]).toBe(
      "tsx scripts/run-synthetic-live-llm-readiness.ts --fail-on-eval-mismatch"
    );
    expect(packageJson.scripts["llm:synthetic-live:check"]).toBe(
      "npm run llm:synthetic-live:preflight && npm run llm:synthetic-live:probe:strict"
    );
  });
});
