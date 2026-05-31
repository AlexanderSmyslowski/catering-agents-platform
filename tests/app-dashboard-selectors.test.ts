import { describe, expect, it } from "vitest";
import {
  countOfferHandoffReadiness,
  filterDashboardRecords,
  isInitialHomeDashboardLoading,
  isInitialProductionDashboardLoading,
  mapSpecsById,
  selectActiveOfferSpec,
  selectRecordByStringId
} from "../backoffice-ui/src/app-dashboard-selectors.js";
import type { DashboardState } from "../backoffice-ui/src/api.js";

const emptyDashboard: DashboardState = {
  intakeRequests: [],
  acceptedSpecs: [],
  offerDrafts: [],
  productionPlans: [],
  purchaseLists: [],
  recipes: [],
  auditEvents: []
};

describe("app dashboard selectors", () => {
  it("filters dashboard records with the same case-insensitive JSON search semantics", () => {
    const records = [
      { id: "first", customer: "ACME", menu: ["Tomatensuppe"] },
      { id: "second", customer: "Beta", menu: ["Kaffeepause"] }
    ];

    expect(filterDashboardRecords(records, "   ")).toBe(records);
    expect(filterDashboardRecords(records, "tomaten")).toEqual([records[0]]);
    expect(filterDashboardRecords(records, "BETA")).toEqual([records[1]]);
  });

  it("counts offer handoff readiness states and ignores unsupported values", () => {
    expect(
      countOfferHandoffReadiness([
        { specId: "complete", readiness: { status: "complete" } },
        { specId: "partial", readiness: { status: "partial" } },
        { specId: "partial-2", readiness: { status: "partial" } },
        { specId: "insufficient", readiness: { status: "insufficient" } },
        { specId: "missing" }
      ])
    ).toEqual({ complete: 1, partial: 2 });
  });

  it("keeps initial home loading scoped to an empty home dashboard", () => {
    expect(isInitialHomeDashboardLoading({ route: "home", loading: true, dashboard: emptyDashboard })).toBe(true);
    expect(isInitialHomeDashboardLoading({ route: "production", loading: true, dashboard: emptyDashboard })).toBe(
      false
    );
    expect(
      isInitialHomeDashboardLoading({
        route: "home",
        loading: true,
        dashboard: { ...emptyDashboard, recipes: [{ recipeId: "recipe-1" }] }
      })
    ).toBe(false);
  });

  it("keeps initial production loading scoped to the empty production inventory", () => {
    expect(isInitialProductionDashboardLoading({ route: "production", loading: true, dashboard: emptyDashboard })).toBe(
      true
    );
    expect(isInitialProductionDashboardLoading({ route: "home", loading: true, dashboard: emptyDashboard })).toBe(
      false
    );
    expect(isInitialProductionDashboardLoading({ route: "production", loading: false, dashboard: emptyDashboard })).toBe(
      false
    );
    expect(
      isInitialProductionDashboardLoading({
        route: "production",
        loading: true,
        dashboard: { ...emptyDashboard, productionPlans: [{ planId: "plan-1" }] }
      })
    ).toBe(false);
    expect(
      isInitialProductionDashboardLoading({
        route: "production",
        loading: true,
        dashboard: { ...emptyDashboard, intakeRequests: [{ requestId: "request-1" }] }
      })
    ).toBe(true);
  });

  it("selects specs and drafts with the App.tsx fallback behavior", () => {
    const specs = [{ specId: "older" }, { specId: "latest" }];
    const filteredSpecs = [{ specId: "filtered" }];
    const drafts = [{ draftId: "draft-1" }, { draftId: "draft-2" }];
    const specsById = mapSpecsById(specs);

    expect(specsById.get("latest")).toBe(specs[1]);
    expect(selectRecordByStringId(drafts, "draftId", "draft-2")).toBe(drafts[1]);
    expect(selectRecordByStringId(drafts, "draftId")).toBeUndefined();
    expect(selectActiveOfferSpec(specs, filteredSpecs)).toBe(filteredSpecs[0]);
    expect(selectActiveOfferSpec(specs, [])).toBe(specs[1]);
  });
});
