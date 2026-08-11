import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const forbiddenRoots = ["intake-service", "offer-service", "production-service", "scripts"];
const rawTransportImport = /from\s+["'][^"']*byo-llm-(?:codex-cli|openai)-transport|from\s+["'][^"']*llm-readiness-openai-transport/;
const rawAdapterFactory = /\bbuildByoLlmAdapterFromEnv\b/;

describe("BYO LLM raw transport boundary", () => {
  it("does not expose raw transports through the shared-core application surface", () => {
    const indexSource = readFileSync(path.join(root, "shared-core/src/index.ts"), "utf8");
    expect(indexSource).not.toContain('export * from "./llm-readiness-openai-transport.js"');
    expect(indexSource).not.toContain('export * from "./byo-llm-codex-cli-transport.js"');
    expect(indexSource).not.toContain("buildByoLlmAdapterFromEnv");
  });

  it("keeps raw provider transports and factories out of product services and ordinary batch scripts", () => {
    const productFiles = forbiddenRoots.flatMap((rootName) => {
      const collect = (relativeDirectory: string): string[] => readdirSync(path.join(root, relativeDirectory)).flatMap((entry) => {
        const relativePath = path.join(relativeDirectory, entry);
        const absolutePath = path.join(root, relativePath);
        return statSync(absolutePath).isDirectory()
          ? collect(relativePath)
          : /\.[cm]?[jt]sx?$/.test(entry) ? [relativePath] : [];
      });
      return collect(rootName);
    }).filter((relativeFile) => !relativeFile.includes("run-synthetic-live-llm-readiness"));

    for (const relativeFile of productFiles) {
      const source = readFileSync(path.join(root, relativeFile), "utf8");
      expect(source).not.toMatch(rawTransportImport);
      expect(source).not.toMatch(rawAdapterFactory);
    }
  });
});
