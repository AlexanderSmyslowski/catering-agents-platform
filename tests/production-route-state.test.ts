import { describe, expect, it } from "vitest";
import { selectFocusedProductionSpec } from "../backoffice-ui/src/production-route-state.js";

describe("production route state", () => {
  const acceptedSpecs = [
    { specId: "spec-old", label: "old" },
    { specId: "spec-current", label: "current" },
    { specId: "spec-other", label: "other" }
  ];

  it("clears the focused production spec when the workspace is cleared", () => {
    expect(
      selectFocusedProductionSpec({
        acceptedSpecs,
        filteredSpecs: acceptedSpecs,
        focusedProductionSpecId: "spec-current",
        productionWorkspaceCleared: true,
        route: "production",
        searchText: ""
      })
    ).toBeUndefined();
  });

  it("keeps active production search constrained to filtered specs", () => {
    const filteredSpecs = [{ specId: "spec-current", label: "current" }];

    expect(
      selectFocusedProductionSpec({
        acceptedSpecs,
        filteredSpecs,
        focusedProductionSpecId: "spec-other",
        productionWorkspaceCleared: false,
        route: "production",
        searchText: "current"
      })
    ).toBe(filteredSpecs[0]);
  });

  it("falls back to the latest accepted spec when production search is not active", () => {
    expect(
      selectFocusedProductionSpec({
        acceptedSpecs,
        filteredSpecs: [],
        productionWorkspaceCleared: false,
        route: "home",
        searchText: ""
      })
    ).toBe(acceptedSpecs[2]);
  });
});
