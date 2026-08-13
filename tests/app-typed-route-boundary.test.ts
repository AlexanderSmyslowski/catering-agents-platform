import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const routeFiles = [
  "backoffice-ui/src/App.tsx",
  "backoffice-ui/src/app-dashboard-route-state.ts",
  "backoffice-ui/src/app-route-content.tsx"
];

describe("typed product route boundary", () => {
  it("does not expose the legacy DashboardState or record compatibility boundary in the rendered route", () => {
    for (const relativePath of routeFiles) {
      const source = readFileSync(path.resolve(relativePath), "utf8");
      expect(source, relativePath).not.toContain("DashboardState");
      expect(source, relativePath).not.toContain("Record<string, unknown>");
      expect(source, relativePath).not.toContain("toPresentation");
    }
  });
});
