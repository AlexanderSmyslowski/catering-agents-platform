import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

const testsRoot = import.meta.dirname;
const legacyFile = path.join(testsRoot, "phase3-latest-p1-review.test.ts");
const partitionFiles = [
  "phase3-latest-p1-review-absent-and-compatibility.test.ts",
  "phase3-latest-p1-review-preexisting-and-legacy.test.ts",
  "phase3-latest-p1-review-rollback-and-recovery.test.ts",
];

test("Phase-3 P1 review reproducers are physically partitioned without suppression modifiers", () => {
  const sources = partitionFiles.map((file) => path.join(testsRoot, file));

  expect(sources.every(existsSync)).toBe(true);
  expect(existsSync(legacyFile)).toBe(false);

  for (const source of sources) {
    const content = readFileSync(source, "utf8");
    expect(content).toContain('from "./phase3-latest-p1-review-helpers.js"');
    expect(content).not.toMatch(/\btest\.(?:skip|only|todo|concurrent)\b/);
    expect(content).not.toMatch(/\bdescribe\.(?:skip|only)\b/);
  }
});
