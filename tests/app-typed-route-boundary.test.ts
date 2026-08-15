import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const routeFiles = [
  "backoffice-ui/src/App.tsx",
  "backoffice-ui/src/app-dashboard-route-state.ts",
  "backoffice-ui/src/production-focus-state.ts"
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

  it("keeps legacy record conversion at the final rendered view boundary", () => {
    const appSource = readFileSync(path.resolve("backoffice-ui/src/App.tsx"), "utf8");
    const adapterSource = readFileSync(path.resolve("backoffice-ui/src/app-route-legacy-adapter.ts"), "utf8");
    expect(appSource).toContain("buildRecordViewProjection");
    expect(adapterSource).toContain("toLegacyRecord");
    expect(adapterSource).toContain("toLegacyRecords");
    expect(adapterSource).not.toContain("createPersistentCollection");
  });

  it("keeps the legacy adapter behind one explicit view-boundary translation", () => {
    const boundarySource = readFileSync(path.resolve("backoffice-ui/src/app-route-legacy-adapter.ts"), "utf8");
    expect(boundarySource).toContain("toLegacyDashboardProjection");
  });

  it("keeps route state strictly typed without a legacy overload or first-record discriminator", () => {
    const routeStateSource = readFileSync(path.resolve("backoffice-ui/src/app-dashboard-route-state.ts"), "utf8");
    expect(routeStateSource).not.toContain("LegacyAppDashboardRouteState");
    expect(routeStateSource).not.toContain("isLegacyRouteInput");
    expect(routeStateSource).not.toContain("[0]");
  });

  it("keeps the production focus boundary domain-typed", () => {
    const focusSource = readFileSync(path.resolve("backoffice-ui/src/production-focus-state.ts"), "utf8");
    expect(focusSource).not.toContain("Record<string, unknown>");
    const appSource = readFileSync(path.resolve("backoffice-ui/src/App.tsx"), "utf8");
    const focusCall = appSource.match(/buildProductionFocusState\(\{([\s\S]*?)\n\s*\}\)/u)?.[1] ?? "";
    expect(focusCall).toContain("acceptedSpecs: dashboard.acceptedSpecs");
    expect(focusCall).toMatch(/^\s*filteredSpecs,\s*$/mu);
    expect(focusCall).not.toContain("filteredSpecs: viewDashboard.filteredSpecs");
    const routeStateSource = readFileSync(path.resolve("backoffice-ui/src/app-dashboard-route-state.ts"), "utf8");
    expect(routeStateSource).toContain("buildProductProductionDashboardRecordsState");
    const productionRecordsSource = readFileSync(
      path.resolve("backoffice-ui/src/production-dashboard-records-state.ts"),
      "utf8"
    );
    expect(productionRecordsSource).toContain("filteredSpecs: AcceptedEventSpec[]");
    expect(productionRecordsSource).toContain("const filteredSpecs = filterProductRouteRecords");
  });
});
