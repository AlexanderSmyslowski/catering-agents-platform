import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function trackedFiles(pattern: string): string[] {
  return execFileSync("git", ["ls-files", pattern], {
    encoding: "utf8"
  })
    .split("\n")
    .filter(Boolean);
}

function readPackage(path: string): { exports?: Record<string, string> } {
  return JSON.parse(readFileSync(path, "utf8")) as { exports?: Record<string, string> };
}

describe("runtime single source", () => {
  it("keeps workspace runtime exports on TypeScript sources", () => {
    const packagePaths = [
      "shared-core/package.json",
      "intake-service/package.json",
      "offer-service/package.json",
      "production-service/package.json",
      "print-export/package.json"
    ];

    for (const packagePath of packagePaths) {
      expect(readPackage(packagePath).exports?.["."]).toBe("./src/index.ts");
    }
  });

  it("does not commit JavaScript companions for TypeScript source files", () => {
    const sourceRoots = [
      "shared-core/src",
      "intake-service/src",
      "offer-service/src",
      "production-service/src",
      "print-export/src"
    ];
    const jsFiles = sourceRoots
      .flatMap((root) => trackedFiles(`${root}/**/*.js`))
      .filter((file) => existsSync(file));
    const tsFiles = new Set(sourceRoots.flatMap((root) => trackedFiles(`${root}/**/*.ts`)));

    const companions = jsFiles.filter((file) => tsFiles.has(file.replace(/\.js$/, ".ts")));

    expect(companions).toEqual([]);
  });
});
