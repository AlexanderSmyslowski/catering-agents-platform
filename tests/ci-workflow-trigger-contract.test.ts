import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/ci.yml", "utf8");

function sectionBetween(startMarker: string, endMarker?: string): string {
  const start = workflow.indexOf(startMarker);
  expect(start).toBeGreaterThanOrEqual(0);
  const remainder = workflow.slice(start);
  const end = endMarker ? remainder.indexOf(endMarker) : -1;
  return end >= 0 ? remainder.slice(0, end) : remainder;
}

describe("GitHub Actions trigger contract", () => {
  it("runs main and checkpoint pushes plus pull requests, but not codex branch pushes", () => {
    const push = sectionBetween("  push:\n", "  pull_request:\n");
    const pullRequest = sectionBetween("  pull_request:\n");

    expect(push).toMatch(/branches:\n\s+- main/);
    expect(push).toMatch(/tags:\n\s+- [\"']checkpoint-\*[\"']/);
    expect(push).not.toMatch(/codex\/\*\*/);
    expect(pullRequest).toMatch(/branches:\n\s+- main/);
  });
});
