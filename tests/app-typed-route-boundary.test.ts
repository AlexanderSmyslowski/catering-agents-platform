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

  it("does not import legacy projection helpers into the actual route controller", () => {
    for (const relativePath of routeFiles) {
      const source = readFileSync(path.resolve(relativePath), "utf8");
      expect(source, relativePath).not.toContain("app-route-legacy-adapter");
      expect(source, relativePath).not.toContain("toLegacy");
      expect(source, relativePath).not.toContain("legacyDashboard");
    }
  });

  it("keeps the legacy adapter behind one explicit view-boundary translation", () => {
    const boundarySource = readFileSync(path.resolve("backoffice-ui/src/app-route-content-state.ts"), "utf8");
    expect(boundarySource).toContain("app-route-legacy-adapter");
  });

  it("keeps route state strictly typed without a legacy overload or first-record discriminator", () => {
    const routeStateSource = readFileSync(path.resolve("backoffice-ui/src/app-dashboard-route-state.ts"), "utf8");
    expect(routeStateSource).not.toContain("LegacyAppDashboardRouteState");
    expect(routeStateSource).not.toContain("isLegacyRouteInput");
    expect(routeStateSource).not.toContain("[0]");
  });
});
